import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SecurityEventType =
  | 'prompt_injection_detected'
  | 'pii_detected'
  | 'tool_call_rejected'
  | 'token_bomb_blocked'
  | 'jailbreak_marker'
  | 'roundtrip_limit_hit'
  | 'docx_export_denied'
  | 'budget_exceeded'
  | 'gitleaks_triggered'
  | 'semgrep_violation'
  | 'zap_alert'
  | 'vendor_fallback_triggered'
  | 'project_busy_contention';

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

@Entity('security_events')
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 48 })
  type!: SecurityEventType;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  severity!: SecurityEventSeverity;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /** Short matched pattern. NOT the full input — PII-safe. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  matchedPattern!: string | null;

  /** Offset inside sanitized input for audit trail. */
  @Column({ type: 'int', nullable: true })
  offset!: number | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  detectedAt!: Date;
}
