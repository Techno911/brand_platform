import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response, CookieOptions } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ProjectRole } from '../projects/project-role.entity';

/**
 * Refresh-cookie hardening (INSIGHTS §5 + dev vs prod):
 *  - httpOnly   — не читается из JS фронта, защита от XSS-угонов.
 *  - sameSite=strict — защита от CSRF.
 *  - secure      — только HTTPS. Включаем в production; в dev без TLS cookie не поставилась бы.
 *  - path=/api/auth — cookie отправляется только на auth-маршруты.
 *  - maxAge=7d   — совпадает с JWT refresh TTL.
 * Тело ответа продолжает содержать refreshToken (backwards-compat с уже деплоенным фронтом);
 * фронт должен мигрировать на cookie-only refresh в следующем релизе.
 */
const REFRESH_COOKIE = 'refresh_token';
function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ProjectRole) private readonly projectRoles: Repository<ProjectRole>,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(
      dto.email,
      dto.password,
      req.ip,
      req.headers['user-agent'],
    );
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    return result;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Приоритет cookie, fallback на тело (для legacy-клиентов).
    const token =
      (req as unknown as { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE] ??
      dto.refreshToken;
    const result = await this.auth.refresh(token);
    // refresh ротация опционально; пока оставляем исходную cookie.
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post('whoami')
  @HttpCode(200)
  async whoami(@CurrentUser() user: AuthenticatedUser) {
    // После reload фронт хочет полный AuthUser: fullName + projectRoles (для role-based nav).
    // JwtStrategy.validate() кладёт только {id, email, globalRole} — здесь дообогащаем из БД.
    const full = await this.users.findOne({ where: { id: user.id, isActive: true } });
    if (!full) {
      return { id: user.id, email: user.email, fullName: '', globalRole: user.globalRole };
    }
    const roles = await this.projectRoles.find({ where: { userId: user.id } });
    return {
      id: full.id,
      email: full.email,
      fullName: full.fullName,
      globalRole: full.globalRole,
      projectRoles: roles.map((r) => ({
        projectId: r.projectId,
        role: r.role,
        isPrimary: r.isPrimary,
      })),
    };
  }
}
