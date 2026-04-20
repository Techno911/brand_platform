import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

export type InvoiceKind = 'subscription' | 'project_finalization';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  kind!: InvoiceKind;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status!: InvoiceStatus;

  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project!: Project | null;

  @Column({ type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amountRub!: string;

  @Column({ type: 'decimal', precision: 12, scale: 6, default: 0 })
  rawCostUsd!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 50 })
  markupPercent!: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 1.0 })
  anthropicCostFactor!: string;

  @Column({ type: 'boolean', default: false })
  withVat!: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  paymentRef!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  breakdown!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;
}
