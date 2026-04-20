import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityEvent, SecurityEventType, SecurityEventSeverity } from './security-event.entity';

export type SecurityEventSource =
  | 'brief_sanitizer'
  | 'pii_redactor'
  | 'tool_call_sandbox'
  | 'auth'
  | 'roundtrip_limiter'
  | 'exporter'
  | 'vendor_router'
  | 'global_llm_queue'
  | 'project_busy'
  | 'other';

export interface SecurityEventInput {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  projectId?: string | null;
  userId?: string | null;
  source: SecurityEventSource;
  matchedPattern?: string | null;
  excerpt?: string | null;
  offset?: number | null;
  meta?: Record<string, any>;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger('SecurityEventsService');

  constructor(
    @InjectRepository(SecurityEvent) private readonly repo: Repository<SecurityEvent>,
  ) {}

  async record(e: SecurityEventInput) {
    try {
      // Entity stores excerpt/source in meta to keep PG schema narrow.
      const meta = {
        ...(e.meta ?? {}),
        source: e.source,
        ...(e.excerpt ? { excerpt: e.excerpt } : {}),
      };
      return await this.repo.save(
        this.repo.create({
          type: e.type,
          severity: e.severity,
          projectId: e.projectId ?? null,
          userId: e.userId ?? null,
          matchedPattern: e.matchedPattern ?? null,
          offset: e.offset ?? null,
          meta,
        }),
      );
    } catch (err: any) {
      this.logger.error(`security event record failed: ${err?.message}`, err?.stack);
      return null;
    }
  }

  list(limit = 500) {
    return this.repo.find({ order: { detectedAt: 'DESC' }, take: limit });
  }

  listByProject(projectId: string, limit = 200) {
    return this.repo.find({
      where: { projectId },
      order: { detectedAt: 'DESC' },
      take: limit,
    });
  }
}
