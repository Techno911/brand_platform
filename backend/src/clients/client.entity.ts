import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

/**
 * Client = юр.лицо или физ.лицо, которому ЧиП продаёт платформу.
 * legalForm — атрибут для биллинга/счёта, не архитектурная развилка.
 */
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 32 })
  legalForm!: 'ooo' | 'ip' | 'self_employed' | 'individual';

  @Column({ type: 'varchar', length: 20, nullable: true })
  inn!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  ogrn!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  legalAddress!: string | null;

  @Column({ type: 'boolean', default: false })
  withVat!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  contactPhone!: string | null;

  @OneToMany(() => Project, (p) => p.client)
  projects!: Project[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
