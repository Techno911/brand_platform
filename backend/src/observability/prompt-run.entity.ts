import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

export type PromptRunStatus =
  | 'planned'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'budget_exceeded'
  | 'rate_limited'
  | 'sanitized_out';

export type PromptRunKind =
  | 'interview_patterns'
  | 'review_classify'
  | 'values_draft'
  | 'legend_draft'
  | 'mission_variants'
  | 'positioning_draft'
  | 'message_variants'
  | 'critique_message'
  | 'challenge_owner_response'
  | 'plan_mode_15q'
  | 'methodology_compliance_check'
  | 'borderline_classify'
  | 'golden_set_replay';

/**
 * prompt_run — структурированный журнал каждого AI-вызова.
 * По INSIGHTS §1 (Трёхуровневая система доверия + логирование):
 *   input_tokens, output_tokens, cache_read_input_tokens, stop_reason,
 *   provider_latency_ms, retry_count, error_code, permission_denied, crash_reason.
 * Retention: бессрочно (для metric-истории).
 * Полный prompt body хранится в debug-логах 14 дней, здесь — только hash.
 */
@Entity('prompt_runs')
export class PromptRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, (p) => p.promptRuns, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project!: Project | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 48 })
  kind!: PromptRunKind;

  @Column({ type: 'varchar', length: 64 })
  model!: string;

  @Column({ type: 'varchar', length: 16, default: 'planned' })
  status!: PromptRunStatus;

  /** Идемпотентность — sha256 от (kind + project_id + input canonical JSON). */
  @Column({ type: 'varchar', length: 64 })
  inputHash!: string;

  @Column({ type: 'int', default: 0 })
  inputTokens!: number;

  @Column({ type: 'int', default: 0 })
  outputTokens!: number;

  @Column({ type: 'int', default: 0 })
  cacheReadInputTokens!: number;

  @Column({ type: 'int', default: 0 })
  cacheCreationInputTokens!: number;

  @Column({ type: 'varchar', length: 32, nullable: true })
  stopReason!: string | null;

  @Column({ type: 'int', default: 0 })
  providerLatencyMs!: number;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode!: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  routingDecision!: string | null;

  @Column({ type: 'boolean', default: false })
  permissionDenied!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  crashReason!: string | null;

  /** Стоимость в USD, рассчитанная сразу после вызова. */
  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  costUsd!: string;

  @Column({ type: 'text', nullable: true })
  outputText!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  outputJson!: Record<string, any> | null;

  /** Flag: cache_read > 0 означает попадание в prompt cache. */
  @Column({ type: 'boolean', default: false })
  cacheHit!: boolean;

  /** Кто инициировал. `user_id` маркетолога или system/cron. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  initiatedBy!: string | null;

  @Column({ type: 'int', default: 1 })
  roundtrip!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
