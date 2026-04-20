import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { User } from './user.entity';
import { AuditService } from '../observability/audit.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly audit: AuditService,
  ) {}

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // Для /admin/users/:id — detail-страница. Подгружаем projectRoles + вложенные
  // project, чтобы одним запросом отдать «в каких проектах и с какой ролью» —
  // иначе фронт пришлось бы делать N+1 запросов на имена проектов.
  findByIdWithRoles(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: { projectRoles: { project: true } },
    });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  // Лист для /admin/users. Отдаём user + projectRoles с именами проектов, чтобы
  // фронт мог отрендерить теги «Самодюк · Маркетолог» под каждым пользователем
  // без второго round-trip. Раньше был только счётчик «в N проектах», но на 17 юзерах
  // невозможно было помнить кто к кому привязан — теги решают задачу визуально.
  // Пароль/refresh — не возвращаем.
  async listAll() {
    const users = await this.repo.find({
      relations: { projectRoles: { project: true } },
      order: { createdAt: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      globalRole: u.globalRole,
      isActive: u.isActive,
      createdAt: u.createdAt,
      projectRoles: (u.projectRoles ?? []).map((r) => ({
        projectId: r.projectId,
        projectName: r.project?.name ?? null,
        role: r.role,
        isPrimary: r.isPrimary,
      })),
    }));
  }

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    globalRole?: 'chip_admin' | 'tracker' | null;
  }) {
    const exists = await this.findByEmail(data.email);
    if (exists) return exists;
    const user = this.repo.create({
      email: data.email,
      fullName: data.fullName,
      passwordHash: await bcrypt.hash(data.password, 10),
      globalRole: data.globalRole ?? null,
    });
    return this.repo.save(user);
  }

  /**
   * Сброс пароля администратором. Bcrypt-хэши односторонние — посмотреть текущий
   * пароль Маши/собственника нельзя ни при каких правах (это намеренное криптографическое
   * свойство, не баг). Поэтому chip_admin может только СБРОСИТЬ: система генерирует
   * новый пароль, показывает его админу один раз, admin сообщает пользователю
   * лично / через защищённый канал.
   *
   * Guardrails:
   *   - reset может только chip_admin (tracker не имеет — у него нет access к
   *     CRUD-админке на биллинг-уровне; если клиенту нужен сброс — идёт к Чирковой);
   *   - нельзя сбросить пароль chip_admin'у через UI (это делается через seed/
   *     миграцию, иначе второй админ мог бы заблокировать первого);
   *   - нельзя сбросить самому себе (для самообслуживания есть login-flow
   *     «забыл пароль» — пока не реализован, Post-MVP).
   *
   * Возвращаем plaintext пароля ОДИН РАЗ — дальше в БД только хэш.
   * В audit_events пишем только факт сброса, без пароля.
   */
  async resetPassword(
    targetUserId: string,
    actorId: string,
  ): Promise<{ password: string; user: User }> {
    const target = await this.findById(targetUserId);
    if (!target) throw new NotFoundException('Пользователь не найден');
    if (target.globalRole === 'chip_admin') {
      throw new ForbiddenException(
        'Пароль администратора нельзя сбросить через интерфейс. Это делается только через миграцию.',
      );
    }
    if (target.id === actorId) {
      throw new ForbiddenException(
        'Собственный пароль нельзя сбросить здесь. Используйте flow «забыл пароль» на странице логина.',
      );
    }

    const password = generatePassword(12);
    target.passwordHash = await bcrypt.hash(password, 10);
    // При сбросе пароля инвалидируем refresh-token — старые сессии этого юзера
    // автоматически выкинет при следующем рефреше access-токена (через 15 минут).
    target.refreshTokenHash = null;
    await this.repo.save(target);

    // audit-лог для разбора инцидентов: сам пароль НЕ пишем (даже в audit).
    // Пишем: кто сбросил кому и когда. Остальное восстанавливается по timestamp.
    await this.audit.record({
      type: 'admin.user_password_reset',
      userId: actorId,
      responsibleUserId: actorId,
      meta: { targetUserId, targetEmail: target.email },
    });

    return { password, user: target };
  }

  /**
   * Удаление пользователя. Реальный FK есть только на project_roles.user_id
   * (с onDelete: CASCADE), так что DELETE FROM users автоматом снесёт роли
   * этого юзера на всех проектах. Остальные таблицы (audit_events,
   * prompt_runs, security_events, marketer_quality_scores) хранят userId
   * как обычный uuid-столбец без FK — там UUID остаётся как след истории
   * (аудит-лог должен показывать «кто-то с этим ID сделал X», даже если
   * самого юзера уже нет в системе).
   *
   * Guardrails:
   *   - нельзя удалить chip_admin (защита от случайного сноса Чирковой —
   *     её учётка поднимается только через seed/миграцию);
   *   - нельзя удалить самого себя (защита от self-lockout).
   */
  async remove(id: string, actorId: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.globalRole === 'chip_admin') {
      throw new ForbiddenException(
        'Администратора нельзя удалить через интерфейс. Это делается только через миграцию.',
      );
    }
    if (user.id === actorId) {
      throw new ForbiddenException('Нельзя удалить собственную учётку.');
    }
    await this.repo.delete(id);
  }
}

// Алфавит без визуально-спорных символов (0/O, 1/I/l) — меньше шансов что Чиркова
// продиктует пароль Маше по телефону неправильно. Без спецсимволов сознательно —
// часть клиентов копирует пароль в Excel и теряет экранирование. randomInt из
// node:crypto — криптостойкий CSPRNG; Math.random() здесь был бы уязвимостью.
function generatePassword(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(0, alphabet.length)];
  }
  return out;
}
