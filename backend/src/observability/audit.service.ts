import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent, AuditEventType } from './audit-event.entity';

export interface AuditRecord {
  type: AuditEventType;
  projectId?: string | null;
  userId?: string | null;
  responsibleUserId?: string | null;
  generatedBy?: string | null;
  modifiedBy?: string | null;
  approvedBy?: string | null;
  meta?: Record<string, any>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(
    @InjectRepository(AuditEvent) private readonly repo: Repository<AuditEvent>,
  ) {}

  async record(r: AuditRecord) {
    try {
      const e = this.repo.create({
        type: r.type,
        projectId: r.projectId ?? null,
        userId: r.userId ?? null,
        responsibleUserId: r.responsibleUserId ?? null,
        generatedBy: r.generatedBy ?? null,
        modifiedBy: r.modifiedBy ?? null,
        approvedBy: r.approvedBy ?? null,
        meta: r.meta ?? {},
        ipAddress: r.ipAddress ?? null,
        userAgent: r.userAgent ?? null,
      });
      await this.repo.save(e);
    } catch (err: any) {
      // Audit log failures must never block the calling path
      this.logger.error(`audit record failed: ${err?.message}`, err?.stack);
    }
  }

  listByProject(projectId: string, limit = 200) {
    return this.repo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  listByType(type: AuditEventType, limit = 500) {
    return this.repo.find({
      where: { type },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  listSilentFailures(limit = 500) {
    return this.repo
      .createQueryBuilder('e')
      .where('e.type IN (:...types)', {
        types: [
          'ai.call_failed',
          'ai.graceful_degradation',
          'project.budget_exceeded',
          'golden_set.regression_detected',
          'prompt_injection_detected',
          'tool_call_rejected',
          'pii_detected',
        ] as AuditEventType[],
      })
      .orderBy('e.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
