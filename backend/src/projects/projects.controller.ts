import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, IsBoolean, IsNumber } from 'class-validator';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Industry, ProjectTariff, ProjectStatus } from './project.entity';
import { ProjectRoleName } from './project-role.entity';

class CreateProjectDto {
  @IsUUID() clientId!: string;
  @IsString() @MaxLength(255) name!: string;
  @IsEnum(['stomatology', 'furniture', 'restaurant', 'salon', 'other'])
  industry!: Industry;
  @IsEnum(['economy', 'standard', 'premium']) tariff!: ProjectTariff;
  @IsOptional() @IsNumber() budgetUsd?: number;
}

class AssignRoleDto {
  @IsUUID() userId!: string;
  @IsIn(['marketer', 'owner_viewer']) role!: ProjectRoleName;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class AdvanceStageDto {
  @IsIn([2, 3, 4]) nextStage!: 2 | 3 | 4;
}

// «Отправить стадию на одобрение собственника» — маркетолог заявляет «я закончил».
// Финальный approval (с SHA-256 snapshot + S3) всё равно делает owner_viewer
// через /wizard/approvals; этот endpoint только фиксирует факт сабмита в audit-logs,
// чтобы 1) маркетолог видел «отправлено, ждём», 2) собственник получал уведомление,
// 3) в истории проекта было «stage 2 submitted at 14:03 by Ольга».
//
// projectId дублируется в body, потому что RolesGuard (см. auth/guards/roles.guard.ts)
// смотрит в params.projectId / body.projectId, а URL-параметр у нас `:id` — он
// в projects.controller.ts везде `:id` (REST-стиль). Чтобы не ломать сигнатуру других
// роутов и не трогать RolesGuard, передаём projectId ещё и в body. Тот же паттерн
// можно (но не обязательно) применять к другим `:id` маршрутам этого контроллера.
class SubmitApprovalDto {
  @IsUUID() projectId!: string;
  @IsIn([1, 2, 3, 4]) stage!: 1 | 2 | 3 | 4;
}

class SetStatusDto {
  @IsIn(['draft', 'stage_1', 'stage_2', 'stage_3', 'stage_4', 'finalized', 'archived'])
  status!: ProjectStatus;
}

// Косметическое обновление проекта (рефакторинг названия под бренд клиента).
// Пока только name; industry/tariff — отдельные защищённые операции (влияют на
// биллинг и методологию), поэтому через отдельные эндпоинты, а не тут.
class UpdateProjectDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.projects.listForUser({ id: user.id, globalRole: user.globalRole });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.projects.get(id);
  }

  @Roles('chip_admin', 'tracker')
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projects.create({ ...dto, createdBy: user.id });
  }

  @Roles('chip_admin', 'tracker')
  @Post(':id/roles')
  assignRole(@Param('id') projectId: string, @Body() dto: AssignRoleDto) {
    return this.projects.assignRole(projectId, dto.userId, dto.role, dto.isPrimary ?? false);
  }

  // Снятие роли с пользователя на проекте. Use case: у клиента сменился маркетолог —
  // админ/трекер убирает Павла из marketer, добавляет Ольгу. `role` в URL, а не в теле,
  // потому что composite key (userId,projectId,role) — один пользователь может
  // одновременно быть и маркетологом и owner_viewer (редко, но возможно).
  @Roles('chip_admin', 'tracker')
  @Delete(':id/roles/:userId/:role')
  removeRole(
    @Param('id') projectId: string,
    @Param('userId') userId: string,
    @Param('role') role: ProjectRoleName,
  ) {
    return this.projects.removeRole(projectId, userId, role);
  }

  @Roles('chip_admin', 'tracker', 'marketer')
  @Patch(':id/stage')
  advanceStage(
    @Param('id') projectId: string,
    @Body() dto: AdvanceStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.advanceStage(projectId, dto.nextStage, user.id);
  }

  // Маркетолог (или chip_admin/tracker) жмёт «На одобрение собственника» в конце
  // стадии. Пишем audit_event `marketer.approval_requested` — эта запись
  // 1) показывает маркетологу «отправлено, ждём», 2) подаётся в уведомления
  // собственника (Post-MVP Telegram), 3) восстанавливается в истории проекта.
  // Финальная подпись всё равно идёт через /wizard/approvals (там SHA-256 + S3).
  @Roles('chip_admin', 'tracker', 'marketer')
  @Post(':id/approvals/request')
  submitForApproval(
    @Param('id') projectId: string,
    @Body() dto: SubmitApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.submitForApproval(projectId, dto.stage, user.id);
  }

  @Roles('chip_admin', 'tracker')
  @Patch(':id/status')
  setStatus(
    @Param('id') projectId: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.setStatus(projectId, dto.status, user.id);
  }

  // Use case: мастер онбординга создал проект с именем клиента-юрлица
  // («Самодюк Дмитрий Владимирович»), а бренд у него другой — «КДМ — Камчатский
  // дом мебели». Админ/трекер переименовывает проект под фактический бренд.
  // Marketer не может переименовывать — он может путать «что мы сейчас собираем».
  @Roles('chip_admin', 'tracker')
  @Patch(':id')
  update(
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projects.updateDetails(projectId, dto, user.id);
  }
}
