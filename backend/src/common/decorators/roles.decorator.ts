import { SetMetadata } from '@nestjs/common';
import type { ProjectRoleName } from '../../projects/project-role.entity';

export const ROLES_KEY = 'chip_roles';
export type AnyChipRole = 'chip_admin' | 'tracker' | ProjectRoleName;

/**
 * Marks a route with required roles. Guard `RolesGuard` reads this metadata.
 * For project-scoped routes, use `@Roles('marketer')` / `@Roles('owner_viewer')`
 * + include `projectId` in the path or body; the guard picks it up automatically.
 *
 * Global roles: `chip_admin` (Чиркова) и `tracker` (операционный менеджер).
 * `tracker` не имеет доступа к billing-эндпоинтам — там исключительно `chip_admin`.
 * Для ops-эндпоинтов пишется `@Roles('chip_admin', 'tracker')`.
 */
export const Roles = (...roles: AnyChipRole[]) => SetMetadata(ROLES_KEY, roles);
