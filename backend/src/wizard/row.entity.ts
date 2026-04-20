import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { Draft } from './draft.entity';

/**
 * Row = одна смысловая единица в одной из 6 «таблиц» (листов).
 * sheet: 1=Интервью, 2=Отзывы, 3=Конкуренты, 4=Сессия, 5=Архетип+позиционирование, 6=Бренд-месседж.
 * type: конкретный подкласс внутри листа (interview/review/competitor/value/mission/message/…).
 * payload хранит произвольный JSON.
 */
export type SheetNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type RowType =
  | 'interview'
  | 'review'
  | 'competitor'
  | 'legend_fact'
  | 'value'
  | 'mission_variant'
  | 'vision'
  | 'archetype'
  | 'we_we_are_not_pair'
  | 'positioning'
  | 'message_variant'
  | 'message_test_result';

export type RowStatus = 'planned' | 'executing' | 'completed' | 'failed';

@Entity('rows')
export class Row {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, (p) => p.rows, { nullable: false })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Index()
  @Column({ type: 'int' })
  sheet!: SheetNumber;

  @Column({ type: 'varchar', length: 32 })
  type!: RowType;

  @Column({ type: 'int', default: 0 })
  orderIndex!: number;

  /** Idempotency state (from INSIGHTS §1, file 10) */
  @Column({ type: 'varchar', length: 16, default: 'planned' })
  status!: RowStatus;

  /** Free-form payload; structure depends on type. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, any>;

  /** Финализированное значение, готовое к экспорту. Null — ещё не утверждено. */
  @Column({ type: 'jsonb', nullable: true })
  finalized!: Record<string, any> | null;

  @OneToMany(() => Draft, (d) => d.row)
  drafts!: Draft[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
