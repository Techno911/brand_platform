import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { Approval, ApprovalArtifact } from './approval.entity';
import { AuditService } from '../observability/audit.service';
import { ExporterService } from '../exporter/exporter.service';

/**
 * INSIGHTS §5 delta-6: Immutable snapshot on owner_approved event.
 * Snapshot content + hash + S3 URI (object-lock compliance).
 */
@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(Approval) private readonly repo: Repository<Approval>,
    private readonly audit: AuditService,
    private readonly exporter: ExporterService,
  ) {}

  async approve(params: {
    projectId: string;
    artifact: ApprovalArtifact;
    snapshotContent: Record<string, any>;
    approvedBy: string;
    responsibleUserId: string;
    generatedBy?: string | null;
    modifiedBy?: string | null;
    isSelfApproval?: boolean;
  }) {
    const snapshotHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params.snapshotContent))
      .digest('hex');

    // Push to S3 Glacier/immutable bucket
    const { s3Uri } = await this.exporter.writeImmutableSnapshot({
      projectId: params.projectId,
      artifact: params.artifact,
      hash: snapshotHash,
      content: params.snapshotContent,
    });

    const row = this.repo.create({
      projectId: params.projectId,
      artifact: params.artifact,
      snapshotContent: params.snapshotContent,
      snapshotHash,
      s3Uri,
      approvedBy: params.approvedBy,
      generatedBy: params.generatedBy ?? null,
      modifiedBy: params.modifiedBy ?? null,
      responsibleUserId: params.responsibleUserId,
      isSelfApproval: Boolean(params.isSelfApproval),
    });
    const saved = await this.repo.save(row);

    await this.audit.record({
      type: 'owner.approved',
      projectId: params.projectId,
      userId: params.approvedBy,
      approvedBy: params.approvedBy,
      generatedBy: params.generatedBy ?? null,
      modifiedBy: params.modifiedBy ?? null,
      responsibleUserId: params.responsibleUserId,
      meta: {
        artifact: params.artifact,
        approvalId: saved.id,
        snapshotHash,
        s3Uri,
        isSelfApproval: Boolean(params.isSelfApproval),
      },
    });

    return saved;
  }

  async revoke(approvalId: string, revokedBy: string, reason: string) {
    const a = await this.repo.findOne({ where: { id: approvalId } });
    if (!a) throw new NotFoundException();
    await this.audit.record({
      type: 'owner.approval_revoked',
      projectId: a.projectId,
      userId: revokedBy,
      responsibleUserId: revokedBy,
      meta: { approvalId, reason, artifact: a.artifact },
    });
    // Entity stays (immutable audit). Client UI surfaces it as "revoked".
    return { ok: true };
  }

  listForProject(projectId: string) {
    return this.repo.find({ where: { projectId }, order: { approvedAt: 'DESC' } });
  }
}
