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

export type ApprovalArtifact =
  | 'legend'
  | 'values'
  | 'mission'
  | 'vision'
  | 'archetype_and_positioning'
  | 'brand_message'
  | 'final_document';

/**
 * Approval — юридически значимое утверждение собственником (owner_viewer).
 * Бессрочное хранение + immutable S3 snapshot.
 */
@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, (p) => p.approvals, { nullable: false })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 32 })
  artifact!: ApprovalArtifact;

  @Column({ type: 'jsonb' })
  snapshotContent!: Record<string, any>;

  @Column({ type: 'varchar', length: 128 })
  snapshotHash!: string;

  @Column({ type: 'varchar', length: 512 })
  s3Uri!: string;

  @Column({ type: 'uuid' })
  approvedBy!: string;

  /** Self-approval flag — физ.лицо клиент, marketer == owner_viewer. */
  @Column({ type: 'boolean', default: false })
  isSelfApproval!: boolean;

  @Column({ type: 'uuid', nullable: true })
  generatedBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  modifiedBy!: string | null;

  @Column({ type: 'uuid' })
  responsibleUserId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  approvedAt!: Date;
}
