import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Client } from './client.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly repo: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  list() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  get(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // Detail для /admin/clients/:id. Подтягиваем projects → roles → user одним
  // запросом, чтобы фронт мог отрендерить «собственник: Иван Петров, маркетолог:
  // Павел М.» без N+1 запросов на имена пользователей.
  async getDetail(id: string) {
    const client = await this.repo.findOne({
      where: { id },
      relations: { projects: { roles: { user: true } } },
    });
    if (!client) return null;
    return {
      id: client.id,
      name: client.name,
      legalForm: client.legalForm,
      inn: client.inn,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      withVat: client.withVat,
      createdAt: client.createdAt,
      projects: (client.projects ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        industry: p.industry,
        tariff: p.tariff,
        status: p.status,
        currentStage: p.currentStage,
        budgetUsd: p.budgetUsd,
        spentUsd: p.spentUsd,
        startedAt: p.startedAt,
        finalizedAt: p.finalizedAt,
        members: (p.roles ?? []).map((r) => ({
          userId: r.userId,
          fullName: r.user?.fullName ?? null,
          email: r.user?.email ?? null,
          role: r.role,
          isPrimary: r.isPrimary,
        })),
      })),
    };
  }

  async create(data: Partial<Client>) {
    const c = this.repo.create(data);
    return this.repo.save(c);
  }

  async update(id: string, data: Partial<Client>) {
    const c = await this.get(id);
    if (!c) throw new NotFoundException();
    Object.assign(c, data);
    return this.repo.save(c);
  }

  /**
   * Удаление клиента с каскадом по всем проектам И orphan-юзерам.
   *
   * Почему вручную, а не только через FK CASCADE: нам нужна тонкая логика
   * «удалить юзера, если он нигде больше не используется». Сам порядок DELETE
   * по таблицам — избыточен относительно FK (TypeORM уже настроил CASCADE
   * на projects.client_id и project_roles.*), но оставляем явно как страховку
   * и для читаемости.
   *
   * Порядок (в транзакции):
   *   1. Собираем userIds — кто был в project_roles на проектах этого клиента
   *      (будущие кандидаты на удаление).
   *   2. Для каждого проекта:
   *      · nullable-дети в таблицах без FK (audit_events, marketer_quality_scores,
   *        security_events) — SET NULL. Сохраняем observability-историю.
   *      · required-дети без FK (wizard_step_events) — DELETE.
   *      · сам project — DELETE. FK CASCADE автоматом снесёт project_roles,
   *        rows, approvals, drafts; SET NULL — invoices и prompt_runs.
   *   3. DELETE самого клиента.
   *   4. Orphan-user cleanup: среди собранных userIds оставляем тех, у кого
   *      globalRole = NULL И нет project_roles на других проектах. Их сносим —
   *      это собственники/маркетологи удалённого клиента, которые больше нигде
   *      не используются. Chip_admin/tracker и люди, привязанные к другим
   *      проектам, остаются нетронутыми.
   *
   * Вся операция в одной транзакции: если что-то упадёт — возврат до пред-удаления,
   * orphan записей не остаётся.
   */
  async remove(id: string): Promise<void> {
    const client = await this.repo.findOne({
      where: { id },
      relations: { projects: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');

    const projectIds = (client.projects ?? []).map((p) => p.id);

    await this.dataSource.transaction(async (m) => {
      // 1. Собираем userIds — кандидатов на orphan-cleanup.
      let candidateUserIds: string[] = [];
      if (projectIds.length > 0) {
        const rows: Array<{ user_id: string }> = await m.query(
          `SELECT DISTINCT user_id FROM project_roles WHERE project_id = ANY($1)`,
          [projectIds],
        );
        candidateUserIds = rows.map((r) => r.user_id);
      }

      // 2. Ручной cleanup таблиц БЕЗ реального FK (TypeORM не создал constraint —
      //    там просто uuid-столбцы). CASCADE тут не сработает, orphan останется.
      if (projectIds.length > 0) {
        await m.query(`UPDATE audit_events SET project_id = NULL WHERE project_id = ANY($1)`, [projectIds]);
        await m.query(`UPDATE marketer_quality_scores SET project_id = NULL WHERE project_id = ANY($1)`, [projectIds]);
        await m.query(`UPDATE security_events SET project_id = NULL WHERE project_id = ANY($1)`, [projectIds]);
        await m.query(`DELETE FROM wizard_step_events WHERE project_id = ANY($1)`, [projectIds]);

        // Сам project. FK CASCADE сам подчистит project_roles/rows/approvals/drafts;
        // SET NULL — prompt_runs.project_id и invoices.project_id.
        await m.query(`DELETE FROM projects WHERE id = ANY($1)`, [projectIds]);
      }

      // 3. Сам клиент.
      await m.query(`DELETE FROM clients WHERE id = $1`, [id]);

      // 4. Orphan-юзеры: те из candidateUserIds, у кого нет globalRole и
      //    не осталось project_roles (CASCADE уже снёс роли на удалённых проектах).
      //    Chip_admin / tracker никогда не удаляются через этот путь.
      if (candidateUserIds.length > 0) {
        const orphans: Array<{ id: string }> = await m.query(
          `SELECT u.id FROM users u
             WHERE u.id = ANY($1)
               AND u.global_role IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM project_roles pr WHERE pr.user_id = u.id
               )`,
          [candidateUserIds],
        );
        const orphanIds = orphans.map((r) => r.id);
        if (orphanIds.length > 0) {
          await m.query(`DELETE FROM users WHERE id = ANY($1)`, [orphanIds]);
        }
      }
    });
  }
}
