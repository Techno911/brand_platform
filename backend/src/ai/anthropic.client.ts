import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicMessageInput {
  model: string;
  system: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  }>;
  maxOutputTokens: number;
  temperature?: number;
  tools?: any[];
  toolChoice?: any;
  metadata?: { user_id?: string };
}

export interface AnthropicMessageResult {
  id: string;
  stopReason: string | null;
  content: Array<{ type: string; text?: string; name?: string; input?: any; id?: string }>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  latencyMs: number;
  retries: number;
  model: string;
}

type ErrCategory = 'transient' | 'fatal' | 'auth' | 'rate_limited';

function classifyError(err: any): { category: ErrCategory; code: string } {
  const status = err?.status ?? err?.response?.status;
  if (status === 401 || status === 403) return { category: 'auth', code: `http_${status}` };
  if (status === 429) return { category: 'rate_limited', code: 'rate_limited' };
  if (status >= 500 && status < 600) return { category: 'transient', code: `http_${status}` };
  if (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.name === 'AbortError') {
    return { category: 'transient', code: 'network_timeout' };
  }
  if (!status) return { category: 'transient', code: 'network_unknown' };
  return { category: 'fatal', code: `http_${status}` };
}

@Injectable()
export class AnthropicClient {
  private readonly logger = new Logger('AnthropicClient');
  private readonly client: Anthropic;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey') ?? '';
    this.timeoutMs = this.config.get<number>('anthropic.timeoutMs') ?? 120_000;
    this.client = new Anthropic({
      apiKey,
      timeout: this.timeoutMs,
      maxRetries: 0, // we handle retries ourselves
    });
  }

  /**
   * Exponential-backoff retry — only for transient (5xx, network, 429).
   * 4xx (auth, validation) fail-fast with no retry (file 01 anti-pattern).
   */
  async createMessage(input: AnthropicMessageInput): Promise<AnthropicMessageResult> {
    const start = Date.now();
    let retries = 0;
    const maxRetries = 3;
    let lastErr: any = null;

    while (retries <= maxRetries) {
      try {
        // NB: новые reasoning-модели Anthropic (claude-opus-4-7, claude-sonnet-4-5)
        // отклоняют параметр `temperature` как deprecated — сервер возвращает
        // 400 invalid_request_error. Поэтому temperature передаём только если
        // явно задан вызывателем, а дефолт 0.7 убираем: API сам выберет
        // подходящее значение по модели.
        const body: Record<string, any> = {
          model: input.model,
          system: input.system as any,
          messages: input.messages as any,
          max_tokens: input.maxOutputTokens,
          tools: input.tools as any,
          tool_choice: input.toolChoice,
          metadata: input.metadata,
        };
        if (typeof input.temperature === 'number') {
          body.temperature = input.temperature;
        }
        const resp = await this.client.messages.create(body as any);
        const u: any = (resp as any).usage ?? {};
        return {
          id: resp.id,
          stopReason: resp.stop_reason ?? null,
          content: resp.content as any,
          usage: {
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
            cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
          },
          latencyMs: Date.now() - start,
          retries,
          model: input.model,
        };
      } catch (err: any) {
        lastErr = err;
        const { category, code } = classifyError(err);
        if (category === 'fatal' || category === 'auth') {
          this.logger.error(`anthropic fatal ${code}: ${err?.message}`);
          throw err;
        }
        if (retries >= maxRetries) {
          this.logger.error(`anthropic exhausted retries ${code}: ${err?.message}`);
          throw err;
        }
        const backoff = Math.min(1000 * 2 ** retries, 8000) + Math.floor(Math.random() * 250);
        this.logger.warn(`anthropic ${code} retry ${retries + 1}/${maxRetries} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        retries++;
      }
    }
    throw lastErr;
  }

  /** Rough estimator: ~4 chars/token for EN, ~2 chars/token for RU/CJK. Overshoots conservatively. */
  estimateInputTokens(system: string, messages: string): number {
    const total = system.length + messages.length;
    return Math.ceil(total / 2.5);
  }
}
