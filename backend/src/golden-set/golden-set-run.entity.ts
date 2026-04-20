import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type GoldenSetRunStatus = 'queued' | 'running' | 'passed' | 'failed';

@Entity('golden_set_runs')
export class GoldenSetRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  promptVersion!: string;

  @Column({ type: 'varchar', length: 64 })
  model!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: GoldenSetRunStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  scores!: Record<string, { similarity: number; regression: number; passed: boolean }>;

  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0 })
  aggregateRegression!: string;

  @Column({ type: 'decimal', precision: 4, scale: 3, default: 0.15 })
  threshold!: string;

  @Column({ type: 'text', nullable: true })
  commitSha!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  triggeredBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
