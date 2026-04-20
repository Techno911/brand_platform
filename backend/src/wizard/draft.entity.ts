import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Row } from './row.entity';
import { PromptRun } from '../observability/prompt-run.entity';

export type DraftSource = 'ai' | 'human' | 'hybrid';
export type DraftTrafficLight = 'green' | 'yellow' | 'red';

/**
 * Draft = версия ответа (AI или human) в рамках одного Row.
 * Каждое изменение — новая версия, предыдущие не перезаписываются.
 * Цветовая классификация /review-classify хранится в trafficLight.
 */
@Entity('drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Row, (r) => r.drafts, { nullable: false })
  @JoinColumn({ name: 'row_id' })
  row!: Row;

  @Index()
  @Column({ type: 'uuid' })
  rowId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 16 })
  source!: DraftSource;

  @Column({ type: 'jsonb' })
  content!: Record<string, any>;

  @Column({ type: 'varchar', length: 8, nullable: true })
  trafficLight!: DraftTrafficLight | null;

  /** Связь с конкретным вызовом AI. null — если source=human. */
  @ManyToOne(() => PromptRun, { nullable: true })
  @JoinColumn({ name: 'prompt_run_id' })
  promptRun!: PromptRun | null;

  @Column({ type: 'uuid', nullable: true })
  promptRunId!: string | null;

  /** Флаг прохождения 3-уровневого validator. Required to promote to Finalized. */
  @Column({ type: 'boolean', default: false })
  validatorPassed!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  validatorReport!: Record<string, any> | null;

  /** Кто создал — пользователь (для human/hybrid). */
  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
