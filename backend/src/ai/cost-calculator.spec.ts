import { describe, it, expect, beforeEach } from 'vitest';
import { CostCalculatorService } from './cost-calculator.service';

const makeBillingConfig = (overrides: any = {}) => ({
  get: async () => ({
    anthropicCostFactor: 1.0,
    markupPercent: 50,
    currencyRateUsdRub: 95,
    tokenPricing: {
      'claude-opus-4-7': {
        inputPerMillion: 15,
        outputPerMillion: 75,
        cacheReadPerMillion: 1.5,
        cacheCreationPerMillion: 18.75,
      },
    },
    tariffs: {},
    ...overrides,
  }),
});

describe('CostCalculatorService', () => {
  it('базовый расчёт input+output без кэша', async () => {
    const svc = new CostCalculatorService(makeBillingConfig() as any);
    const r = await svc.compute('claude-opus-4-7', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // raw = 15 + 75 = 90 USD
    expect(r.rawUsd).toBeCloseTo(90, 5);
    expect(r.adjustedUsd).toBeCloseTo(90, 5);
    // final = 90 * 1.5 = 135
    expect(r.finalUsd).toBeCloseTo(135, 5);
  });

  it('cache-read и cache-creation учитываются', async () => {
    const svc = new CostCalculatorService(makeBillingConfig() as any);
    const r = await svc.compute('claude-opus-4-7', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 1_000_000,
      cacheCreationInputTokens: 1_000_000,
    });
    // rawUsd = 1.5 + 18.75 = 20.25
    expect(r.rawUsd).toBeCloseTo(20.25, 5);
  });

  it('anthropic_cost_factor=1.2 увеличивает adjustedUsd', async () => {
    const svc = new CostCalculatorService(
      makeBillingConfig({ anthropicCostFactor: 1.2 }) as any,
    );
    const r = await svc.compute('claude-opus-4-7', { inputTokens: 1_000_000, outputTokens: 0 });
    expect(r.rawUsd).toBeCloseTo(15, 5);
    expect(r.adjustedUsd).toBeCloseTo(18, 5);
  });

  it('markupPercent=100 удваивает final', async () => {
    const svc = new CostCalculatorService(
      makeBillingConfig({ markupPercent: 100 }) as any,
    );
    const r = await svc.compute('claude-opus-4-7', { inputTokens: 1_000_000, outputTokens: 0 });
    expect(r.rawUsd).toBeCloseTo(15, 5);
    expect(r.finalUsd).toBeCloseTo(30, 5);
  });

  it('неизвестная модель → все нули', async () => {
    const svc = new CostCalculatorService(makeBillingConfig() as any);
    const r = await svc.compute('claude-mythical-2030', { inputTokens: 1e9, outputTokens: 1e9 });
    expect(r.rawUsd).toBe(0);
    expect(r.finalUsd).toBe(0);
  });

  it('estimate() = input+max_output кост с markup', async () => {
    const svc = new CostCalculatorService(makeBillingConfig() as any);
    const e = await svc.estimate('claude-opus-4-7', 1_000_000, 1_000_000);
    // raw = 15 + 75 = 90; final = 135
    expect(e).toBeCloseTo(135, 5);
  });

  it('cost_factor + markup мультипликативно', async () => {
    const svc = new CostCalculatorService(
      makeBillingConfig({ anthropicCostFactor: 1.5, markupPercent: 50 }) as any,
    );
    const r = await svc.compute('claude-opus-4-7', { inputTokens: 1_000_000, outputTokens: 0 });
    // raw = 15, adj = 15*1.5 = 22.5, final = 22.5*1.5 = 33.75
    expect(r.finalUsd).toBeCloseTo(33.75, 5);
  });
});
