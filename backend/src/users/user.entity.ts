import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectRole } from '../projects/project-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  /**
   * Global-level role. Per-project role lives in ProjectRole.
   *
   * - `chip_admin` — Чиркова, одна на инсталляцию (тарифы, биллинг, клиенты).
   * - `tracker` — операционный менеджер ЧиП, 1-3 на инсталляцию (ведёт все
   *   проекты, назначает команду, смотрит наблюдаемость; не видит биллинг).
   * - `null` — per-project роль через ProjectRole (marketer / owner_viewer).
   *
   * См. docs/RBAC.md — секция «История» объясняет почему 4 роли (а не 3 или 5).
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  globalRole!: 'chip_admin' | 'tracker' | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany(() => ProjectRole, (r) => r.user)
  projectRoles!: ProjectRole[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
