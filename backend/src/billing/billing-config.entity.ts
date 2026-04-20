import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Singleton (key='default'). Содержит anthropic_cost_factor и перерасчётные ставки.
 * chip_admin меняет через UI → пишется audit_events.anthropic_cost_factor_changed.
 * История — см. BillingConfigHistoryEntity.
 */
@Entity('billing_configs')
export class BillingConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32, default: 'default' })
  key!: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 1.0 })
  anthropicCostFactor!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 50 })
  markupPercent!: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 95 })
  currencyRateUsdRub!: string;

  /** USD/1M tokens per model. kept in JSONB for flexibility. */
  @Column({ type: 'jsonb', default: () => `'{"claude-opus-4-7": {"input": 15, "output": 75, "cache_write": 18.75, "cache_read": 1.5}, "claude-haiku-4": {"input": 0.8, "output": 4}}'::jsonb` })
  tokenPricing!: Record<string, { input: number; output: number; cache_write?: number; cache_read?: number }>;

  /** Tariff definitions — editable by chip_admin. */
  @Column({
    type: 'jsonb',
    default: () => `'{"economy": {"monthly_rub": 5000, "included_projects": 1, "markup_percent": 40, "sla_hours": 48, "manual_review_hours": 0}, "standard": {"monthly_rub": 12000, "included_projects": 1, "markup_percent": 50, "sla_hours": 24, "manual_review_hours": 2}, "premium": {"monthly_rub": 28000, "included_projects": 1, "markup_percent": 60, "sla_hours": 4, "manual_review_hours": -1, "includes_offline_meeting": true}}'::jsonb`,
  })
  tariffs!: Record<
    string,
    {
      monthly_rub: number;
      included_projects: number;
      markup_percent: number;
      sla_hours: number;
      manual_review_hours: number;
      includes_offline_meeting?: boolean;
    }
  >;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
