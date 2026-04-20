import { Body, ConflictException, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

// Chip_admin / tracker создаёт юзеров руками — собственника клиента (owner_viewer)
// или маркетолога. Роль назначается per-project, но логин/пароль выдаём сразу.
// globalRole = null обычно. chip_admin может заводить нового tracker'а
// (расширение штата ЧиП); tracker — НЕ может (защита privilege escalation).
class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(2) fullName!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsIn(['chip_admin', 'tracker']) globalRole?: 'chip_admin' | 'tracker' | null;
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.users.findById(user.id);
    if (!full) return null;
    return {
      id: full.id,
      email: full.email,
      fullName: full.fullName,
      globalRole: full.globalRole,
      isActive: full.isActive,
    };
  }

  @UseGuards(RolesGuard)
  @Roles('chip_admin', 'tracker')
  @Get('admin/ping')
  adminPing(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, role: user.globalRole };
  }

  // Список для /admin/users — chip_admin + tracker. Возвращаем projectRoles inline,
  // чтобы фронт мог показать «в N проектах» без второго запроса.
  @UseGuards(RolesGuard)
  @Roles('chip_admin', 'tracker')
  @Get()
  list() {
    return this.users.listAll();
  }

  // Detail для /admin/users/:id. Подтягиваем projectRoles + имена проектов,
  // чтобы фронт не делал N+1 запросов на resolve ID → name.
  // Порядок важен: `:id` должен идти ПОСЛЕ конкретных путей (`me`, `admin/ping`),
  // иначе NestJS будет матчить их как `id='me'`.
  @UseGuards(RolesGuard)
  @Roles('chip_admin', 'tracker')
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const u = await this.users.findByIdWithRoles(id);
    if (!u) throw new NotFoundException('Пользователь не найден');
    return {
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
    };
  }

  // Создание нового пользователя. В UI: «добавить собственника клиента»
  // и «добавить маркетолога клиента». Связь с проектом — через ProjectRole,
  // отдельно, при создании проекта (см. projects.controller.ts).
  //
  // Privilege escalation guard: tracker НЕ может создавать новых chip_admin/tracker.
  // Только chip_admin может завести второго админа/третьего трекера.
  @UseGuards(RolesGuard)
  @Roles('chip_admin', 'tracker')
  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    if (
      actor.globalRole === 'tracker' &&
      (dto.globalRole === 'chip_admin' || dto.globalRole === 'tracker')
    ) {
      throw new ForbiddenException(
        'Tracker не может создавать новых администраторов или трекеров. Обратитесь к chip_admin.',
      );
    }
    const exists = await this.users.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException('Пользователь с таким email уже существует.');
    }
    const user = await this.users.create({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      globalRole: dto.globalRole ?? null,
    });
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      globalRole: user.globalRole,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  // Сброс пароля. Bcrypt-хэши односторонние — посмотреть чужой пароль нельзя
  // никаким правом (это криптографический инвариант, не ограничение ПО). Поэтому
  // chip_admin'у даётся возможность сгенерировать новый пароль: система показывает
  // его один раз на экране, админ сообщает человеку лично / через защищённый канал.
  //
  // Почему только chip_admin:
  //   · tracker не имеет CRUD-уровня на биллинг/админку, reset идёт через Чиркову;
  //   · нельзя сбросить пароль другому chip_admin (guardrail в service),
  //     иначе второй админ мог бы заблокировать первого;
  //   · нельзя сбросить самому себе (для этого Post-MVP «забыл пароль» flow).
  //
  // Возвращаем plaintext пароля ОДИН РАЗ — в БД хранится только bcrypt-хэш.
  @UseGuards(RolesGuard)
  @Roles('chip_admin')
  @Post(':id/reset-password')
  async resetPassword(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    const { password, user } = await this.users.resetPassword(id, actor.id);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      password,
    };
  }

  // Удаление пользователя. Только chip_admin (tracker не может сносить
  // учётки — это riskovy: tracker мог бы случайно удалить собственника
  // и заблокировать approval-флоу у клиента).
  //
  // Реальный FK есть только на project_roles.user_id (CASCADE), остальные
  // таблицы хранят userId как string без FK — там UUID остаётся как
  // след истории. См. users.service.ts::remove() для подробностей.
  @UseGuards(RolesGuard)
  @Roles('chip_admin')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    await this.users.remove(id, actor.id);
  }
}
