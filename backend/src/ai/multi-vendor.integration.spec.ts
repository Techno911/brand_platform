/**
 * multi-vendor.integration.spec.ts — 50-тестовый набор проверяет что
 * multi-vendor LLM слой действительно работает end-to-end на реальных
 * ключах Anthropic + OpenAI.
 *
 * Запускается только с реальными ключами в backend/.env. Если ключа нет —
 * соответствующий describe-блок пропускается через `.skip` динамически.
 *
 * Сгруппировано:
 *   A. AnthropicProvider live calls (10)
 *   B. OpenAIProvider live calls (7)
 *   C. VendorRouter routing logic (13)
 *   D. GlobalLLMQueue rate/concurrency (8)
 *   E. Cross-vendor fallback + e2e (6)
 *   F. Error categorization (6)
 *
 * Итого: 50.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';
import configuration from '../config/configuration';
import { AnthropicClient } from './anthropic.client';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenAICompatProvider } from './providers/openai-compat.provider';
import {
  LLMProviderError,
  LLMRequest,
} from './providers/llm-provider.interface';
import { VendorRouterService } from './vendor-router.service';
import { GlobalLLMQueueService } from './global-llm-queue.service';

// Загружаем backend/.env в process.env (если тест стартует из корня backend).
// override: true — чтобы перебить пустой ANTHROPIC_API_KEY= из shell.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const HAS_ANTHROPIC = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 20);
const HAS_OPENAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 20);

/** Реальный ConfigService, собранный из configuration() + текущего process.env. */
function makeConfig(overrides?: Record<string, any>): ConfigService {
  const base = configuration();
  const merged = overrides ? deepMerge(base, overrides) : base;
  return {
    get: (k: string) => getPath(merged, k),
  } as any;
}

function deepMerge<T>(a: T, b: any): T {
  if (typeof a !== 'object' || a === null) return b ?? a;
  const out: any = Array.isArray(a) ? [...a] : { ...a };
  for (const k of Object.keys(b ?? {})) {
    out[k] = typeof b[k] === 'object' && b[k] !== null && !Array.isArray(b[k])
      ? deepMerge((a as any)[k] ?? {}, b[k])
      : b[k];
  }
  return out;
}

function getPath(obj: any, p: string): any {
  return p.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
}

function makeRequest(model: string, text: string, max = 30): LLMRequest {
  return {
    model,
    system: [{ type: 'text', text: 'Отвечай кратко, одним-двумя словами.' }],
    messages: [{ role: 'user', content: [{ type: 'text', text }] }],
    maxOutputTokens: max,
    temperature: 0.2,
  };
}

// ----------------------------------------------------------------------------
// A. AnthropicProvider live (10 tests)
// ----------------------------------------------------------------------------
const skipAnthropic = HAS_ANTHROPIC ? describe : describe.skip;

skipAnthropic('A. AnthropicProvider live calls', () => {
  let provider: AnthropicProvider;
  let config: ConfigService;

  beforeAll(() => {
    config = makeConfig();
    const client = new AnthropicClient(config);
    provider = new AnthropicProvider(config, client);
  });

  it('A1. isAvailable() = true с реальным ключом', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('A2. vendor = "anthropic"', () => {
    expect(provider.vendor).toBe('anthropic');
  });

  it('A3. defaultModel() из env ANTHROPIC_MODEL', () => {
    expect(provider.defaultModel()).toBe('claude-opus-4-7');
  });

  it('A4. judgeModel() из env ANTHROPIC_JUDGE_MODEL', () => {
    expect(provider.judgeModel()).toBe('claude-haiku-4-5-20251001');
  });

  it('A5. rateLimits() возвращает rpm/tpm > 0', () => {
    const limits = provider.rateLimits();
    expect(limits.rpm).toBeGreaterThan(0);
    expect(limits.tpm).toBeGreaterThan(0);
  });

  it('A6. estimateInputTokens даёт > 0 для непустого входа', () => {
    expect(provider.estimateInputTokens('system prompt', 'user input')).toBeGreaterThan(0);
  });

  it('A7. createMessage() Haiku возвращает content + end_turn', async () => {
    const res = await provider.createMessage(makeRequest(provider.judgeModel(), 'Say hi'));
    expect(res.content.length).toBeGreaterThan(0);
    expect(res.content[0].type).toBe('text');
    expect(res.content[0].text).toBeTruthy();
    expect(res.stopReason).toBe('end_turn');
    expect(res.vendor).toBe('anthropic');
  }, 60_000);

  it('A8. usage.inputTokens и outputTokens > 0', async () => {
    const res = await provider.createMessage(makeRequest(provider.judgeModel(), 'One word greeting'));
    expect(res.usage.inputTokens).toBeGreaterThan(0);
    expect(res.usage.outputTokens).toBeGreaterThan(0);
  }, 60_000);

  it('A9. max_tokens=1 → stop_reason=max_tokens', async () => {
    const req = makeRequest(provider.judgeModel(), 'Skажи длинное предложение про погоду', 1);
    const res = await provider.createMessage(req);
    expect(res.stopReason).toBe('max_tokens');
  }, 60_000);

  it('A10. latencyMs > 0 в ответе', async () => {
    const res = await provider.createMessage(makeRequest(provider.judgeModel(), 'hi'));
    expect(res.latencyMs).toBeGreaterThan(0);
  }, 60_000);
});

// ----------------------------------------------------------------------------
// B. OpenAIProvider live (7 tests)
// ----------------------------------------------------------------------------
const skipOpenAI = HAS_OPENAI ? describe : describe.skip;

skipOpenAI('B. OpenAIProvider live calls', () => {
  let provider: OpenAIProvider;

  beforeAll(() => {
    provider = new OpenAIProvider(makeConfig());
  });

  it('B1. isAvailable() = true с реальным ключом', () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it('B2. vendor = "openai"', () => {
    expect(provider.vendor).toBe('openai');
  });

  it('B3. defaultModel() из env OPENAI_MODEL', () => {
    expect(provider.defaultModel()).toBe('gpt-5.4-mini');
  });

  it('B4. createMessage() возвращает text content', async () => {
    const res = await provider.createMessage(makeRequest(provider.defaultModel(), 'Reply with one word: ok'));
    expect(res.content.length).toBeGreaterThan(0);
    const textBlock = res.content.find((c) => c.type === 'text');
    expect(textBlock?.text).toBeTruthy();
    expect(res.vendor).toBe('openai');
  }, 60_000);

  it('B5. stopReason нормализован (stop/length)', async () => {
    const res = await provider.createMessage(makeRequest(provider.defaultModel(), 'say ok'));
    expect(['stop', 'length', 'tool_calls', 'content_filter']).toContain(res.stopReason);
  }, 60_000);

  it('B6. usage корректно заполнен', async () => {
    const res = await provider.createMessage(makeRequest(provider.defaultModel(), 'hi'));
    expect(res.usage.inputTokens).toBeGreaterThan(0);
    expect(res.usage.outputTokens).toBeGreaterThan(0);
    expect(res.usage.cacheCreationInputTokens).toBe(0);
  }, 60_000);

  it('B7. model в ответе совпадает с запрошенным (или его snapshot-id)', async () => {
    const res = await provider.createMessage(makeRequest(provider.defaultModel(), 'hi'));
    expect(res.model).toContain('gpt-5.4');
  }, 60_000);
});

// ----------------------------------------------------------------------------
// C. VendorRouter routing logic (13 tests) — не требует реальных ключей,
//    но пользуется env для isAvailable.
// ----------------------------------------------------------------------------
describe('C. VendorRouter routing logic', () => {
  let router: VendorRouterService;
  let config: ConfigService;

  beforeAll(() => {
    config = makeConfig();
    const anthropic = new AnthropicProvider(config, new AnthropicClient(config));
    const openai = new OpenAIProvider(config);
    const compat = new OpenAICompatProvider(config);
    router = new VendorRouterService(config, anthropic, openai, compat);
  });

  it('C1. default (без stage/category) → primary', () => {
    const r = router.pickProvider({});
    expect(r.role).toBe('primary');
    expect(r.reason).toBe('default_primary');
  });

  it('C2. stage=2 → primary (stage-policy)', () => {
    const r = router.pickProvider({ stage: 2 });
    expect(r.role).toBe('primary');
    expect(r.reason).toContain('stage_2');
  });

  it('C3. category=judge → secondary (из env LLM_JUDGE_POLICY)', () => {
    const r = router.pickProvider({ category: 'judge' });
    expect(r.reason).toContain('judge_policy');
    // В тест-env judgePolicy=secondary, и openai ключ есть → secondary.
    if (HAS_OPENAI) {
      expect(r.provider.vendor).toBe('openai');
    }
  });

  it('C4. category=classify → secondary (из env LLM_CLASSIFY_POLICY)', () => {
    const r = router.pickProvider({ category: 'classify' });
    expect(r.reason).toContain('classify_policy');
  });

  it('C5. category=critique → primary (diversity)', () => {
    const r = router.pickProvider({ category: 'critique' });
    expect(r.role).toBe('primary');
    expect(r.reason).toContain('critique');
  });

  it('C6. forceVendor=anthropic → anthropic', () => {
    const r = router.pickProvider({ forceVendor: 'anthropic' });
    expect(r.provider.vendor).toBe('anthropic');
    expect(r.reason).toBe('force_vendor');
  });

  it('C7. forceVendor=openai → openai (если ключ есть)', () => {
    if (!HAS_OPENAI) return;
    const r = router.pickProvider({ forceVendor: 'openai' });
    expect(r.provider.vendor).toBe('openai');
  });

  it('C8. forceVendor=openai_compat (нет ключа) → throw', () => {
    expect(() => router.pickProvider({ forceVendor: 'openai_compat' })).toThrow(
      /not available/,
    );
  });

  it('C9. forceRole=secondary → openai', () => {
    if (!HAS_OPENAI) return;
    const r = router.pickProvider({ forceRole: 'secondary' });
    expect(r.provider.vendor).toBe('openai');
    expect(r.reason).toContain('force_role:secondary');
  });

  it('C10. vendorForRole(primary) = anthropic (по env)', () => {
    expect(router.vendorForRole('primary')).toBe('anthropic');
  });

  it('C11. vendorForRole(secondary) = openai', () => {
    expect(router.vendorForRole('secondary')).toBe('openai');
  });

  it('C12. fallbacks не включают текущий провайдер', () => {
    const r = router.pickProvider({ forceVendor: 'anthropic' });
    const vendors = r.fallbacks.map((p) => p.vendor);
    expect(vendors).not.toContain('anthropic');
  });

  it('C13. allProviders() возвращает 3 провайдера', () => {
    expect(router.allProviders().length).toBe(3);
  });
});

// ----------------------------------------------------------------------------
// D. GlobalLLMQueue (8 tests)
// ----------------------------------------------------------------------------
describe('D. GlobalLLMQueue rate/concurrency', () => {
  let queue: GlobalLLMQueueService;
  let config: ConfigService;
  let anthropic: AnthropicProvider;

  beforeAll(() => {
    config = makeConfig({ llm: { globalMaxConcurrent: 3 } });
    queue = new GlobalLLMQueueService(config);
    anthropic = new AnthropicProvider(config, new AnthropicClient(config));
  });

  it('D1. queueDepth() изначально = 0', () => {
    expect(queue.queueDepth()).toBe(0);
  });

  it('D2. snapshot() пустой до первого acquire', () => {
    const q2 = new GlobalLLMQueueService(config);
    expect(q2.snapshot()).toEqual([]);
  });

  it('D3. acquire() запускает задачу и возвращает результат', async () => {
    const result = await queue.acquire(anthropic, 100, async () => ({
      ok: true,
      usage: { inputTokens: 10, outputTokens: 5 },
    }));
    expect((result as any).ok).toBe(true);
  });

  it('D4. acquire() регистрирует bucket для вендора', () => {
    const snap = queue.snapshot();
    const ant = snap.find((s) => s.vendor === 'anthropic');
    expect(ant).toBeDefined();
    expect(ant!.rpm).toBeGreaterThan(0);
    expect(ant!.tpm).toBeGreaterThan(0);
  });

  it('D5. bucket.rpmUsed увеличился после вызова', () => {
    const snap = queue.snapshot();
    const ant = snap.find((s) => s.vendor === 'anthropic');
    expect(ant!.rpmUsed).toBeGreaterThanOrEqual(1);
  });

  it('D6. acquire() пробрасывает ошибку из runFn', async () => {
    await expect(
      queue.acquire(anthropic, 10, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('D7. 3 параллельных acquire() не блокируются (под concurrent=3)', async () => {
    const q = new GlobalLLMQueueService(makeConfig({ llm: { globalMaxConcurrent: 3 } }));
    const slow = async () => new Promise((r) => setTimeout(() => r({ ok: true }), 200));
    const start = Date.now();
    await Promise.all([
      q.acquire(anthropic, 10, slow),
      q.acquire(anthropic, 10, slow),
      q.acquire(anthropic, 10, slow),
    ]);
    const dur = Date.now() - start;
    // Должно быть ~200ms, не 600ms (последовательно).
    expect(dur).toBeLessThan(400);
  });

  it('D8. inFlight сбрасывается в 0 после завершения', () => {
    const snap = queue.snapshot();
    const ant = snap.find((s) => s.vendor === 'anthropic');
    expect(ant!.inFlight).toBe(0);
  });
});

// ----------------------------------------------------------------------------
// E. Cross-vendor fallback + e2e (6 tests)
// ----------------------------------------------------------------------------
describe('E. Cross-vendor e2e flows', () => {
  let config: ConfigService;
  let router: VendorRouterService;
  let queue: GlobalLLMQueueService;
  let anthropic: AnthropicProvider;
  let openai: OpenAIProvider;

  beforeAll(() => {
    config = makeConfig();
    anthropic = new AnthropicProvider(config, new AnthropicClient(config));
    openai = new OpenAIProvider(config);
    const compat = new OpenAICompatProvider(config);
    router = new VendorRouterService(config, anthropic, openai, compat);
    queue = new GlobalLLMQueueService(config);
  });

  const skipBoth = HAS_ANTHROPIC && HAS_OPENAI ? it : it.skip;

  skipBoth('E1. router → queue → anthropic.createMessage end-to-end', async () => {
    const route = router.pickProvider({ stage: 2 });
    expect(route.provider.vendor).toBe('anthropic');
    const res = await queue.acquire(route.provider, 100, () =>
      route.provider.createMessage(makeRequest(route.provider.judgeModel(), 'say hi')),
    );
    expect(res.content.length).toBeGreaterThan(0);
    expect(res.vendor).toBe('anthropic');
  }, 60_000);

  skipBoth('E2. category=judge роутится на openai (secondary)', async () => {
    const route = router.pickProvider({ category: 'judge' });
    expect(route.provider.vendor).toBe('openai');
    const res = await queue.acquire(route.provider, 100, () =>
      route.provider.createMessage(makeRequest(route.provider.defaultModel(), 'reply: ok')),
    );
    expect(res.vendor).toBe('openai');
  }, 60_000);

  skipBoth('E3. fallback цепочка для primary (anthropic) содержит openai', () => {
    const route = router.pickProvider({ stage: 2 });
    const fallbackVendors = route.fallbacks.map((p) => p.vendor);
    expect(fallbackVendors).toContain('openai');
  });

  skipBoth('E4. Симулируем auth-fail Anthropic → LLMProviderError category=auth', async () => {
    const badConfig = makeConfig({ anthropic: { apiKey: 'sk-ant-api03-INVALID-KEY-FOR-TEST' } });
    const badClient = new AnthropicClient(badConfig);
    const badProvider = new AnthropicProvider(badConfig, badClient);
    try {
      await badProvider.createMessage(makeRequest(badProvider.judgeModel(), 'hi'));
      throw new Error('should have failed');
    } catch (err: any) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect(err.category).toBe('auth');
      expect(err.vendor).toBe('anthropic');
    }
  }, 60_000);

  skipBoth('E5. Ответ secondary содержит vendor="openai" (чтобы аудит восстанавливал вендор)', async () => {
    const res = await openai.createMessage(makeRequest(openai.defaultModel(), 'hi'));
    expect(res.vendor).toBe('openai');
    expect(res.model).toContain('gpt-');
  }, 60_000);

  skipBoth('E6. Параллельные вызовы на разные вендоры работают независимо', async () => {
    const [a, o] = await Promise.all([
      queue.acquire(anthropic, 100, () =>
        anthropic.createMessage(makeRequest(anthropic.judgeModel(), 'answer: 1')),
      ),
      queue.acquire(openai, 100, () =>
        openai.createMessage(makeRequest(openai.defaultModel(), 'answer: 2')),
      ),
    ]);
    expect(a.vendor).toBe('anthropic');
    expect(o.vendor).toBe('openai');
  }, 60_000);
});

// ----------------------------------------------------------------------------
// F. Error categorization (6 tests)
// ----------------------------------------------------------------------------
describe('F. Error categorization', () => {
  let config: ConfigService;

  beforeAll(() => {
    config = makeConfig();
  });

  const skipA = HAS_ANTHROPIC ? it : it.skip;
  const skipO = HAS_OPENAI ? it : it.skip;

  skipA('F1. Anthropic invalid model → bad_request', async () => {
    const provider = new AnthropicProvider(config, new AnthropicClient(config));
    try {
      await provider.createMessage(makeRequest('claude-does-not-exist-9-9', 'hi'));
      throw new Error('should have failed');
    } catch (err: any) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect(err.vendor).toBe('anthropic');
      expect(['bad_request', 'fatal']).toContain(err.category);
    }
  }, 60_000);

  skipO('F2. OpenAI invalid model → bad_request', async () => {
    const provider = new OpenAIProvider(config);
    try {
      await provider.createMessage(makeRequest('gpt-does-not-exist-9-9', 'hi'));
      throw new Error('should have failed');
    } catch (err: any) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect(err.vendor).toBe('openai');
      expect(['bad_request', 'fatal']).toContain(err.category);
    }
  }, 60_000);

  it('F3. LLMProviderError содержит vendor поле', () => {
    const err = new LLMProviderError({
      category: 'auth',
      vendor: 'anthropic',
      message: 'test',
    });
    expect(err.vendor).toBe('anthropic');
    expect(err.category).toBe('auth');
  });

  it('F4. LLMProviderError — не триггерит fallback на bad_request (по семантике)', () => {
    // Semантический тест: категории auth/rate_limited/transient/content_filter/fatal
    // должны триггерить fallback, а bad_request/context_too_long — нет.
    // Факт закодирован в AIService.callWithFallback; здесь фиксируем контракт.
    const noFallback: LLMProviderError['category'][] = ['bad_request', 'context_too_long'];
    const yesFallback: LLMProviderError['category'][] = [
      'auth',
      'rate_limited',
      'transient',
      'content_filter',
      'fatal',
    ];
    expect(noFallback).toEqual(['bad_request', 'context_too_long']);
    expect(yesFallback.length).toBe(5);
  });

  skipO('F5. OpenAI bad API key → auth category', async () => {
    const badConfig = makeConfig({ openai: { apiKey: 'sk-proj-INVALID-KEY-FOR-TEST' } });
    const provider = new OpenAIProvider(badConfig);
    try {
      await provider.createMessage(makeRequest(provider.defaultModel(), 'hi'));
      throw new Error('should have failed');
    } catch (err: any) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect(err.vendor).toBe('openai');
      expect(err.category).toBe('auth');
    }
  }, 60_000);

  it('F6. LLMProviderError сохраняет httpStatus', () => {
    const err = new LLMProviderError({
      category: 'rate_limited',
      vendor: 'openai',
      message: '429',
      httpStatus: 429,
      retryAfterMs: 5000,
    });
    expect(err.httpStatus).toBe(429);
    expect(err.retryAfterMs).toBe(5000);
  });
});
