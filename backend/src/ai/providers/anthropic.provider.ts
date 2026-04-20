import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicClient } from '../anthropic.client';
import {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMProviderError,
  LLMErrorCategory,
} from './llm-provider.interface';

/**
 * Anthropic Claude — primary vendor BP.
 *
 * Тонкий адаптер поверх AnthropicClient: нормализованный LLMRequest →
 * native Anthropic SDK, ответ → LLMResponse. AnthropicClient оставлен как
 * low-level HTTP-слой (retry/backoff), чтобы не переписывать тесты и
 * сохранить его роль «SDK-обёртка».
 *
 * cache_control: Anthropic — единственный вендор, где кэш явный. Флаг
 * `cache_control: { type: 'ephemeral' }` передаётся native в system blocks.
 */
@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly vendor = 'anthropic' as const;
  private readonly logger = new Logger('AnthropicProvider');
  private readonly _defaultModel: string;
  private readonly _judgeModel: string;
  private readonly apiKey: string;
  private readonly _rpm: number;
  private readonly _tpm: number;

  constructor(
    private readonly config: ConfigService,
    private readonly client: AnthropicClient,
  ) {
    this._defaultModel = this.config.get<string>('anthropic.model') ?? 'claude-opus-4-7';
    this._judgeModel = this.config.get<string>('anthropic.judgeModel') ?? 'claude-haiku-4';
    this.apiKey = this.config.get<string>('anthropic.apiKey') ?? '';
    this._rpm = this.config.get<number>('anthropicLimits.rpmCap') ?? 1500;
    this._tpm = this.config.get<number>('anthropicLimits.tpmCap') ?? 300_000;
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
    return this.client.estimateInputTokens(system, user);
  }

  async createMessage(req: LLMRequest): Promise<LLMResponse> {
    try {
      const raw = await this.client.createMessage({
        model: req.model,
        system: req.system,
        messages: req.messages,
        maxOutputTokens: req.maxOutputTokens,
        temperature: req.temperature,
        tools: req.tools as any,
        toolChoice: req.toolChoice,
        metadata: req.metadata,
      });
      return {
        id: raw.id,
        stopReason: raw.stopReason,
        content: raw.content.map((c) => ({
          type: (c.type === 'tool_use' ? 'tool_use' : 'text') as 'text' | 'tool_use',
          text: c.text,
          id: c.id,
          name: c.name,
          input: c.input,
        })),
        usage: raw.usage,
        latencyMs: raw.latencyMs,
        retries: raw.retries,
        model: raw.model,
        vendor: this.vendor,
      };
    } catch (err: any) {
      throw this.mapError(err);
    }
  }

  private mapError(err: any): LLMProviderError {
    const status = err?.status ?? err?.response?.status;
    const retryAfterRaw = err?.response?.headers?.['retry-after'];
    const retryAfterMs = retryAfterRaw ? Number(retryAfterRaw) * 1000 : undefined;
    let category: LLMErrorCategory = 'fatal';

    if (status === 401 || status === 403) category = 'auth';
    else if (status === 429) category = 'rate_limited';
    else if (status >= 500 && status < 600) category = 'transient';
    else if (status === 400) {
      const msg = (err?.message ?? '').toLowerCase();
      if (msg.includes('context') || msg.includes('too long')) category = 'context_too_long';
      else if (msg.includes('content') || msg.includes('policy')) category = 'content_filter';
      else category = 'bad_request';
    } else if (!status) category = 'transient';

    return new LLMProviderError({
      category,
      vendor: this.vendor,
      message: err?.message ?? 'anthropic error',
      httpStatus: status,
      retryAfterMs,
      nativeCode: err?.code,
    });
  }
}
