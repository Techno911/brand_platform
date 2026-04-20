import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  globalRole: 'chip_admin' | 'tracker' | null;
  // populated lazily by RolesGuard when a route is project-scoped
  projectRoles?: Record<string, string[]>;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return req.user;
  },
);
