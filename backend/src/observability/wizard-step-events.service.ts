import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WizardStepEvent,
  WizardStepEventRecord,
} from './wizard-step-event.entity';

/** Gorshkov pattern: track UX drop-off, help clicks, marketer stuck. */
@Injectable()
export class WizardStepEventsService {
  constructor(
    @InjectRepository(WizardStepEventRecord)
    private readonly repo: Repository<WizardStepEventRecord>,
  ) {}

  record(
    userId: string,
    projectId: string,
    stage: 1 | 2 | 3 | 4,
    event: WizardStepEvent,
    sheet?: string,
    meta?: Record<string, any>,
  ) {
    return this.repo.save(
      this.repo.create({
        userId,
        projectId,
        stage,
        event,
        sheet: sheet ?? '',
        meta: meta ?? {},
      }),
    );
  }

  listByProject(projectId: string) {
    return this.repo.find({
      where: { projectId },
      order: { recordedAt: 'ASC' },
    });
  }

  // Агрегат для /admin/wizard-dropoff. Группируем по (stage, sheet, event):
  // sheet играет роль stepKey, avgTimeOnStepSec достаётся из meta.timeSec
  // (backend-ивенты пишут это при stage_left/feedback_submitted).
  // Возвращаемый shape совпадает с `DropoffRow` на фронте.
  async dropoffFunnel() {
    const rows = await this.repo
      .createQueryBuilder('e')
      .select('e.stage', 'stage')
      .addSelect('e.sheet', 'stepKey')
      .addSelect('e.event', 'event')
      .addSelect('COUNT(*)', 'cnt')
      .addSelect("AVG(NULLIF((e.meta->>'timeSec')::float, 0))", 'avgSec')
      .groupBy('e.stage')
      .addGroupBy('e.sheet')
      .addGroupBy('e.event')
      .orderBy('e.stage', 'ASC')
      .addOrderBy('cnt', 'DESC')
      .getRawMany<{
        stage: string;
        stepKey: string;
        event: string;
        cnt: string;
        avgSec: string | null;
      }>();
    return rows.map((r) => ({
      stage: Number(r.stage),
      stepKey: r.stepKey ?? '',
      event: r.event,
      count: Number(r.cnt),
      avgTimeOnStepSec: r.avgSec != null ? Number(r.avgSec) : null,
    }));
  }
}
