import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectRole } from '../../projects/project-role.entity';
import { ROLES_KEY, AnyChipRole } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Role-based access control across 4 roles: chip_admin / tracker / marketer / owner_viewer.
 *
 * - chip_admin — global, bypasses per-project checks on any route.
 * - tracker    — global operational role. Bypasses per-project checks на тех routes,
 *   где `@Roles('tracker')` явно указан. На billing / client CRUD tracker не указан —
 *   там только chip_admin.
 * - marketer / owner_viewer — project-scoped; the guard reads `projectId` from
 *   request (params.projectId | query.projectId | body.projectId) and
 *   verifies ProjectRole.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ProjectRole) private readonly projectRoles: Repository<ProjectRole>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<AnyChipRole[] | undefined>(ROLES_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: Record<string, unknown>;
    }>();

    const user = req.user;
    if (!user) throw new ForbiddenException('No user in context');

    // chip_admin — универсальный short-circuit (видит всё, что указано в required).
    if (user.globalRole === 'chip_admin' && required.includes('chip_admin')) return true;

    // tracker — global ops-роль. Пропускаем только если `tracker` явно в required.
    // Это означает: на billing / client-create (где required = ['chip_admin'] без
    // tracker) tracker получит ForbiddenException — ровно то, что нужно.
    if (user.globalRole === 'tracker' && required.includes('tracker')) return true;

    const projectId =
      req.params?.projectId ??
      req.query?.projectId ??
      (typeof req.body?.projectId === 'string' ? req.body.projectId : undefined);

    if (!projectId) {
      // Global role is the only way through when no project is specified.
      if (user.globalRole === 'chip_admin') return true;
      if (user.globalRole === 'tracker' && required.includes('tracker')) return true;
      throw new ForbiddenException('project id is required for this operation');
    }

    const assignments = await this.projectRoles.find({
      where: { userId: user.id, projectId },
      select: ['role'],
    });

    const userRoles = new Set<AnyChipRole>(
      assignments.map((a) => a.role as AnyChipRole),
    );

    if (user.globalRole === 'chip_admin') userRoles.add('chip_admin');
    if (user.globalRole === 'tracker') userRoles.add('tracker');

    const allowed = required.some((r) => userRoles.has(r));
    if (!allowed) {
      throw new ForbiddenException(
        `role ${[...userRoles].join(',')} is not in required set [${required.join(',')}]`,
      );
    }

    // Expose to controller if needed.
    (req.user as AuthenticatedUser).projectRoles = {
      ...(req.user.projectRoles ?? {}),
      [projectId]: [...userRoles],
    };

    return true;
  }
}
