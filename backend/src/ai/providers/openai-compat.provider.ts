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
 * OpenAI-compatible tertiary vendor: DeepSeek / Qwen (Dashscope) / GLM (Zhipu).
 *
 * Все три вендора реализуют OpenAI chat.completions формат 1-в-1, поэтому
 * один адаптер покрывает всех. Выбор вендора — через env:
 *   OPENAI_COMPAT_VENDOR=deepseek | qwen | glm   (тэг для audit/metrics)
 *   OPENAI_COMPAT_BASE_URL=https://api.deepseek.com/v1
 *   OPENAI_COMPAT_API_KEY=sk-...
 *   OPENAI_COMPAT_MODEL=deepseek-chat | qwen3-max | glm-4.6
 *
 * Семантика использования в BP:
 *   - Дешёвые шаги (LLM-judge, /review-classify, sanity-check брифа).
 *   - НЕ для judgment-heavy (legend / values / mission / positioning) —
 *     там Opus / GPT-4.1 оправдывают стоимость.
 *
 * DeepSeek специфика:
 *   - Auto-cache (prompt_cache_hit_tokens / prompt_cache_miss_tokens в usage)
 *     — экономия до 10x на кэше.
 *   - Rate limit: не фиксированный RPM, а по nature of load. Держим tight
 *     cap (300 RPM / 200k TPM по умолчанию).
 *   - Context window: V3.5 = 128k. Может не влезть stage-1 с большим
 *     транскриптом — VendorRouter должен проверить estimated tokens и
 *     откатиться на primary при >100k.
 *
 * Qwen / GLM специфика:
 *   - Prefix-cache (auto).
 *   - Dashscope/Zhipu могут требовать x-api-key вместо Bearer — этот адаптер
 *     использует Bearer (стандарт OpenAI-compat). Если вендор требует
 *     кастомный header — расширить через OPENAI_COMPAT_AUTH_HEADER (TBD).
 */
@Injectable()
export class OpenAICompatProvider implements LLMProvider {
  readonly vendor = 'openai_compat' as const;
  private readonly logger = new Logger('OpenAICompatProvider');
  private readonly vendorTag: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly _defaultModel: string;
  private readonly _judgeModel: string;
  private readonly timeoutMs: number;
  private readonly _rpm: number;
  private readonly _tpm: number;

  constructor(private readonly config: ConfigService) {
    this.vendorTag = this.config.get<string>('openaiCompat.vendor') ?? 'deepseek';
    this.apiKey = this.config.get<string>('openaiCompat.apiKey') ?? '';
    this.baseUrl = this.config.get<string>('openaiCompat.baseUrl') ?? 'https://api.deepseek.com/v1';
    this._defaultModel = this.config.get<string>('openaiCompat.model') ?? 'deepseek-chat';
    this._judgeModel = this.config.get<string>('openaiCompat.judgeModel') ?? 'deepseek-chat';
    this.timeoutMs = this.config.get<number>('openaiCompat.timeoutMs') ?? 120_000;
    this._rpm = this.config.get<number>('openaiCompat.rpmCap') ?? 300;
    this._tpm = this.config.get<number>('openaiCompat.tpmCap') ?? 200_000;
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

  /** Тэг вендора для audit/metrics/logs (`deepseek` / `qwen` / `glm`). */
  vendorTagName(): string {
    return this.vendorTag;
  }

  estimateInputTokens(system: string, user: string): number {
    // У DeepSeek/Qwen/GLM токенизация CJK-aware, но для dev-оценки
    // достаточно 2.5 chars/token. Переоценка безопаснее недооценки.
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
        this.logger.warn(`${this.vendorTag} ${normalized.category} retry ${retries + 1}/${maxRetries} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        retries++;
      }
    }
    throw lastErr ?? new LLMProviderError({ category: 'fatal', vendor: this.vendor, message: 'unknown' });
  }

  private async callOnce(req: LLMRequest, start: number, retries: number): Promise<LLMResponse> {
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
      max_tokens: req.maxOutputTokens,
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
        message: `${this.vendorTag} http_${resp.status}: ${text.slice(0, 250)}`,
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
    // DeepSeek: prompt_cache_hit_tokens (separate field). OpenAI-style:
    // prompt_tokens_details.cached_tokens. Пытаемся оба.
    const cachedHit = Number(
      usage?.prompt_cache_hit_tokens ??
        usage?.prompt_tokens_details?.cached_tokens ??
        0,
    );

    return {
      id: data?.id ?? `${this.vendorTag}-unknown`,
      stopReason: choice?.finish_reason ?? null,
      content,
      usage: {
        inputTokens: Number(usage?.prompt_tokens ?? 0),
        outputTokens: Number(usage?.completion_tokens ?? 0),
        cacheReadInputTokens: cachedHit,
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
    if (status === 400 || status === 413) {
      const lower = bodyText.toLowerCase();
      if (lower.includes('context') || lower.includes('too long') || lower.includes('token')) {
        return 'context_too_long';
      }
      if (lower.includes('content') || lower.includes('policy') || lower.includes('safety')) {
        return 'content_filter';
      }
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
        message: `${this.vendorTag} timeout (${this.timeoutMs}ms)`,
        nativeCode: 'AbortError',
      });
    }
    return new LLMProviderError({
      category: 'transient',
      vendor: this.vendor,
      message: err?.message ?? `${this.vendorTag} network error`,
      nativeCode: err?.code,
    });
  }
}
