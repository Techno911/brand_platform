import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * marketer_quality_score — дашборд Коробовцева (INSIGHTS §8).
 * Усреднённый балл output-validator у каждого маркетолога.
 * Обновляется после каждого /values-draft, /mission-variants, /message-variants.
 */
@Entity('marketer_quality_scores')
export class MarketerQualityScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  marketerUserId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'varchar', length: 48 })
  validatorKind!: string;

  @Column({ type: 'decimal', precision: 4, scale: 3 })
  score!: string;

  @Column({ type: 'int', default: 0 })
  regexViolations!: number;

  @Column({ type: 'int', default: 0 })
  llmJudgeFlags!: number;

  @Column({ type: 'int', default: 0 })
  methodologyViolations!: number;

  @Column({ type: 'int', default: 0 })
  humanOverrideCount!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  recordedAt!: Date;
}
