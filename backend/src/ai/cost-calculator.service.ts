import { Injectable } from '@nestjs/common';
import { BillingConfigService } from '../billing/billing-config.service';

export interface UsageTokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}

export interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  cacheReadUsd: number;
  cacheCreationUsd: number;
  rawUsd: number;
  /** With `anthropic_cost_factor` applied (reseller-adjustable). */
  adjustedUsd: number;
  /** Final price to user = adjusted * (1 + markup). */
  finalUsd: number;
}

/**
 * Reseller cost calculator.
 *   raw_usd = sum(tokens / 1e6 * per-million-price)
 *   adjusted_usd = raw_usd * anthropic_cost_factor   (quarterly-editable by chip_admin)
 *   final_usd = adjusted_usd * (1 + markup_percent/100)
 */
@Injectable()
export class CostCalculatorService {
  constructor(private readonly billingConfig: BillingConfigService) {}

  async compute(model: string, usage: UsageTokens): Promise<CostBreakdown> {
    const cfg = await this.billingConfig.get();
    const pricing = cfg.tokenPricing?.[model];
    if (!pricing) {
      return {
        inputUsd: 0,
        outputUsd: 0,
        cacheReadUsd: 0,
        cacheCreationUsd: 0,
        rawUsd: 0,
        adjustedUsd: 0,
        finalUsd: 0,
      };
    }
    const inputUsd = (usage.inputTokens / 1_000_000) * (pricing.inputPerMillion ?? 0);
    const outputUsd = (usage.outputTokens / 1_000_000) * (pricing.outputPerMillion ?? 0);
    const cacheReadUsd = ((usage.cacheReadInputTokens ?? 0) / 1_000_000) * (pricing.cacheReadPerMillion ?? 0);
    const cacheCreationUsd = ((usage.cacheCreationInputTokens ?? 0) / 1_000_000) * (pricing.cacheCreationPerMillion ?? 0);
    const rawUsd = inputUsd + outputUsd + cacheReadUsd + cacheCreationUsd;
    const factor = Number(cfg.anthropicCostFactor ?? 1);
    const adjustedUsd = rawUsd * factor;
    const markup = Number(cfg.markupPercent ?? 50) / 100;
    const finalUsd = adjustedUsd * (1 + markup);
    return {
      inputUsd,
      outputUsd,
      cacheReadUsd,
      cacheCreationUsd,
      rawUsd,
      adjustedUsd,
      finalUsd,
    };
  }

  /**
   * Pre-flight estimate used by the kill-switch. Returns upper-bound cost
   * assuming max_output_tokens will be fully used (pessimistic).
   */
  async estimate(
    model: string,
    inputTokensEstimate: number,
    maxOutputTokens: number,
  ): Promise<number> {
    const b = await this.compute(model, {
      inputTokens: inputTokensEstimate,
      outputTokens: maxOutputTokens,
    });
    return b.finalUsd;
  }
}
