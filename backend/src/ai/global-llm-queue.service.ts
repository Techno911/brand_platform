import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider, LLMVendor } from './providers/llm-provider.interface';

/**
 * Global LLM Queue — единая точка выхода всех LLM-вызовов BP.
 *
 * Зачем (ответ на ВВ Вани от 17.04.2026):
 *   «В рамках одного API-ключа, сколько сессий возможно за единицу времени.
 *    Если у тебя садится работать несколько клиентов, сколько промтов
 *    можно гонять за раз».
 *
 * Реальный сценарий: 10 клиентов × 2 маркетолога × Stage 1 (~30k input
 * tokens) = 600k TPM. Anthropic tier 3-4 отсекает ≥400k TPM → половина
 * маркетологов видит 429 и злится на Чиркова. Без queue governor — это
 * первый серьёзный инцидент на 2-3 месяце эксплуатации.
 *
 * Устройство:
 *   - Per-vendor token-bucket: RPM (requests/min) + TPM (tokens/min).
 *   - Global concurrency cap (максимум одновременных вызовов поверх всех
 *     вендоров) — защита от burst даже если tokens/min не превышены.
 *   - Queue FIFO per vendor: если slot нет, запрос ждёт в очереди.
 *   - queueDepth() — публичный метод для UI-баннера (сколько впереди).
 *   - headroom() — сколько ещё можно взять (для chip_admin dashboard).
 *
 * Что НЕ делаем (сознательно):
 *   - Не имплементируем распределённый Redis-based queue. BP — 1 backend
 *     instance (reseller 10-30 клиентов, не SaaS для миллионов). In-memory
 *     queue достаточна. При переходе на 2+ instances (не планируется в
 *     MVP) — переключимся на Redis bullmq.
 *   - Не делаем priority queue для тарифов. Premium≠быстрее-в-очереди —
 *     Premium = offline-встреча Чиркова. В очереди все равны.
 */

interface Bucket {
  rpm: number;
  tpm: number;
  /** Текущие requests-per-minute (rolling 60s). */
  rpmWindow: number[]; // timestamps of requests in last 60s
  /** Tokens spent in last 60s (timestamps + amounts). */
  tpmWindow: Array<{ t: number; tokens: number }>;
  /** In-flight requests. */
  inFlight: number;
  /** Ожидающие в очереди. */
  queueDepth: number;
}

@Injectable()
export class GlobalLLMQueueService {
  private readonly logger = new Logger('GlobalLLMQueue');
  private readonly buckets = new Map<LLMVendor, Bucket>();
  private readonly globalMaxConcurrent: number;
  private globalInFlight = 0;
  private globalQueueDepth = 0;

  constructor(private readonly config: ConfigService) {
    this.globalMaxConcurrent = this.config.get<number>('llm.globalMaxConcurrent') ?? 20;
  }

  /**
   * Обёртка вокруг provider.createMessage — проверяет rate limits, ждёт
   * slot, записывает фактические usage после ответа. Важно: `runFn`
   * возвращает LLMResponse (или бросает).
   */
  async acquire<T>(
    provider: LLMProvider,
    estimatedTokens: number,
    runFn: () => Promise<T>,
  ): Promise<T> {
    const vendor = provider.vendor;
    this.ensureBucket(provider);

    // Ждём slot (global concurrent + per-vendor rpm/tpm).
    await this.waitForSlot(vendor, estimatedTokens);

    const b = this.buckets.get(vendor)!;
    b.inFlight += 1;
    this.globalInFlight += 1;
    const now = Date.now();
    b.rpmWindow.push(now);
    b.tpmWindow.push({ t: now, tokens: estimatedTokens });

    try {
      const result = await runFn();
      // Если у нас в руках LLMResponse — адаптируем TPM окно под фактические
      // tokens (а не по оценке). Это уменьшает over-throttling.
      const anyRes = result as any;
      if (anyRes?.usage?.inputTokens != null) {
        const actual = Number(anyRes.usage.inputTokens) + Number(anyRes.usage.outputTokens ?? 0);
        // Заменяем последнее значение TPM окна на actual.
        const last = b.tpmWindow[b.tpmWindow.length - 1];
        if (last) last.tokens = actual;
      }
      return result;
    } finally {
      b.inFlight = Math.max(0, b.inFlight - 1);
      this.globalInFlight = Math.max(0, this.globalInFlight - 1);
      // Periodic cleanup старых timestamps.
      this.pruneWindow(b);
    }
  }

  /** Глобальная очередь: сколько запросов ожидают (UI-баннер). */
  queueDepth(): number {
    return this.globalQueueDepth;
  }

  /** Per-vendor snapshot для chip_admin dashboard. */
  snapshot(): Array<{
    vendor: LLMVendor;
    rpm: number;
    tpm: number;
    rpmUsed: number;
    tpmUsed: number;
    inFlight: number;
    queueDepth: number;
  }> {
    const out: ReturnType<GlobalLLMQueueService['snapshot']> = [];
    for (const [vendor, b] of this.buckets) {
      this.pruneWindow(b);
      out.push({
        vendor,
        rpm: b.rpm,
        tpm: b.tpm,
        rpmUsed: b.rpmWindow.length,
        tpmUsed: b.tpmWindow.reduce((a, x) => a + x.tokens, 0),
        inFlight: b.inFlight,
        queueDepth: b.queueDepth,
      });
    }
    return out;
  }

  private ensureBucket(provider: LLMProvider): void {
    if (this.buckets.has(provider.vendor)) return;
    const { rpm, tpm } = provider.rateLimits();
    this.buckets.set(provider.vendor, {
      rpm,
      tpm,
      rpmWindow: [],
      tpmWindow: [],
      inFlight: 0,
      queueDepth: 0,
    });
  }

  private async waitForSlot(vendor: LLMVendor, estimatedTokens: number): Promise<void> {
    const b = this.buckets.get(vendor)!;
    let waited = 0;
    const maxWaitMs = 60_000; // minute — если не освободилось, fail-fast
    const step = 250;

    b.queueDepth += 1;
    this.globalQueueDepth += 1;
    try {
      while (true) {
        this.pruneWindow(b);
        const rpmOk = b.rpmWindow.length < b.rpm;
        const tpmProjected = b.tpmWindow.reduce((a, x) => a + x.tokens, 0) + estimatedTokens;
        const tpmOk = tpmProjected <= b.tpm;
        const globalOk = this.globalInFlight < this.globalMaxConcurrent;
        if (rpmOk && tpmOk && globalOk) return;

        if (waited >= maxWaitMs) {
          throw new Error(
            `LLM queue timeout (${maxWaitMs}ms) for vendor=${vendor}: ` +
              `rpm=${b.rpmWindow.length}/${b.rpm}, tpm_projected=${tpmProjected}/${b.tpm}, ` +
              `global=${this.globalInFlight}/${this.globalMaxConcurrent}`,
          );
        }
        await new Promise((r) => setTimeout(r, step));
        waited += step;
      }
    } finally {
      b.queueDepth = Math.max(0, b.queueDepth - 1);
      this.globalQueueDepth = Math.max(0, this.globalQueueDepth - 1);
    }
  }

  private pruneWindow(b: Bucket): void {
    const cutoff = Date.now() - 60_000;
    while (b.rpmWindow.length > 0 && b.rpmWindow[0] < cutoff) b.rpmWindow.shift();
    while (b.tpmWindow.length > 0 && b.tpmWindow[0].t < cutoff) b.tpmWindow.shift();
  }
}
