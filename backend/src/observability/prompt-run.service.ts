import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptRun, PromptRunStatus, PromptRunKind } from './prompt-run.entity';

export interface PromptRunStart {
  projectId?: string | null;
  initiatedBy?: string | null;
  kind: PromptRunKind;
  model: string;
  inputHash: string;
  routingDecision?: string | null;
  roundtrip?: number;
}

export interface PromptRunFinish {
  id: string;
  status: PromptRunStatus;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
  stopReason?: string | null;
  providerLatencyMs?: number;
  retryCount?: number;
  errorCode?: string | null;
  crashReason?: string | null;
  permissionDenied?: boolean;
  costUsd?: number;
  outputText?: string | null;
  outputJson?: any;
  cacheHit?: boolean;
}

@Injectable()
export class PromptRunService {
  private readonly logger = new Logger('PromptRunService');

  constructor(
    @InjectRepository(PromptRun) private readonly repo: Repository<PromptRun>,
  ) {}

  async start(data: PromptRunStart): Promise<PromptRun> {
    const run = this.repo.create({
      projectId: data.projectId ?? null,
      initiatedBy: data.initiatedBy ?? null,
      kind: data.kind,
      model: data.model,
      inputHash: data.inputHash,
      routingDecision: data.routingDecision ?? null,
      roundtrip: data.roundtrip ?? 1,
      status: 'executing',
      retryCount: 0,
      permissionDenied: false,
      cacheHit: false,
    });
    return this.repo.save(run);
  }

  async plan(data: PromptRunStart): Promise<PromptRun> {
    const run = this.repo.create({
      projectId: data.projectId ?? null,
      initiatedBy: data.initiatedBy ?? null,
      kind: data.kind,
      model: data.model,
      inputHash: data.inputHash,
      routingDecision: data.routingDecision ?? null,
      roundtrip: data.roundtrip ?? 1,
      status: 'planned',
    });
    return this.repo.save(run);
  }

  async markExecuting(id: string): Promise<void> {
    await this.repo.update(id, { status: 'executing' });
  }

  async finish(data: PromptRunFinish): Promise<void> {
    try {
      await this.repo.update(data.id, {
        status: data.status,
        inputTokens: data.inputTokens ?? 0,
        outputTokens: data.outputTokens ?? 0,
        cacheReadInputTokens: data.cacheReadInputTokens ?? 0,
        cacheCreationInputTokens: data.cacheCreationInputTokens ?? 0,
        stopReason: data.stopReason ?? null,
        providerLatencyMs: data.providerLatencyMs ?? 0,
        retryCount: data.retryCount ?? 0,
        errorCode: data.errorCode ?? null,
        crashReason: data.crashReason ?? null,
        permissionDenied: data.permissionDenied ?? false,
        costUsd: String(data.costUsd ?? 0),
        outputText: data.outputText ?? null,
        outputJson: data.outputJson ?? null,
        cacheHit: data.cacheHit ?? false,
        finishedAt: new Date(),
      });
    } catch (err: any) {
      this.logger.error(`prompt run finish failed: ${err?.message}`, err?.stack);
    }
  }

  listByProject(projectId: string, limit = 500) {
    return this.repo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Silent failures — Горшков-паттерн. Возвращаем prompt_runs, где:
   *   - status ∈ {failed, budget_exceeded, rate_limited, sanitized_out}, либо
   *   - retryCount >= retryThreshold (timeout-ретраи, которые в итоге прошли,
   *     но их latency/стабильность должна быть видна руководителю).
   *
   * Сортировка DESC по createdAt. Возвращаем prompt_run native-поля
   * (id, kind, status, errorCode, retryCount, providerLatencyMs, createdAt) —
   * фронт рендерит их напрямую без преобразований, см. SilentFailuresPage.
   */
  listSilentFailures(retryThreshold = 3, limit = 500) {
    return this.repo
      .createQueryBuilder('r')
      .where(
        '(r.status IN (:...failedStatuses)) OR (r.retry_count >= :threshold)',
        {
          failedStatuses: [
            'failed',
            'budget_exceeded',
            'rate_limited',
            'sanitized_out',
          ] as PromptRunStatus[],
          threshold: retryThreshold,
        },
      )
      .orderBy('r.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  findLatestByInputHash(inputHash: string) {
    return this.repo.findOne({
      where: { inputHash, status: 'completed' },
      order: { createdAt: 'DESC' },
    });
  }

  /** Aggregate: running spend per project, used by kill-switch. */
  async totalCostUsd(projectId: string): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.cost_usd), 0)', 'total')
      .where('r.project_id = :projectId', { projectId })
      .andWhere('r.status = :status', { status: 'completed' as PromptRunStatus })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  async totalCostTodayUsd(): Promise<number> {
    const row = await this.repo
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.cost_usd), 0)', 'total')
      .where("r.created_at >= date_trunc('day', now())")
      .andWhere('r.status = :status', { status: 'completed' as PromptRunStatus })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }
}
