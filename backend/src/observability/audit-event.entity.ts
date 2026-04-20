import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.archived'
  | 'project.tariff_changed'
  | 'project.stage_advanced'
  | 'project.budget_exceeded'
  | 'project.exported_docx'
  | 'project.exported_xlsx'
  | 'project.abandoned'
  | 'owner.approved'
  | 'owner.approval_revoked'
  | 'marketer.approval_requested'
  | 'marketer.draft_rewritten'
  | 'marketer.feedback_submitted'
  | 'ai.call_completed'
  | 'ai.call_failed'
  | 'ai.graceful_degradation'
  | 'tool_call_rejected'
  | 'prompt_injection_detected'
  | 'pii_detected'
  | 'sanitizer_triggered'
  | 'anthropic_cost_factor_changed'
  | 'golden_set.regression_detected'
  | 'golden_set.run_completed'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.refresh'
  | 'admin.user_created'
  | 'admin.user_password_reset'
  | 'admin.tariff_updated'
  | 'admin.llm_config_changed'
  | 'vendor_fallback_triggered';

/**
 * audit_events — бессрочная юридически значимая история событий.
 * AES-256-GCM encryption на rest поверх PG (via pgcrypto column-level).
 * На каждый artifact обязательны 3 подписи: generated_by / modified_by / approved_by.
 */
@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  type!: AuditEventType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /** "Responsible" user in the chain of responsibility. */
  @Column({ type: 'uuid', nullable: true })
  responsibleUserId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  generatedBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  modifiedBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta!: Record<string, any>;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
