import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMProviderError,
  LLMErrorCategory,
} from './llm-provider.interface';

/**
 * OpenAI GPT — secondary vendor BP (fallback при падении Anthropic).
 *
 * Используется native fetch (Node 18+ global) — без OpenAI SDK, чтобы
 * сохранить dependency surface минимальной.
 *
 * Отличия от Anthropic:
 * - System промпт — message с role='system' (не отдельное поле).
 * - Prompt caching — автоматический (по prefix'у). Флаг `cache_control` на
 *   уровне интерфейса принимается но не отправляется в API. OpenAI сам
 *   кэширует prefix ≥1024 токенов. `prompt_cache_key` передаётся для
 *   стабильного роутинга в одном cache-shard.
 * - Tools: `tools: [{ type: 'function', function: { name, description,
 *   parameters } }]`. Tool-use в ответе: `choices[0].message.tool_calls`.
 * - Usage: `prompt_tokens_details.cached_tokens` = cache hits.
 * - Retry-after: из response header `x-ratelimit-reset-requests`.
 */
@Injectable()
export class OpenAIProvider implements LLMProvider {
  readonly vendor = 'openai' as const;
  private readonly logger = new Logger('OpenAIProvider');
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _defaultModel: string;
  private readonly _judgeModel: string;
  private readonly timeoutMs: number;
  private readonly _rpm: number;
  private readonly _tpm: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('openai.apiKey') ?? '';
    this.baseUrl = this.config.get<string>('openai.baseUrl') ?? 'https://api.openai.com/v1';
    this._defaultModel = this.config.get<string>('openai.model') ?? 'gpt-4.1';
    this._judgeModel = this.config.get<string>('openai.judgeModel') ?? 'gpt-4.1-mini';
    this.timeoutMs = this.config.get<number>('openai.timeoutMs') ?? 120_000;
    this._rpm = this.config.get<number>('openai.rpmCap') ?? 1000;
    this._tpm = this.config.get<number>('openai.tpmCap') ?? 400_000;
  }

  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  defaultModel(): string {
    return this._defaultModel;
  }

  judgeModel(): string {
    return this._judgeModel;
  }

  rateLimits(): { rpm: number; tpm: number } {
    return { rpm: this._rpm, tpm: this._tpm };
  }

  estimateInputTokens(system: string, user: string): number {
    return Math.ceil((system.length + user.length) / 2.5);
  }

  async createMessage(req: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    let retries = 0;
    const maxRetries = 3;
    let lastErr: LLMProviderError | null = null;

    while (retries <= maxRetries) {
      try {
        return await this.callOnce(req, start, retries);
      } catch (err: any) {
        const normalized = err instanceof LLMProviderError ? err : this.mapError(err);
        lastErr = normalized;
        if (normalized.category === 'auth' || normalized.category === 'bad_request' ||
            normalized.category === 'content_filter' || normalized.category === 'context_too_long') {
          throw normalized;
        }
        if (retries >= maxRetries) throw normalized;
        const backoff = normalized.retryAfterMs ?? Math.min(1000 * 2 ** retries, 8000) + Math.floor(Math.random() * 250);
        this.logger.warn(`openai ${normalized.category} retry ${retries + 1}/${maxRetries} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        retries++;
      }
    }
    throw lastErr ?? new LLMProviderError({ category: 'fatal', vendor: this.vendor, message: 'unknown' });
  }

  private async callOnce(req: LLMRequest, start: number, retries: number): Promise<LLMResponse> {
    // Translate normalized request → OpenAI chat.completions format.
    const systemText = req.system.map((c) => c.text).join('\n\n');
    const messages: Array<Record<string, unknown>> = [];
    if (systemText) messages.push({ role: 'system', content: systemText });
    for (const m of req.messages) {
      const text = m.content.map((c) => c.text).join('\n');
      messages.push({ role: m.role, content: text });
    }

    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      max_completion_tokens: req.maxOutputTokens,
      temperature: req.temperature ?? 0.7,
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));
    }
    if (req.toolChoice) {
      if (req.toolChoice.type === 'tool' && req.toolChoice.name) {
        body.tool_choice = { type: 'function', function: { name: req.toolChoice.name } };
      } else if (req.toolChoice.type === 'none') {
        body.tool_choice = 'none';
      } else {
        body.tool_choice = 'auto';
      }
    }
    if (req.metadata?.user_id) body.user = req.metadata.user_id;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      const retryAfterRaw = resp.headers.get('retry-after');
      const retryAfterMs = retryAfterRaw ? Number(retryAfterRaw) * 1000 : undefined;
      throw new LLMProviderError({
        category: this.categoryForStatus(resp.status, text),
        vendor: this.vendor,
        message: `openai http_${resp.status}: ${text.slice(0, 250)}`,
        httpStatus: resp.status,
        retryAfterMs,
      });
    }

    const data: any = await resp.json();
    const choice = data?.choices?.[0];
    const message = choice?.message ?? {};
    const content: LLMResponse['content'] = [];
    if (message.content) {
      content.push({ type: 'text', text: String(message.content) });
    }
    if (Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        let parsed: any = {};
        try {
          parsed = typeof tc?.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc?.function?.arguments ?? {};
        } catch {
          parsed = { _raw: tc?.function?.arguments };
        }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc?.function?.name,
          input: parsed,
        });
      }
    }

    const usage = data?.usage ?? {};
    const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      id: data?.id ?? 'openai-unknown',
      stopReason: choice?.finish_reason ?? null,
      content,
      usage: {
        inputTokens: Number(usage?.prompt_tokens ?? 0),
        outputTokens: Number(usage?.completion_tokens ?? 0),
        cacheReadInputTokens: Number(cachedTokens),
        cacheCreationInputTokens: 0,
      },
      latencyMs: Date.now() - start,
      retries,
      model: data?.model ?? req.model,
      vendor: this.vendor,
    };
  }

  private categoryForStatus(status: number, bodyText: string): LLMErrorCategory {
    if (status === 401 || status === 403) return 'auth';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'transient';
    if (status === 400) {
      const lower = bodyText.toLowerCase();
      if (lower.includes('context_length') || lower.includes('maximum context')) return 'context_too_long';
      if (lower.includes('content_policy') || lower.includes('safety')) return 'content_filter';
      return 'bad_request';
    }
    return 'fatal';
  }

  private mapError(err: any): LLMProviderError {
    const name = err?.name;
    if (name === 'AbortError') {
      return new LLMProviderError({
        category: 'transient',
        vendor: this.vendor,
        message: `openai timeout (${this.timeoutMs}ms)`,
        nativeCode: 'AbortError',
      });
    }
    return new LLMProviderError({
      category: 'transient',
      vendor: this.vendor,
      message: err?.message ?? 'openai network error',
      nativeCode: err?.code,
    });
  }
}
