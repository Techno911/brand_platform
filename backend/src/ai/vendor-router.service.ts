import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenAICompatProvider } from './providers/openai-compat.provider';
import {
  LLMProvider,
  LLMRole,
  LLMVendor,
} from './providers/llm-provider.interface';

export type PromptKindCategory = 'stage' | 'judge' | 'classify' | 'critique' | 'sanity';

export interface RouteDecision {
  provider: LLMProvider;
  role: LLMRole;
  /** Список fallback провайдеров в порядке приоритета (без текущего). */
  fallbacks: LLMProvider[];
  /** Причина выбора — для аудита. */
  reason: string;
}

export interface RouteRequest {
  /** 1..4 — стадия wizard'а. */
  stage?: 1 | 2 | 3 | 4;
  /** Категория: stage = судьба-тяжёлая генерация; judge/classify/sanity — LLM-judge. */
  category?: PromptKindCategory;
  /** Принудительный вендор (для тестов / A/B). */
  forceVendor?: LLMVendor;
  /** Принудительная роль (override policy). */
  forceRole?: LLMRole;
}

/**
 * VendorRouter — центральная точка выбора LLM-провайдера.
 *
 * Политика (configurable через env):
 *   - Stage 2/3/4 (legend, values, mission, positioning, tests) → primary.
 *     Это judgment-heavy методологические шаги; экономить на них нельзя,
 *     иначе качество output'а падает, golden-set регрессия растёт.
 *   - Stage 1 (паттерны интервью) → primary по умолчанию, но можно
 *     удешевить через LLM_STAGE_POLICY=1:tertiary.
 *   - judge/classify/sanity/critique → tertiary (DeepSeek/Qwen/GLM —
 *     дешёвые, подходят для «разметки» output'а).
 *
 * Fallback chain: если primary недоступен (auth_fail / провайдер-down /
 * rate_limited после исчерпания retries), ротация по fallback_chain. Каждый
 * fallback зафиксирован в prompt_run.routing_decision + audit_events
 * «vendor_fallback_triggered».
 *
 * Provider availability: `isAvailable()` проверяется на старте. Провайдеры
 * без ключа пропускаются — fallback автоматически. Это не ошибка: BP может
 * быть настроен на один вендор (Anthropic only) — остальные просто нет в
 * fallback chain.
 */
@Injectable()
export class VendorRouterService {
  private readonly logger = new Logger('VendorRouter');
  private readonly providers: Record<LLMVendor, LLMProvider>;
  private readonly primaryRole: LLMVendor;
  private readonly secondaryRole: LLMVendor;
  private readonly tertiaryRole: LLMVendor;
  private readonly stagePolicy: Map<number, LLMRole>;
  private readonly judgePolicy: LLMRole;
  private readonly classifyPolicy: LLMRole;
  private readonly fallbackChain: LLMVendor[];

  constructor(
    private readonly config: ConfigService,
    private readonly anthropic: AnthropicProvider,
    private readonly openai: OpenAIProvider,
    private readonly openaiCompat: OpenAICompatProvider,
  ) {
    this.providers = {
      anthropic: this.anthropic,
      openai: this.openai,
      openai_compat: this.openaiCompat,
    };

    this.primaryRole = (this.config.get<string>('llm.primary') ?? 'anthropic') as LLMVendor;
    this.secondaryRole = (this.config.get<string>('llm.secondary') ?? 'openai') as LLMVendor;
    this.tertiaryRole = (this.config.get<string>('llm.tertiary') ?? 'openai_compat') as LLMVendor;

    this.stagePolicy = this.parseStagePolicy(
      this.config.get<string>('llm.stagePolicy') ?? '1:primary,2:primary,3:primary,4:primary',
    );
    this.judgePolicy = (this.config.get<string>('llm.judgePolicy') ?? 'tertiary') as LLMRole;
    this.classifyPolicy = (this.config.get<string>('llm.classifyPolicy') ?? 'tertiary') as LLMRole;

    const rawChain = (this.config.get<string>('llm.fallbackChain') ?? 'anthropic,openai,openai_compat')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as LLMVendor[];
    this.fallbackChain = rawChain;

    this.logAvailability();
  }

  private logAvailability(): void {
    const status = Object.entries(this.providers)
      .map(([k, p]) => `${k}=${p.isAvailable() ? 'ok' : 'no-key'}`)
      .join(', ');
    this.logger.log(
      `vendors: ${status}; primary=${this.primaryRole}, secondary=${this.secondaryRole}, tertiary=${this.tertiaryRole}`,
    );
    this.logger.log(`fallback chain: [${this.fallbackChain.join(' → ')}]`);
  }

  private parseStagePolicy(raw: string): Map<number, LLMRole> {
    const map = new Map<number, LLMRole>();
    for (const part of raw.split(',')) {
      const [k, v] = part.split(':').map((s) => s.trim());
      const stage = Number(k);
      if (stage >= 1 && stage <= 4 && (v === 'primary' || v === 'secondary' || v === 'tertiary')) {
        map.set(stage, v);
      }
    }
    for (let s = 1; s <= 4; s++) if (!map.has(s)) map.set(s, 'primary');
    return map;
  }

  /** Резолв роли в вендора. */
  vendorForRole(role: LLMRole): LLMVendor {
    if (role === 'primary') return this.primaryRole;
    if (role === 'secondary') return this.secondaryRole;
    return this.tertiaryRole;
  }

  getProvider(vendor: LLMVendor): LLMProvider {
    return this.providers[vendor];
  }

  /**
   * Выбрать провайдера по запросу. Возвращает LLMProvider + fallback chain
   * (без текущего provider'а — список для retry при vendor_down).
   */
  pickProvider(req: RouteRequest): RouteDecision {
    if (req.forceVendor) {
      const p = this.providers[req.forceVendor];
      if (!p || !p.isAvailable()) {
        throw new Error(`forceVendor ${req.forceVendor} not available`);
      }
      return {
        provider: p,
        role: this.roleForVendor(req.forceVendor),
        fallbacks: this.buildFallbacks(req.forceVendor),
        reason: 'force_vendor',
      };
    }

    let role: LLMRole;
    let reason: string;
    if (req.forceRole) {
      role = req.forceRole;
      reason = `force_role:${role}`;
    } else if (req.category === 'judge' || req.category === 'sanity') {
      role = this.judgePolicy;
      reason = `judge_policy:${role}`;
    } else if (req.category === 'classify') {
      role = this.classifyPolicy;
      reason = `classify_policy:${role}`;
    } else if (req.category === 'critique') {
      // Критика — между judgment и judge. По умолчанию primary, но можно
      // отдать secondary для diversity opinion.
      role = 'primary';
      reason = 'critique_policy:primary';
    } else if (req.stage) {
      role = this.stagePolicy.get(req.stage) ?? 'primary';
      reason = `stage_${req.stage}_policy:${role}`;
    } else {
      role = 'primary';
      reason = 'default_primary';
    }

    // Пройти по цепочке от выбранной роли, пока не найдём доступный.
    const preferredVendor = this.vendorForRole(role);
    const preferred = this.providers[preferredVendor];
    if (preferred.isAvailable()) {
      return {
        provider: preferred,
        role,
        fallbacks: this.buildFallbacks(preferredVendor),
        reason,
      };
    }

    // Fallback: найти первый доступный из fallback chain.
    for (const v of this.fallbackChain) {
      if (v === preferredVendor) continue;
      const p = this.providers[v];
      if (p?.isAvailable()) {
        this.logger.warn(
          `preferred vendor ${preferredVendor} unavailable (no key), falling back to ${v}`,
        );
        return {
          provider: p,
          role: this.roleForVendor(v),
          fallbacks: this.buildFallbacks(v),
          reason: `${reason}+fallback:${preferredVendor}_unavailable`,
        };
      }
    }

    throw new Error(
      `no LLM provider available (checked: ${this.fallbackChain.join(', ')}). ` +
        `Проверь env: ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENAI_COMPAT_API_KEY.`,
    );
  }

  private roleForVendor(vendor: LLMVendor): LLMRole {
    if (vendor === this.primaryRole) return 'primary';
    if (vendor === this.secondaryRole) return 'secondary';
    return 'tertiary';
  }

  /** Построить fallback-цепочку (без current vendor). */
  private buildFallbacks(current: LLMVendor): LLMProvider[] {
    const chain: LLMProvider[] = [];
    for (const v of this.fallbackChain) {
      if (v === current) continue;
      const p = this.providers[v];
      if (p?.isAvailable()) chain.push(p);
    }
    return chain;
  }

  /** Список всех провайдеров (для метрик / health). */
  allProviders(): LLMProvider[] {
    return Object.values(this.providers);
  }
}
