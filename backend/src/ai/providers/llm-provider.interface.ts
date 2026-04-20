/**
 * Унифицированный интерфейс LLM-провайдера.
 *
 * Зачем: BP работает с multi-vendor (Anthropic primary, OpenAI secondary,
 * DeepSeek/Qwen/GLM tertiary — все через OpenAI-compat). Методология BP 3.1
 * не зависит от провайдера: moat = промпты + golden set + industry context.
 * Провайдер выбирается `VendorRouter` по политике per-stage / per-kind, а не
 * хардкодится в AIService.
 *
 * Контракт:
 * - Вход — нормализованный (system chunks с optional cache_control,
 *   user messages, tools, maxTokens, temperature).
 * - Выход — нормализованный (content parts: text | tool_use, usage tokens,
 *   stopReason, latency, retries).
 * - Каждая реализация внутренне переводит нормализованный формат в native
 *   API вендора (Anthropic — messages + system, OpenAI — chat.completions
 *   с system/user, DeepSeek/Qwen/GLM — OpenAI-compat same shape).
 *
 * cache_control:ephemeral:
 *   - Anthropic: нативно поддерживается в system blocks.
 *   - OpenAI: transparent cache (автоматически по prompt-prefix, флаг
 *     игнорируется) + optional `prompt_cache_key`.
 *   - OpenAI-compat (DeepSeek): auto-cache (game-breaker по цене — V3 считает
 *     кэшированные токены в ~10x дешевле non-cached). Qwen/GLM — prefix-cache.
 *   - Интерфейс принимает флаг, реализация решает как обеспечить кэш.
 */

export type LLMVendor = 'anthropic' | 'openai' | 'openai_compat';

export type LLMRole = 'primary' | 'secondary' | 'tertiary';

export interface LLMSystemChunk {
  type: 'text';
  text: string;
  /** Флаг для prompt caching (Anthropic explicit, OpenAI/compat — auto). */
  cache_control?: { type: 'ephemeral' };
}

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral' };
  }>;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LLMRequest {
  /** Модель внутри вендора: 'claude-opus-4-7', 'gpt-4.1', 'deepseek-chat', etc. */
  model: string;
  system: LLMSystemChunk[];
  messages: LLMMessage[];
  maxOutputTokens: number;
  temperature?: number;
  tools?: LLMTool[];
  /** Принудительный выбор tool'а или 'auto' / 'none'. */
  toolChoice?: { type: 'auto' | 'any' | 'tool' | 'none'; name?: string };
  /** Meta для аудита (user_id не летит в сам промпт). */
  metadata?: { user_id?: string };
}

export interface LLMContentBlock {
  type: 'text' | 'tool_use';
  /** Для type='text'. */
  text?: string;
  /** Для type='tool_use'. */
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache-read, OpenAI prompt_tokens_cached, DeepSeek prompt_cache_hit_tokens. */
  cacheReadInputTokens: number;
  /** Anthropic cache-creation. У OpenAI/compat — 0 (кеш автоматический). */
  cacheCreationInputTokens: number;
}

export interface LLMResponse {
  id: string;
  stopReason: string | null;
  content: LLMContentBlock[];
  usage: LLMUsage;
  latencyMs: number;
  retries: number;
  model: string;
  vendor: LLMVendor;
}

/**
 * Классы ошибок провайдера — единый словарь для retry/fallback решений
 * в VendorRouter и GlobalLLMQueue. Провайдер маппит native ошибки на эти
 * категории.
 */
export type LLMErrorCategory =
  | 'transient' // 5xx, сетевой таймаут — retry
  | 'rate_limited' // 429 — retry с respect для retry-after
  | 'auth' // 401/403 — fatal, триггер fallback на другой вендор
  | 'bad_request' // 400 — fatal, проблема в промпте / params, fallback не поможет
  | 'content_filter' // вендорский сейфети-триггер — fatal, fallback на другой вендор
  | 'context_too_long' // 413 / ContextLengthExceeded — fatal, клиент должен сократить
  | 'fatal'; // всё остальное

export class LLMProviderError extends Error {
  public readonly category: LLMErrorCategory;
  public readonly vendor: LLMVendor;
  public readonly httpStatus?: number;
  public readonly retryAfterMs?: number;
  public readonly nativeCode?: string;

  constructor(params: {
    category: LLMErrorCategory;
    vendor: LLMVendor;
    message: string;
    httpStatus?: number;
    retryAfterMs?: number;
    nativeCode?: string;
  }) {
    super(params.message);
    this.name = 'LLMProviderError';
    this.category = params.category;
    this.vendor = params.vendor;
    this.httpStatus = params.httpStatus;
    this.retryAfterMs = params.retryAfterMs;
    this.nativeCode = params.nativeCode;
  }
}

/**
 * Главный контракт провайдера. Все три реализации (Anthropic / OpenAI /
 * OpenAI-compat) имплементируют этот интерфейс.
 */
export interface LLMProvider {
  readonly vendor: LLMVendor;

  /** Конфигурация провайдера инициализирована (есть ли ключ / модель). */
  isAvailable(): boolean;

  /** Дефолтная модель для «обычного» вызова. */
  defaultModel(): string;

  /** Дефолтная модель для judge/classify вызовов (дешевле). */
  judgeModel(): string;

  /** Создать сообщение. Реализация сама ретраит transient/429, fatal кидает. */
  createMessage(req: LLMRequest): Promise<LLMResponse>;

  /** Грубая оценка input tokens (~4 chars/token EN, ~2 chars/token RU/CJK). */
  estimateInputTokens(system: string, user: string): number;

  /** Rate limits вендора (для GlobalLLMQueue token-bucket). */
  rateLimits(): { rpm: number; tpm: number };
}
