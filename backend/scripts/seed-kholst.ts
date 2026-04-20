/**
 * seed-kholst.ts — сид второго клиента «Холст» (бренд одежды)
 * для CJM-прохода. Идемпотентный.
 *
 * Создаёт:
 *   - marketer Анна ({anna@kholst-marketing.ru, Test123!}) — primary
 *   - owner_viewer Дмитрий ({dmitry@kholst.ru, Test123!})
 *   - Клиент "Холст" (ooo)
 *   - Проект "Холст — бренд-платформа 2026" (industry=other, tariff=standard)
 *   - Привязка ролей
 *
 * Запуск:  cd backend && npx ts-node scripts/seed-kholst.ts
 */
import 'reflect-metadata';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from '../src/config/datasource';
import { User } from '../src/users/user.entity';
import { Client } from '../src/clients/client.entity';
import { Project } from '../src/projects/project.entity';
import { ProjectRole } from '../src/projects/project-role.entity';

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (em) => {
      const usersRepo = em.getRepository(User);
      const clientsRepo = em.getRepository(Client);
      const projectsRepo = em.getRepository(Project);
      const rolesRepo = em.getRepository(ProjectRole);

      const passwordHash = bcrypt.hashSync('Test123!', 10);

      const users = [
        {
          email: 'anna@kholst-marketing.ru',
          fullName: 'Анна Смирнова',
          globalRole: null,
          isActive: true,
        },
        {
          email: 'dmitry@kholst.ru',
          fullName: 'Дмитрий Петров',
          globalRole: null,
          isActive: true,
        },
      ];

      const resolved: Record<string, User> = {};
      for (const u of users) {
        let existing = await usersRepo.findOne({ where: { email: u.email } });
        if (!existing) {
          existing = await usersRepo.save(
            usersRepo.create({
              email: u.email,
              fullName: u.fullName,
              passwordHash,
              globalRole: u.globalRole,
              isActive: u.isActive,
            }),
          );
          console.log(`  + user ${u.email}`);
        } else {
          existing.passwordHash = passwordHash;
          existing.fullName = u.fullName;
          existing.globalRole = u.globalRole;
          existing.isActive = u.isActive;
          await usersRepo.save(existing);
          console.log(`  = user ${u.email} (exists, refreshed)`);
        }
        resolved[u.email] = existing;
      }

      let client = await clientsRepo.findOne({ where: { name: 'Холст' } });
      if (!client) {
        client = await clientsRepo.save(
          clientsRepo.create({
            name: 'Холст',
            legalForm: 'ooo',
            inn: null,
            ogrn: null,
            legalAddress: null,
            withVat: false,
            contactEmail: 'dmitry@kholst.ru',
            contactPhone: null,
          }),
        );
        console.log(`  + client Холст`);
      } else {
        console.log(`  = client Холст (exists)`);
      }

      let project = await projectsRepo.findOne({ where: { clientId: client.id, name: 'Холст — бренд-платформа 2026' } });
      if (!project) {
        project = await projectsRepo.save(
          projectsRepo.create({
            clientId: client.id,
            name: 'Холст — бренд-платформа 2026',
            industry: 'other',
            tariff: 'standard',
            status: 'stage_1',
            currentStage: 1,
            budgetUsd: '12.0000',
            spentUsd: '0.0000',
          }),
        );
        console.log(`  + project Холст — бренд-платформа 2026`);
      } else {
        console.log(`  = project Холст (exists)`);
      }

      const roleSpecs: Array<{ user: User; role: 'marketer' | 'owner_viewer'; isPrimary?: boolean }> = [
        { user: resolved['anna@kholst-marketing.ru'], role: 'marketer', isPrimary: true },
        { user: resolved['dmitry@kholst.ru'], role: 'owner_viewer' },
      ];

      for (const spec of roleSpecs) {
        const existing = await rolesRepo.findOne({
          where: { userId: spec.user.id, projectId: project.id, role: spec.role },
        });
        if (!existing) {
          await rolesRepo.save(
            rolesRepo.create({
              userId: spec.user.id,
              projectId: project.id,
              role: spec.role,
              isPrimary: Boolean(spec.isPrimary),
            }),
          );
          console.log(`  + role ${spec.role} for ${spec.user.email}`);
        } else {
          console.log(`  = role ${spec.role} for ${spec.user.email} (exists)`);
        }
      }
    });

    console.log('\n✓ seed Холст complete');
    console.log('\nЛогины (пароль Test123!):');
    console.log('  marketer (Анна, primary): anna@kholst-marketing.ru');
    console.log('  owner_viewer (Дмитрий):   dmitry@kholst.ru');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
