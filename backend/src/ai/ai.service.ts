import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { Project } from '../projects/project.entity';
import { PromptLoaderService } from './prompt-loader.service';
import { KnowledgeLoaderService } from './knowledge-loader.service';
import { CostCalculatorService } from './cost-calculator.service';
import { RoundtripLimiterService } from './roundtrip-limiter.service';
import { PromptRunService } from '../observability/prompt-run.service';
import { PromptRunKind } from '../observability/prompt-run.entity';
import { MetricsService } from '../observability/metrics.service';
import { AuditService } from '../observability/audit.service';
import { BriefSanitizerService } from '../security/brief-sanitizer.service';
import { ToolCallSandboxService } from '../security/tool-call-sandbox.service';
import { SecurityEventsService } from '../security/security-events.service';
import {
  VendorRouterService,
  PromptKindCategory,
  RouteDecision,
} from './vendor-router.service';
import { GlobalLLMQueueService } from './global-llm-queue.service';
import { ProjectBusyService } from './project-busy.service';
import {
  LLMProvider,
  LLMProviderError,
  LLMRequest,
  LLMResponse,
  LLMRole,
  LLMVendor,
} from './providers/llm-provider.interface';

export interface AIInvokeInput {
  projectId: string;
  userId: string;
  kind: PromptRunKind;
  /** Template name in prompts/ directory. Defaults to `kind`. */
  promptName?: string;
  /** Arbitrary variables passed into the prompt template ({{name}} substitution). */
  variables?: Record<string, string | number>;
  /** Raw marketer/owner text to be sanitized before being inlined. */
  userText?: string;
  userTextSource?: 'marketer_input' | 'owner_interview' | 'brief_upload' | 'client_feedback' | 'other';
  /** Override stage for roundtrip limiter (defaults to project.currentStage). */
  stage?: 1 | 2 | 3 | 4;
  /** If true, response is expected to use tool_use; otherwise text. */
  expectTools?: string[];
  /** Force use of judge model (cheap) instead of primary. */
  useJudge?: boolean;
  /** Force a model (applies only to the primary provider attempt). */
  model?: string;
  /** Override default max_tokens. */
  maxOutputTokens?: number;
  /** Roundtrip index (for multi-turn chain). */
  roundtrip?: number;
  /**
   * Категория вызова для VendorRouter. Если указана, перекрывает stage-policy.
   * - 'stage' — судьба-тяжёлая генерация (legend/values/mission/positioning/message)
   * - 'judge' / 'sanity' — LLM-judge (дешёвый tertiary)
   * - 'classify' — borderline-классификация (tertiary)
   * - 'critique' — /critique-message (по умолчанию primary, diversity возможно)
   */
  category?: PromptKindCategory;
  /** Принудительный вендор (для golden-set A/B тестов и /chip_admin диагностики). */
  forceVendor?: LLMVendor;
  /** Принудительная роль (override policy). */
  forceRole?: LLMRole;
}

export interface AIInvokeResult {
  ok: boolean;
  kind: PromptRunKind;
  runId: string;
  text: string | null;
  json: any | null;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  costUsd: number;
  costAdjustedUsd: number;
  costRawUsd: number;
  latencyMs: number;
  retries: number;
  /** True if we short-circuited to a cached identical run (same input hash). */
  cached: boolean;
  /** True if we served graceful-degradation payload instead of calling the LLM. */
  degraded: boolean;
  /** Vendor that фактически обслужил вызов (после возможного fallback'а). */
  vendor?: LLMVendor;
  /** Итоговая модель (может отличаться от input.model при fallback'е). */
  model?: string;
  /** Сколько fallback'ов произошло (0 = primary сработал). */
  fallbackCount?: number;
  /** Rejection reason if ok=false. */
  rejectReason?: string;
  /**
   * ISO-8601 момент, когда LLM-вендор фактически выдал этот контент.
   * При `cached:true` это `prompt_run.created_at` оригинального (живого) вызова —
   * т.е. сильно в прошлом. При `cached:false` это момент «сейчас».
   * Нужно для фронта: честно сообщать маркетологу «черновик из кэша от {date}»
   * вместо обманчивого «Claude подумал за 1 сек» на HTTP round-trip'е по кэшу.
   */
  generatedAt?: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger('AIService');
  private readonly defaultMaxOutputTokens: number;
  private readonly dailyHardCapUsd: number;
  private readonly defaultProjectBudget: number;

  constructor(
    private readonly config: ConfigService,
    private readonly prompts: PromptLoaderService,
    private readonly knowledge: KnowledgeLoaderService,
    private readonly costs: CostCalculatorService,
    private readonly limiter: RoundtripLimiterService,
    private readonly runs: PromptRunService,
    private readonly metrics: MetricsService,
    private readonly audit: AuditService,
    private readonly sanitizer: BriefSanitizerService,
    private readonly toolSandbox: ToolCallSandboxService,
    private readonly securityEvents: SecurityEventsService,
    private readonly vendorRouter: VendorRouterService,
    private readonly llmQueue: GlobalLLMQueueService,
    private readonly projectBusy: ProjectBusyService,
    @InjectRepository(Project) private readonly projectsRepo: Repository<Project>,
  ) {
    this.defaultMaxOutputTokens =
      this.config.get<number>('anthropic.maxOutputTokens') ?? 4096;
    this.dailyHardCapUsd = this.config.get<number>('ai.dailyBudgetHardCapUsd') ?? 50;
    this.defaultProjectBudget = this.config.get<number>('ai.projectDefaultBudgetUsd') ?? 5;
  }

  async invoke(input: AIInvokeInput): Promise<AIInvokeResult> {
    const promptName = input.promptName ?? input.kind.replace(/_/g, '-');

    // Prompt метаданные нужны уже сейчас — для определения maxOutputTokens
    // из frontmatter. Загружаем до всех остальных проверок.
    const tmpl = this.prompts.get(promptName);
    // Приоритет: явный input > frontmatter > глобальный дефолт. Это позволяет
    // промпт-автору задать реалистичный лимит в YAML (см. interview-patterns.md),
    // а вызывающему сервису — переопределить при необходимости.
    const maxOutputTokens =
      input.maxOutputTokens ??
      (typeof tmpl.meta.maxOutputTokens === 'number' ? tmpl.meta.maxOutputTokens : undefined) ??
      this.defaultMaxOutputTokens;

    // --- Load project and check budget ---
    const project = await this.projectsRepo.findOne({ where: { id: input.projectId } });
    if (!project) throw new BadRequestException(`Project not found: ${input.projectId}`);

    // --- Roundtrip limiter ---
    const stage = input.stage ?? project.currentStage ?? 1;
    const lim = this.limiter.tryIncrement(input.projectId, stage);
    if (!lim.allowed) {
      await this.audit.record({
        type: 'ai.call_failed',
        projectId: input.projectId,
        userId: input.userId,
        responsibleUserId: input.userId,
        meta: { reason: 'roundtrip_limit_hit', stage, max: lim.max, count: lim.count, kind: input.kind },
      });
      await this.securityEvents.record({
        type: 'roundtrip_limit_hit',
        severity: 'high',
        projectId: input.projectId,
        userId: input.userId,
        source: 'roundtrip_limiter',
        meta: { stage, count: lim.count, max: lim.max, kind: input.kind },
      });
      return this.rejected(input.kind, 'roundtrip_limit_hit');
    }

    // --- Resolve vendor route (primary + fallback chain) ---
    let route: RouteDecision;
    try {
      route = this.vendorRouter.pickProvider({
        stage,
        category: input.category ?? (input.useJudge ? 'judge' : 'stage'),
        forceVendor: input.forceVendor,
        forceRole: input.forceRole,
      });
    } catch (err: any) {
      this.logger.error(`vendor routing failed: ${err?.message}`);
      await this.audit.record({
        type: 'ai.call_failed',
        projectId: input.projectId,
        userId: input.userId,
        responsibleUserId: input.userId,
        meta: { reason: 'no_vendor_available', message: err?.message, kind: input.kind },
      });
      return this.rejected(input.kind, 'no_vendor_available');
    }

    const primaryProvider = route.provider;
    const model = input.model ?? (input.useJudge ? primaryProvider.judgeModel() : primaryProvider.defaultModel());

    // --- Build prompt (tmpl уже загружен выше для чтения maxOutputTokens) ---
    const systemChunks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [];

    // Cacheable: methodology canon (static, big) — cache_control ephemeral
    const canon = this.knowledge.skill('methodology-canon')?.body;
    if (canon) {
      systemChunks.push({
        type: 'text',
        text: canon,
        cache_control: { type: 'ephemeral' },
      });
    }

    // Industry context + gotchas — cacheable per industry
    const industry = project.industry;
    const ctx = this.knowledge.industryContext(industry);
    const gotchas = this.knowledge.industryGotchas(industry);
    if (ctx) {
      systemChunks.push({
        type: 'text',
        text: `# Industry context: ${industry}\n\n${ctx.body}`,
        cache_control: { type: 'ephemeral' },
      });
    }
    if (gotchas) {
      systemChunks.push({
        type: 'text',
        text: `# Industry gotchas: ${industry}\n\n${gotchas.body}`,
        cache_control: { type: 'ephemeral' },
      });
    }

    // Per-command system (not cacheable since it changes per command)
    systemChunks.push({
      type: 'text',
      text: this.renderTemplate(tmpl.body, { ...(input.variables ?? {}), industry }),
    });

    // --- Sanitize user text ---
    let userContent = '';
    if (input.userText) {
      const sanitized = await this.sanitizer.sanitize(input.userText, {
        projectId: input.projectId,
        userId: input.userId,
        source: input.userTextSource ?? 'marketer_input',
      });
      if (sanitized.rejected) {
        this.metrics.promptInjections.inc({ severity: 'high' });
        await this.audit.record({
          type: 'prompt_injection_detected',
          projectId: input.projectId,
          userId: input.userId,
          meta: { reason: sanitized.rejectReason, hits: sanitized.promptInjectionHits, kind: input.kind },
        });
        // HTTP-level reject: клиенту должно прилететь 400, а не 201 с ok:false.
        // Публичный контракт: на prompt injection возвращаем SECURITY_PROMPT_INJECTION
        // (см. e2e 03-security-hardening). Реджект ДО выбора вендора — неважно,
        // куда бы мы его послали.
        throw new BadRequestException({
          error: 'SECURITY_PROMPT_INJECTION',
          message: `prompt injection detected: ${sanitized.rejectReason ?? 'injection hits'}`,
          hits: sanitized.promptInjectionHits.map((h) => h.pattern),
          sanitizer: 'BriefSanitizerService',
        });
      }
      if (sanitized.piiRedactions.length > 0) {
        this.metrics.promptInjections.inc({ severity: 'low' });
      }
      userContent = sanitized.wrapped;
    } else {
      userContent = `<user_input>\n(пусто)\n</user_input>`;
    }

    const messages: LLMRequest['messages'] = [
      {
        role: 'user',
        content: [{ type: 'text', text: userContent }],
      },
    ];

    // --- Idempotency: hash of input ---
    const canonical = JSON.stringify({
      kind: input.kind,
      model,
      vendor: primaryProvider.vendor,
      promptName,
      promptHash: tmpl.hash,
      industry,
      variables: input.variables ?? {},
      userHash: input.userText ? crypto.createHash('sha256').update(input.userText).digest('hex') : null,
      roundtrip: input.roundtrip ?? 1,
    });
    const inputHash = crypto.createHash('sha256').update(canonical).digest('hex');

    const cached = await this.runs.findLatestByInputHash(inputHash);
    // Защита от cache-poisoning: run со status=completed, но с output_json=null
    // и без tool-calls — это следствие tryExtractJson() провалившего парсинг.
    // Такой run НЕ пригоден как «успешный ответ» — переиспользование приведёт
    // к тому же empty-draft для всех последующих вызовов с тем же inputHash.
    // Для JSON-промптов (interview-patterns, values-draft, message-variants и пр.)
    // отсутствие json = отказ канона, а не «Claude ответил пустотой». Поэтому
    // пропускаем такой cache hit и делаем свежий вызов.
    const cacheIsValid =
      cached &&
      (cached.outputJson !== null || (cached.outputText ?? '').length > 0);
    if (cached && !cacheIsValid) {
      this.logger.warn(
        `skipping invalid cached run ${cached.id.slice(0, 8)} (kind=${input.kind}, status=${cached.status}, json=null, text=empty)`,
      );
    }
    if (cached && cacheIsValid) {
      this.logger.log(`cache hit on inputHash ${inputHash.slice(0, 8)} for ${input.kind}`);
      return {
        ok: true,
        kind: input.kind,
        runId: cached.id,
        text: cached.outputText ?? null,
        json: cached.outputJson ?? null,
        stopReason: cached.stopReason,
        usage: {
          inputTokens: cached.inputTokens,
          outputTokens: cached.outputTokens,
          cacheReadInputTokens: cached.cacheReadInputTokens,
          cacheCreationInputTokens: cached.cacheCreationInputTokens,
        },
        costUsd: Number(cached.costUsd),
        costAdjustedUsd: Number(cached.costUsd),
        costRawUsd: Number(cached.costUsd),
        latencyMs: cached.providerLatencyMs,
        retries: cached.retryCount,
        cached: true,
        degraded: false,
        vendor: primaryProvider.vendor,
        model: cached.model,
        fallbackCount: 0,
        generatedAt: cached.createdAt.toISOString(),
      };
    }

    // --- Pre-flight budget kill-switch ---
    const systemText = systemChunks.map((c) => c.text).join('\n\n');
    const inputTokensEstimate = primaryProvider.estimateInputTokens(systemText, userContent);
    const pessimisticCost = await this.costs.estimate(model, inputTokensEstimate, maxOutputTokens);

    const projectBudget = Number(project.budgetUsd ?? this.defaultProjectBudget);
    const projectSpent = await this.runs.totalCostUsd(input.projectId);
    if (projectSpent + pessimisticCost > projectBudget) {
      this.metrics.budgetRejections.inc({ command: input.kind });
      await this.audit.record({
        type: 'project.budget_exceeded',
        projectId: input.projectId,
        userId: input.userId,
        responsibleUserId: input.userId,
        meta: {
          projected: projectSpent + pessimisticCost,
          budget: projectBudget,
          kind: input.kind,
          reason: 'project_budget_exceeded',
        },
      });
      return this.rejected(input.kind, 'BUDGET_EXCEEDED');
    }

    const todaySpent = await this.runs.totalCostTodayUsd();
    if (todaySpent + pessimisticCost > this.dailyHardCapUsd) {
      this.metrics.budgetRejections.inc({ command: input.kind });
      await this.audit.record({
        type: 'project.budget_exceeded',
        projectId: input.projectId,
        userId: input.userId,
        responsibleUserId: input.userId,
        meta: {
          projected: todaySpent + pessimisticCost,
          dailyCap: this.dailyHardCapUsd,
          kind: input.kind,
          reason: 'daily_hard_cap_exceeded',
        },
      });
      return this.rejected(input.kind, 'DAILY_CAP_EXCEEDED');
    }

    // --- Start prompt_run row ---
    const routingDecisionStr = `${route.role}:${primaryProvider.vendor}:${route.reason}`;
    const run = await this.runs.start({
      projectId: input.projectId,
      initiatedBy: input.userId,
      kind: input.kind,
      model,
      inputHash,
      roundtrip: input.roundtrip ?? 1,
      routingDecision: routingDecisionStr,
    });

    // --- Call LLM inside per-project lock + global queue, with vendor fallback ---
    let callResult:
      | {
          resp: LLMResponse;
          usedProvider: LLMProvider;
          usedModel: string;
          fallbackCount: number;
        }
      | null = null;
    let callError: { code: string; message: string } | null = null;

    try {
      callResult = await this.projectBusy.withLock(input.projectId, () =>
        this.callWithFallback({
          route,
          baseRequest: {
            model, // будет переопределено на fallback-провайдере
            system: systemChunks,
            messages,
            maxOutputTokens,
            // NB: temperature НЕ задаём на уровне AIService — новые reasoning-модели
            // Anthropic (claude-opus-4-7, sonnet-4-5) отклоняют параметр как deprecated.
            // Каждый провайдер сам применяет свой дефолт (OpenAI/compat → 0.7, Anthropic → skip).
            // Для judge-моделей OpenAI/compat унаследуют свой 0.7 — это допустимая
            // погрешность, JSON-classifier стабилен при 0.7.
            metadata: { user_id: input.userId },
          },
          estimatedTokens: inputTokensEstimate,
          userForcedModel: input.model,
          useJudge: !!input.useJudge,
          input,
          runId: run.id,
        }),
      );
    } catch (err: any) {
      // Либо PROJECT_BUSY (ConflictException — пробрасываем), либо LLMProviderError, либо другое.
      if (err?.response?.error === 'PROJECT_BUSY') {
        // Обновим prompt_run и пробросим — контроллер отдаст 409.
        await this.runs.finish({
          id: run.id,
          status: 'failed',
          errorCode: 'PROJECT_BUSY',
          crashReason: 'another generation in progress for this project',
        });
        throw err;
      }
      if (err instanceof LLMProviderError) {
        callError = { code: `${err.vendor}:${err.category}`, message: err.message };
      } else {
        callError = { code: 'unknown', message: err?.message ?? 'unknown error' };
      }
    }

    if (!callResult) {
      const code = callError?.code ?? 'unknown';
      await this.runs.finish({
        id: run.id,
        status: 'failed',
        errorCode: code,
        crashReason: (callError?.message ?? '').slice(0, 250),
      });
      this.metrics.anthropicCalls.inc({ command: input.kind, model, status: 'failed' });
      await this.audit.record({
        type: 'ai.call_failed',
        projectId: input.projectId,
        userId: input.userId,
        responsibleUserId: input.userId,
        meta: {
          kind: input.kind,
          errorCode: code,
          message: callError?.message,
          routing: routingDecisionStr,
        },
      });
      return this.degraded(input.kind, run.id, `llm_failed:${code}`);
    }

    const { resp, usedProvider, usedModel, fallbackCount } = callResult;

    // --- Extract text & tool-use ---
    const textParts = resp.content.filter((c) => c.type === 'text').map((c) => c.text ?? '');
    const toolCalls = resp.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({ name: c.name ?? '', input: c.input ?? {} }));

    // --- Structured JSON extraction из plain-text ответа ---
    // Многие промпты (interview-patterns, values-draft, message-variants) требуют
    // JSON-only ответ, но Claude Opus/Sonnet иногда оборачивают его в ```json ... ```
    // или добавляют префикс. Парсим ЗДЕСЬ один раз, кладём в .json — потребители
    // (wizard/stages/*, exporter, golden-set) получают распарсенную структуру без
    // собственных tryParse-хелперов. Если tool_use был — он приоритетнее.
    const joinedText = textParts.join('\n');
    const extractedJson =
      toolCalls.length > 0 ? null : this.tryExtractJson(joinedText);

    // Sandbox tool calls
    if (toolCalls.length > 0) {
      const val = await this.toolSandbox.validate(toolCalls, {
        projectId: input.projectId,
        userId: input.userId,
        command: input.kind,
      });
      if (!val.allowed) {
        for (const name of toolCalls.filter((t) => !this.toolSandbox.list().includes(t.name)).map((t) => t.name)) {
          this.metrics.toolCallRejected.inc({ tool: name });
        }
        await this.runs.finish({
          id: run.id,
          status: 'failed',
          errorCode: 'tool_not_whitelisted',
          crashReason: val.rejectedReasons.join('; '),
          permissionDenied: true,
        });
        await this.audit.record({
          type: 'tool_call_rejected',
          projectId: input.projectId,
          userId: input.userId,
          meta: { kind: input.kind, rejected: val.rejectedReasons, vendor: usedProvider.vendor },
        });
        return this.rejected(input.kind, 'tool_not_whitelisted');
      }
    }

    // --- Cost calc & finish ---
    const cost = await this.costs.compute(usedModel, resp.usage);
    await this.runs.finish({
      id: run.id,
      status: 'completed',
      inputTokens: resp.usage.inputTokens,
      outputTokens: resp.usage.outputTokens,
      cacheReadInputTokens: resp.usage.cacheReadInputTokens,
      cacheCreationInputTokens: resp.usage.cacheCreationInputTokens,
      stopReason: resp.stopReason,
      providerLatencyMs: resp.latencyMs,
      retryCount: resp.retries,
      costUsd: cost.finalUsd,
      outputText: joinedText,
      outputJson:
        toolCalls.length > 0
          ? { toolCalls }
          : extractedJson !== null
          ? extractedJson
          : null,
      cacheHit: resp.usage.cacheReadInputTokens > 0,
    });

    this.metrics.anthropicCalls.inc({ command: input.kind, model: usedModel, status: 'completed' });
    this.metrics.anthropicLatency.observe(
      { command: input.kind, model: usedModel },
      resp.latencyMs / 1000,
    );
    this.metrics.anthropicCost.inc({ command: input.kind, model: usedModel }, cost.finalUsd);
    this.metrics.anthropicTokens.inc({ command: input.kind, model: usedModel, kind: 'input' }, resp.usage.inputTokens);
    this.metrics.anthropicTokens.inc({ command: input.kind, model: usedModel, kind: 'output' }, resp.usage.outputTokens);
    this.metrics.anthropicTokens.inc({ command: input.kind, model: usedModel, kind: 'cache_read' }, resp.usage.cacheReadInputTokens);
    this.metrics.anthropicTokens.inc({ command: input.kind, model: usedModel, kind: 'cache_creation' }, resp.usage.cacheCreationInputTokens);
    if (resp.retries > 0) {
      this.metrics.anthropicRetries.inc({ command: input.kind, reason: 'transient' }, resp.retries);
    }

    // Increment project spend
    await this.projectsRepo.increment({ id: input.projectId }, 'spentUsd', cost.finalUsd);

    await this.audit.record({
      type: 'ai.call_completed',
      projectId: input.projectId,
      userId: input.userId,
      generatedBy: `${usedProvider.vendor}:${usedModel}`,
      responsibleUserId: input.userId,
      meta: {
        kind: input.kind,
        vendor: usedProvider.vendor,
        model: usedModel,
        costUsd: cost.finalUsd,
        inputTokens: resp.usage.inputTokens,
        outputTokens: resp.usage.outputTokens,
        cacheHit: resp.usage.cacheReadInputTokens > 0,
        fallbackCount,
        routing: routingDecisionStr,
      },
    });

    return {
      ok: true,
      kind: input.kind,
      runId: run.id,
      text: joinedText,
      json:
        toolCalls.length > 0
          ? { toolCalls }
          : extractedJson !== null
          ? extractedJson
          : null,
      stopReason: resp.stopReason,
      usage: resp.usage,
      costUsd: cost.finalUsd,
      costAdjustedUsd: cost.adjustedUsd,
      costRawUsd: cost.rawUsd,
      latencyMs: resp.latencyMs,
      retries: resp.retries,
      cached: false,
      degraded: false,
      vendor: usedProvider.vendor,
      model: usedModel,
      fallbackCount,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Попытаться вызвать primary провайдера; при fallback-классе ошибки —
   * попробовать fallback chain. Категории, которые НЕ триггерят fallback:
   *   - bad_request / context_too_long — проблема в промпте / входе,
   *     другой вендор не поможет (скорее ухудшит).
   * Остальные (auth / rate_limited после исчерпания retries / transient /
   * content_filter / fatal) — триггерят fallback. Это антихрупкость:
   * Anthropic заблокирован в РФ через CloudFlare? → автоматический fallback
   * на OpenAI. DeepSeek под DDoS? → следующий в цепочке.
   */
  private async callWithFallback(params: {
    route: RouteDecision;
    baseRequest: LLMRequest;
    estimatedTokens: number;
    userForcedModel?: string;
    useJudge: boolean;
    input: AIInvokeInput;
    runId: string;
  }): Promise<{
    resp: LLMResponse;
    usedProvider: LLMProvider;
    usedModel: string;
    fallbackCount: number;
  }> {
    const { route, baseRequest, estimatedTokens, userForcedModel, useJudge, input } = params;
    const tryProviders: LLMProvider[] = [route.provider, ...route.fallbacks];
    let lastErr: LLMProviderError | null = null;

    for (let i = 0; i < tryProviders.length; i++) {
      const provider = tryProviders[i];
      // input.model применяется только к primary; fallback'и используют
      // свою defaultModel (user'ская модель может не существовать у них).
      const model =
        i === 0 && userForcedModel
          ? userForcedModel
          : useJudge
          ? provider.judgeModel()
          : provider.defaultModel();

      try {
        const resp = await this.llmQueue.acquire(provider, estimatedTokens, () =>
          provider.createMessage({
            ...baseRequest,
            model,
          }),
        );

        if (i > 0) {
          // Успешный fallback — ауидт.
          await this.audit.record({
            type: 'vendor_fallback_triggered',
            projectId: input.projectId,
            userId: input.userId,
            responsibleUserId: input.userId,
            meta: {
              kind: input.kind,
              from: route.provider.vendor,
              to: provider.vendor,
              reason: lastErr?.category ?? 'unknown',
              fromModel: route.provider.defaultModel(),
              toModel: model,
              hop: i,
            },
          });
          await this.securityEvents.record({
            type: 'vendor_fallback_triggered',
            severity: 'medium',
            projectId: input.projectId,
            userId: input.userId,
            source: 'vendor_router',
            meta: {
              kind: input.kind,
              from: route.provider.vendor,
              to: provider.vendor,
              reason: lastErr?.category ?? 'unknown',
              hop: i,
            },
          });
        }
        return { resp, usedProvider: provider, usedModel: model, fallbackCount: i };
      } catch (err: any) {
        const perr = err instanceof LLMProviderError ? err : null;
        lastErr = perr;

        // Client-side problems — NO fallback (другой вендор тоже завалится).
        if (
          perr &&
          (perr.category === 'bad_request' || perr.category === 'context_too_long')
        ) {
          throw perr;
        }

        this.logger.warn(
          `provider ${provider.vendor} failed (${perr?.category ?? 'unknown'}): ` +
            `${perr?.message ?? err?.message}. ` +
            (i + 1 < tryProviders.length
              ? `Falling back to ${tryProviders[i + 1].vendor} (${i + 1}/${tryProviders.length - 1})`
              : 'No more fallbacks.'),
        );
        // continue to next vendor
      }
    }

    // All providers exhausted
    if (lastErr) throw lastErr;
    throw new Error('no provider succeeded');
  }

  /** Graceful degradation payload — lets wizard continue with manual fill. */
  private degraded(kind: PromptRunKind, runId: string, reason: string): AIInvokeResult {
    // WARN-лог обязателен: без него отказы LLM-вызова невидимы в tail /tmp/bp-backend.log —
    // виден только HTTP 201, как будто всё ок. См. reflection «2026-04-19 — Silent rejection»:
    // именно на этом молчании ранее терялся один класс багов (empty-draft на Stage 1).
    this.logger.warn(`degraded ${kind} run=${runId} reason=${reason}`);
    return {
      ok: false,
      kind,
      runId,
      text: null,
      json: null,
      stopReason: null,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      costUsd: 0,
      costAdjustedUsd: 0,
      costRawUsd: 0,
      latencyMs: 0,
      retries: 0,
      cached: false,
      degraded: true,
      rejectReason: reason,
    };
  }

  private rejected(kind: PromptRunKind, reason: string): AIInvokeResult {
    // См. комментарий в degraded() — без этой строки BUDGET_EXCEEDED, roundtrip_limit_hit,
    // DAILY_CAP_EXCEEDED, no_vendor_available, tool_not_whitelisted возвращаются молча.
    // Для маркетолога это выглядит как «извлечение прошло, но Claude ничего не нашёл»,
    // потому что frontend раньше слепо рендерил DraftEmpty при ok:false.
    this.logger.warn(`rejected ${kind} reason=${reason}`);
    return {
      ok: false,
      kind,
      runId: '',
      text: null,
      json: null,
      stopReason: null,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
      costUsd: 0,
      costAdjustedUsd: 0,
      costRawUsd: 0,
      latencyMs: 0,
      retries: 0,
      cached: false,
      degraded: false,
      rejectReason: reason,
    };
  }

  private renderTemplate(body: string, vars: Record<string, string | number>): string {
    return body.replace(/\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g, (_m, name) => {
      const v = vars?.[name];
      if (v === undefined || v === null) return '';
      return String(v);
    });
  }

  /**
   * Достать JSON-структуру из произвольного текстового ответа LLM.
   * Claude/OpenAI/DeepSeek даже при инструкции "только JSON" периодически
   * оборачивают ответ в ```json ... ``` или добавляют префикс "Вот результат:".
   *
   * Порядок попыток:
   *  1. `JSON.parse(text)` как есть (идеальный кейс).
   *  2. Первый fenced-блок ```json ... ``` или ``` ... ```.
   *  3. Подстрока от первой `{` до последней `}` (для JSON-объектов) — покрывает
   *     случай "Prefix: {...} тут ещё что-то".
   *  4. Подстрока от первой `[` до последней `]` (для JSON-массивов).
   *
   * Возвращает распарсенный объект/массив или null — caller решает что делать
   * (обычно фолбэк на .text).
   */
  private tryExtractJson(text: string | null | undefined): any | null {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const attempts: string[] = [trimmed];

    // ```json ... ``` или ``` ... ```
    const fence = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (fence?.[1]) attempts.push(fence[1].trim());

    // {...}-объект
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
    }

    // [...]-массив
    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      attempts.push(trimmed.slice(firstBracket, lastBracket + 1));
    }

    for (const a of attempts) {
      try {
        const parsed = JSON.parse(a);
        // Валидный JSON может быть object/array/primitive. Возвращаем
        // только object/array — primitives нерелевантны для нашего домена.
        if (parsed && (Array.isArray(parsed) || typeof parsed === 'object')) {
          return parsed;
        }
      } catch {
        // следующая попытка
      }
    }
    return null;
  }
}
