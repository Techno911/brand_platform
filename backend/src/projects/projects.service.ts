import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Project, Industry, ProjectTariff, ProjectStatus } from './project.entity';
import { ProjectRole, ProjectRoleName } from './project-role.entity';
import { AuditService } from '../observability/audit.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(ProjectRole) private readonly roles: Repository<ProjectRole>,
    private readonly audit: AuditService,
  ) {}

  /** Project visibility depends on role:
   *  - chip_admin / tracker: all
   *  - marketer / owner_viewer: where ProjectRole exists for user
   */
  async listForUser(user: { id: string; globalRole: 'chip_admin' | 'tracker' | null }) {
    if (user.globalRole === 'chip_admin' || user.globalRole === 'tracker') {
      return this.projects.find({ order: { createdAt: 'DESC' } });
    }
    const assignments = await this.roles.find({ where: { userId: user.id } });
    if (assignments.length === 0) return [];
    return this.projects.find({
      where: { id: In(assignments.map((a) => a.projectId)) },
      order: { createdAt: 'DESC' },
    });
  }

  get(id: string) {
    return this.projects.findOne({ where: { id }, relations: ['roles'] });
  }

  async create(data: {
    clientId: string;
    name: string;
    industry: Industry;
    tariff: ProjectTariff;
    createdBy: string;
    budgetUsd?: number;
  }) {
    const project = this.projects.create({
      clientId: data.clientId,
      name: data.name,
      industry: data.industry,
      tariff: data.tariff,
      status: 'draft',
      currentStage: 1,
      budgetUsd: String(data.budgetUsd ?? 5),
    });
    const saved = await this.projects.save(project);
    await this.audit.record({
      type: 'project.created',
      projectId: saved.id,
      userId: data.createdBy,
      responsibleUserId: data.createdBy,
      meta: { industry: data.industry, tariff: data.tariff },
    });
    return saved;
  }

  async assignRole(projectId: string, userId: string, role: ProjectRoleName, isPrimary = false) {
    const project = await this.get(projectId);
    if (!project) throw new NotFoundException('Project not found');

    // marketer is max 1 per project (unless explicitly re-primary).
    if (role === 'marketer' && isPrimary) {
      await this.roles.update(
        { projectId, role: 'marketer', isPrimary: true },
        { isPrimary: false },
      );
    }

    const existing = await this.roles.findOne({
      where: { userId, projectId, role },
    });
    if (existing) {
      existing.isPrimary = isPrimary;
      return this.roles.save(existing);
    }

    return this.roles.save(this.roles.create({ userId, projectId, role, isPrimary }));
  }

  async removeRole(projectId: string, userId: string, role: ProjectRoleName) {
    const existing = await this.roles.findOne({ where: { projectId, userId, role } });
    if (!existing) {
      throw new NotFoundException('Роль не назначена или уже снята');
    }
    await this.roles.remove(existing);
    return { ok: true };
  }

  /**
   * Маркетолог закрывает стадию и отправляет её артефакты собственнику на подпись.
   * Это НЕ финальный approval (тот идёт через ApprovalService — там подпись + S3 snapshot),
   * это событие «я всё сделал, жду подпись». Без этого хука сабмит-кнопка «На одобрение
   * собственника» на Stage2/3 уходила в 404 — маркетолог нажимал и ничего не происходило.
   *
   * Пишем audit_event + возвращаем timestamp и список стадий, которые маркетолог уже
   * отправил — это нужно фронту чтобы отрисовать «ожидает подписи с XX.XX.XX в HH:MM».
   * Без entity: пока не нужна таблица «submissions», аудит справляется.
   */
  async submitForApproval(projectId: string, stage: 1 | 2 | 3 | 4, actorUserId: string) {
    const project = await this.get(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.status === 'finalized' || project.status === 'archived' || project.status === 'abandoned') {
      throw new BadRequestException('Проект закрыт — отправка на одобрение недоступна.');
    }
    const submittedAt = new Date();
    await this.audit.record({
      type: 'marketer.approval_requested',
      projectId,
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { stage, submittedAt: submittedAt.toISOString() },
    });
    return { ok: true, stage, projectId, submittedAt: submittedAt.toISOString() };
  }

  async advanceStage(projectId: string, nextStage: 2 | 3 | 4, actorUserId: string) {
    const project = await this.get(projectId);
    if (!project) throw new NotFoundException('Project not found');
    if (project.currentStage + 1 !== nextStage) {
      throw new BadRequestException(
        `cannot skip stages: current=${project.currentStage}, requested=${nextStage}`,
      );
    }
    project.currentStage = nextStage;
    project.status = (`stage_${nextStage}` as ProjectStatus);
    await this.projects.save(project);
    await this.audit.record({
      type: 'project.stage_advanced',
      projectId,
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { nextStage },
    });
    return project;
  }

  async addSpend(projectId: string, costUsd: number) {
    await this.projects.increment({ id: projectId }, 'spentUsd', costUsd);
  }

  async setStatus(projectId: string, status: ProjectStatus, userId: string) {
    await this.projects.update(projectId, { status });
    await this.audit.record({
      type: status === 'finalized' ? 'project.exported_docx' : 'project.archived',
      projectId,
      userId,
      responsibleUserId: userId,
      meta: { status },
    });
  }

  /**
   * Переименование проекта. Use case: мастер онбординга создал проект с именем
   * клиента-юрлица («Самодюк Дмитрий Владимирович»), а бренд у него другой —
   * «КДМ — Камчатский дом мебели». Админ заходит в клиента и переименовывает
   * проект под фактический бренд.
   *
   * Не трогает currentStage/status — это чисто косметическая операция. Аудитим,
   * чтобы осталась история «кто и когда переименовал» (вдруг клиент спросит).
   */
  async updateDetails(
    projectId: string,
    patch: { name?: string },
    actorUserId: string,
  ) {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const before = { name: project.name };
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (trimmed.length < 1) {
        throw new BadRequestException('Название не может быть пустым');
      }
      if (trimmed.length > 255) {
        throw new BadRequestException('Название слишком длинное (макс. 255)');
      }
      project.name = trimmed;
    }

    const saved = await this.projects.save(project);
    await this.audit.record({
      type: 'project.updated',
      projectId,
      userId: actorUserId,
      responsibleUserId: actorUserId,
      meta: { before, after: { name: saved.name } },
    });
    return saved;
  }
}
