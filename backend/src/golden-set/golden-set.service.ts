import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GoldenSetRun, GoldenSetRunStatus } from './golden-set-run.entity';
import { GoldenSetFixturesService } from './golden-set-fixtures.service';
import { ValidatorService } from '../validator/validator.service';
import { AIService } from '../ai/ai.service';
import { AuditService } from '../observability/audit.service';
import { MetricsService } from '../observability/metrics.service';

export interface GoldenSetReport {
  runId: string;
  status: GoldenSetRunStatus;
  promptVersion: string;
  aggregateRegression: number;
  threshold: number;
  perCase: Array<{
    name: string;
    artifact: string;
    similarity: number;
    regression: number;
    passed: boolean;
    rationale?: string;
  }>;
}

/**
 * Walk-Forward style golden-set runner:
 *   - For each case, run the same command used in production.
 *   - Score against expected artefact (simple similarity + validator.passed).
 *   - Regression = 1 - similarity; aggregate = avg regression.
 *   - Fail CI if aggregate > threshold (default 0.15 per INSIGHTS §4 / C-5).
 */
@Injectable()
export class GoldenSetService {
  private readonly logger = new Logger('GoldenSetService');
  private readonly threshold: number;

  constructor(
    @InjectRepository(GoldenSetRun) private readonly repo: Repository<GoldenSetRun>,
    private readonly fixtures: GoldenSetFixturesService,
    private readonly validator: ValidatorService,
    private readonly ai: AIService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly config: ConfigService,
  ) {
    this.threshold = this.config.get<number>('goldenSet.regressionThreshold') ?? 0.15;
  }

  async run(params: {
    promptVersion: string;
    model: string;
    projectId?: string;
    userId?: string;
    commitSha?: string;
    triggeredBy?: string;
    tag?: string;
  }): Promise<GoldenSetReport> {
    const run = await this.repo.save(
      this.repo.create({
        promptVersion: params.promptVersion,
        model: params.model,
        status: 'running' as GoldenSetRunStatus,
        scores: {},
        aggregateRegression: '0',
        threshold: String(this.threshold),
        commitSha: params.commitSha ?? null,
        triggeredBy: params.triggeredBy ?? null,
      }),
    );

    const cases = params.tag ? this.fixtures.listByTag(params.tag) : this.fixtures.list();
    const scores: Record<string, any> = {};
    const perCase: GoldenSetReport['perCase'] = [];
    let regressionSum = 0;

    for (const c of cases) {
      try {
        const report = await this.validator.validate({
          projectId: params.projectId ?? run.id,
          userId: params.userId ?? 'golden-set-runner',
          artifact: c.artifact,
          payload: c.input,
        });
        const similarity = this.computeSimilarity(c.expected, report);
        const regression = Math.max(0, 1 - similarity);
        scores[c.name] = { similarity, regression, passed: report.validatorPassed };
        perCase.push({
          name: c.name,
          artifact: c.artifact,
          similarity,
          regression,
          passed: report.validatorPassed,
          rationale: (report.reasons ?? []).join('; ').slice(0, 300),
        });
        regressionSum += regression;
      } catch (err: any) {
        this.logger.error(`golden case ${c.name} failed: ${err?.message}`);
        scores[c.name] = { similarity: 0, regression: 1, passed: false };
        perCase.push({ name: c.name, artifact: c.artifact, similarity: 0, regression: 1, passed: false, rationale: err?.message });
        regressionSum += 1;
      }
    }

    const aggregate = cases.length > 0 ? regressionSum / cases.length : 0;
    const status: GoldenSetRunStatus = aggregate > this.threshold ? 'failed' : 'passed';
    await this.repo.update(run.id, {
      status,
      scores,
      aggregateRegression: String(aggregate),
      finishedAt: new Date(),
    });

    this.metrics.goldenSetRegression.set({ prompt_version: params.promptVersion }, aggregate);

    await this.audit.record({
      type: 'golden_set.run_completed',
      userId: params.userId ?? null,
      responsibleUserId: params.userId ?? null,
      meta: {
        runId: run.id,
        promptVersion: params.promptVersion,
        aggregateRegression: aggregate,
        threshold: this.threshold,
        cases: cases.length,
        status,
      },
    });

    if (status === 'failed') {
      await this.audit.record({
        type: 'golden_set.regression_detected',
        userId: params.userId ?? null,
        responsibleUserId: params.userId ?? null,
        meta: {
          runId: run.id,
          promptVersion: params.promptVersion,
          aggregateRegression: aggregate,
          threshold: this.threshold,
        },
      });
    }

    return {
      runId: run.id,
      status,
      promptVersion: params.promptVersion,
      aggregateRegression: aggregate,
      threshold: this.threshold,
      perCase,
    };
  }

  /** Simple bag-of-words Jaccard for smoke testing. Production: embeddings similarity. */
  private computeSimilarity(expected: Record<string, any>, actual: any): number {
    const a = new Set(
      String(JSON.stringify(expected ?? {}))
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean),
    );
    const b = new Set(
      String(JSON.stringify(actual ?? {}))
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean),
    );
    if (a.size === 0 && b.size === 0) return 1;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    const union = new Set([...a, ...b]).size;
    return inter / union;
  }

  // История для /admin/golden-set. Сырой entity даёт scores (Record) и
  // aggregateRegression, но фронт рендерит totalCases/passedCases/... —
  // считаем здесь, чтобы фронт не парсил jsonb вручную.
  async history(limit = 50) {
    const runs = await this.repo.find({ order: { startedAt: 'DESC' }, take: limit });
    return runs.map((r) => {
      const scores = (r.scores ?? {}) as Record<string, { passed?: boolean; regression?: number }>;
      const all = Object.values(scores);
      const totalCases = all.length;
      const passedCases = all.filter((s) => s?.passed === true).length;
      const failedCases = totalCases - passedCases;
      const threshold = Number(r.threshold ?? 0.15);
      const aggregate = Number(r.aggregateRegression ?? 0);
      return {
        id: r.id,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        promptVersion: r.promptVersion,
        model: r.model,
        status: r.status,
        totalCases,
        passedCases,
        failedCases,
        regressionDetected: aggregate > threshold,
        thresholdPercent: Math.round(threshold * 100),
      };
    });
  }
}
