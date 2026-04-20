import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Project } from './project.entity';

export type ProjectRoleName = 'marketer' | 'owner_viewer';

/**
 * Per-project role assignment. One user can have different roles in different projects.
 * chip_admin lives as globalRole on User; this entity covers only per-project roles
 * (marketer — primary hands-on исполнитель, owner_viewer — собственник-клиент, утверждает).
 */
@Entity('project_roles')
@Unique(['userId', 'projectId', 'role'])
export class ProjectRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (u) => u.projectRoles, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => Project, (p) => p.roles, { nullable: false })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Index()
  @Column({ type: 'uuid' })
  projectId!: string;

  @Column({ type: 'varchar', length: 32 })
  role!: ProjectRoleName;

  /** Marketer flag — marketer is the primary hands-on user per project, max 1. */
  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
