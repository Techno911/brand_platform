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
import { Client } from '../clients/client.entity';
import { ProjectRole } from './project-role.entity';
import { Row } from '../wizard/row.entity';
import { Approval } from '../wizard/approval.entity';
import { PromptRun } from '../observability/prompt-run.entity';

export type Industry =
  | 'stomatology'
  | 'furniture'
  | 'restaurant'
  | 'salon'
  | 'kids_center'
  | 'auto_service'
  | 'other';

export type ProjectTariff = 'economy' | 'standard' | 'premium';

export type ProjectStatus =
  | 'draft'
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'finalized'
  | 'archived'
  | 'abandoned';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Client, (c) => c.projects, { nullable: false })
  @JoinColumn({ name: 'client_id' })
  client!: Client;

  @Index()
  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  industry!: Industry;

  @Column({ type: 'varchar', length: 16, default: 'standard' })
  tariff!: ProjectTariff;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: ProjectStatus;

  @Column({ type: 'int', default: 1 })
  currentStage!: 1 | 2 | 3 | 4;

  /** Бюджет AI-расходов в USD на проект. Kill-switch сравнивает с этим. */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 5.0 })
  budgetUsd!: string;

  /** Накопленная AI-себестоимость проекта в USD. */
  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  spentUsd!: string;

  @OneToMany(() => ProjectRole, (r) => r.project)
  roles!: ProjectRole[];

  @OneToMany(() => Row, (r) => r.project)
  rows!: Row[];

  @OneToMany(() => Approval, (a) => a.project)
  approvals!: Approval[];

  @OneToMany(() => PromptRun, (p) => p.project)
  promptRuns!: PromptRun[];

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finalizedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
