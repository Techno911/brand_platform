import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * UX-telemetry: где отваливаются маркетологи (INSIGHTS §8, Горшков).
 * Pилот с Олей: трек каких шагов wizard'а, «назад», «позвать поддержку».
 */
export type WizardStepEvent =
  | 'stage_entered'
  | 'stage_left'
  | 'back_clicked'
  | 'next_blocked_by_validator'
  | 'feedback_submitted'
  | 'ai_draft_accepted'
  | 'ai_draft_rewritten_from_scratch'
  | 'support_requested'
  | 'stuck_15min'
  | 'stuck_60min';

@Entity('wizard_step_events')
export class WizardStepEventRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'int' })
  stage!: number;

  @Column({ type: 'varchar', length: 48 })
  sheet!: string;

  @Column({ type: 'varchar', length: 48 })
  event!: WizardStepEvent;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  meta!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt!: Date;
}
