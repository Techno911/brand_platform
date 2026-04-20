import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingConfig } from './billing-config.entity';
import { AuditService } from '../observability/audit.service';

export interface NormalisedTokenPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheReadPerMillion: number;
  cacheCreationPerMillion: number;
}

export interface NormalisedBillingConfig {
  anthropicCostFactor: number;
  markupPercent: number;
  currencyRateUsdRub: number;
  tokenPricing: Record<string, NormalisedTokenPricing>;
  tariffs: Record<
    string,
    {
      monthlyRub: number;
      includedProjects: number;
      markupPercent: number;
      slaHours: number;
      manualReviewHours: number; // -1 = unlimited
      includesOfflineMeeting: boolean;
    }
  >;
}

/**
 * BillingConfigService — singleton with key='default'.
 * chip_admin edits via UI; every change audited.
 * INSIGHTS §7: anthropic_cost_factor quarterly re-pricing without code changes.
 */
@Injectable()
export class BillingConfigService {
  constructor(
    @InjectRepository(BillingConfig) private readonly repo: Repository<BillingConfig>,
    private readonly audit: AuditService,
  ) {}

  private normalize(cfg: BillingConfig): NormalisedBillingConfig {
    const tokenPricing: Record<string, NormalisedTokenPricing> = {};
    for (const [model, p] of Object.entries(cfg.tokenPricing ?? {})) {
      tokenPricing[model] = {
        inputPerMillion: Number((p as any).input ?? 0),
        outputPerMillion: Number((p as any).output ?? 0),
        cacheReadPerMillion: Number((p as any).cache_read ?? 0),
        cacheCreationPerMillion: Number((p as any).cache_write ?? 0),
      };
    }
    const tariffs: NormalisedBillingConfig['tariffs'] = {};
    for (const [k, t] of Object.entries(cfg.tariffs ?? {})) {
      tariffs[k] = {
        monthlyRub: Number((t as any).monthly_rub ?? 0),
        includedProjects: Number((t as any).included_projects ?? 1),
        markupPercent: Number((t as any).markup_percent ?? 50),
        slaHours: Number((t as any).sla_hours ?? 48),
        manualReviewHours: Number((t as any).manual_review_hours ?? 0),
        includesOfflineMeeting: Boolean((t as any).includes_offline_meeting),
      };
    }
    return {
      anthropicCostFactor: Number(cfg.anthropicCostFactor),
      markupPercent: Number(cfg.markupPercent),
      currencyRateUsdRub: Number(cfg.currencyRateUsdRub),
      tokenPricing,
      tariffs,
    };
  }

  async get(): Promise<NormalisedBillingConfig> {
    const cfg = await this.repo.findOne({ where: { key: 'default' } });
    if (!cfg) {
      throw new NotFoundException('billing_configs[default] row missing — seed migration not run');
    }
    return this.normalize(cfg);
  }

  async raw(): Promise<BillingConfig> {
    const cfg = await this.repo.findOne({ where: { key: 'default' } });
    if (!cfg) {
      throw new NotFoundException('billing_configs[default] row missing');
    }
    return cfg;
  }

  async updateCostFactor(newValue: number, actorUserId: string, reason: string) {
    const cfg = await this.raw();
    const old = Number(cfg.anthropicCostFactor);
    cfg.anthropicCostFactor = String(newValue);
    await this.repo.save(cfg);
    await this.audit.record({
      type: 'anthropic_cost_factor_changed',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { old, new: newValue, reason },
    });
    return this.normalize(cfg);
  }

  async updateMarkup(newPercent: number, actorUserId: string) {
    const cfg = await this.raw();
    const old = Number(cfg.markupPercent);
    cfg.markupPercent = String(newPercent);
    await this.repo.save(cfg);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { field: 'markupPercent', old, new: newPercent },
    });
    return this.normalize(cfg);
  }

  async updateCurrencyRate(rate: number, actorUserId: string) {
    const cfg = await this.raw();
    const old = Number(cfg.currencyRateUsdRub);
    cfg.currencyRateUsdRub = String(rate);
    await this.repo.save(cfg);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { field: 'currencyRateUsdRub', old, new: rate },
    });
    return this.normalize(cfg);
  }

  async updateTariff(
    tariff: string,
    patch: Partial<{
      monthly_rub: number;
      included_projects: number;
      markup_percent: number;
      sla_hours: number;
      manual_review_hours: number;
      includes_offline_meeting: boolean;
    }>,
    actorUserId: string,
  ) {
    const cfg = await this.raw();
    const existing = cfg.tariffs?.[tariff] ?? {};
    const next = { ...existing, ...patch };
    cfg.tariffs = { ...(cfg.tariffs ?? {}), [tariff]: next as any };
    await this.repo.save(cfg);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { tariff, patch },
    });
    return this.normalize(cfg);
  }

  async updateTokenPricing(
    model: string,
    pricing: { input?: number; output?: number; cache_write?: number; cache_read?: number },
    actorUserId: string,
  ) {
    const cfg = await this.raw();
    const existing = cfg.tokenPricing?.[model] ?? { input: 0, output: 0 };
    const next = { ...existing, ...pricing };
    cfg.tokenPricing = { ...(cfg.tokenPricing ?? {}), [model]: next as any };
    await this.repo.save(cfg);
    await this.audit.record({
      type: 'admin.tariff_updated',
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { model, pricing },
    });
    return this.normalize(cfg);
  }
}
