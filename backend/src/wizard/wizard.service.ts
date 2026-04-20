import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Row, RowType, RowStatus, SheetNumber } from './row.entity';
import { Draft, DraftSource } from './draft.entity';
import { ValidatorService } from '../validator/validator.service';
import { WizardStepEventsService } from '../observability/wizard-step-events.service';
import { MetricsService } from '../observability/metrics.service';
import { MarketerQualityService } from '../observability/marketer-quality.service';
import { WizardStepEvent } from '../observability/wizard-step-event.entity';

@Injectable()
export class WizardService {
  constructor(
    @InjectRepository(Row) private readonly rows: Repository<Row>,
    @InjectRepository(Draft) private readonly drafts: Repository<Draft>,
    private readonly validator: ValidatorService,
    private readonly wizardEvents: WizardStepEventsService,
    private readonly metrics: MetricsService,
    private readonly marketerQuality: MarketerQualityService,
  ) {}

  async createRow(
    projectId: string,
    sheet: SheetNumber,
    type: RowType,
    payload: Record<string, any>,
    orderIndex = 0,
  ) {
    const row = this.rows.create({
      projectId,
      sheet,
      type,
      payload,
      orderIndex,
      status: 'planned' as RowStatus,
    });
    return this.rows.save(row);
  }

  listRows(projectId: string, sheet?: SheetNumber) {
    const where: any = { projectId };
    if (sheet !== undefined) where.sheet = sheet;
    return this.rows.find({ where, order: { sheet: 'ASC', orderIndex: 'ASC', createdAt: 'ASC' } });
  }

  async setRowStatus(id: string, status: RowStatus) {
    await this.rows.update(id, { status });
    return this.rows.findOne({ where: { id } });
  }

  async addDraft(
    rowId: string,
    content: Record<string, any>,
    source: DraftSource,
    createdBy?: string,
    promptRunId?: string | null,
  ) {
    const latest = await this.drafts.findOne({
      where: { rowId },
      order: { version: 'DESC' },
    });
    const version = (latest?.version ?? 0) + 1;
    const draft = this.drafts.create({
      rowId,
      version,
      source,
      content,
      promptRunId: promptRunId ?? null,
      createdBy: createdBy ?? null,
      validatorPassed: false,
    });
    return this.drafts.save(draft);
  }

  async validateDraft(
    draftId: string,
    projectId: string,
    artifact: string,
    userId: string,
  ) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) throw new NotFoundException('Draft not found');
    const report = await this.validator.validate({
      projectId,
      userId,
      artifact: artifact as any,
      payload: draft.content,
    });
    draft.trafficLight = report.trafficLight;
    draft.validatorPassed = report.validatorPassed;
    draft.validatorReport = report as any;
    await this.drafts.save(draft);

    // Feed quality score for Korobovtsev dashboard
    const score = report.validatorPassed ? 1 : report.trafficLight === 'yellow' ? 0.5 : 0;
    await this.marketerQuality.record(userId, projectId, artifact, score, {
      regexViolations: report.regex.errors.length,
      llmJudgeFlags: report.judge && !report.judge.passed ? 1 : 0,
      methodologyViolations: report.methodology && !report.methodology.passed ? 1 : 0,
      humanOverrideCount: 0,
    });
    return { draft, report };
  }

  listDraftsByRow(rowId: string) {
    return this.drafts.find({ where: { rowId }, order: { version: 'DESC' } });
  }

  getDraft(id: string) {
    return this.drafts.findOne({ where: { id } });
  }

  async finalizeRow(rowId: string, draftId: string) {
    const draft = await this.drafts.findOne({ where: { id: draftId } });
    if (!draft) throw new NotFoundException('Draft not found');
    if (!draft.validatorPassed && draft.trafficLight !== 'yellow') {
      throw new Error(`Cannot finalize row: draft is ${draft.trafficLight} and validator did not pass`);
    }
    await this.rows.update(rowId, {
      finalized: draft.content,
      status: 'completed' as RowStatus,
    });
    return this.rows.findOne({ where: { id: rowId } });
  }

  // UX telemetry from the frontend (Gorshkov pattern)
  async recordEvent(
    userId: string,
    projectId: string,
    stage: 1 | 2 | 3 | 4,
    event: WizardStepEvent,
    stepKey?: string,
    meta?: Record<string, any>,
  ) {
    this.metrics.wizardEvents.inc({ event, stage: String(stage) });
    return this.wizardEvents.record(userId, projectId, stage, event, stepKey, meta);
  }
}
