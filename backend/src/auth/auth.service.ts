import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { ProjectRole } from '../projects/project-role.entity';
import { AuditService } from '../observability/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ProjectRole) private readonly projectRoles: Repository<ProjectRole>,
  ) {}

  async login(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.users.findOne({ where: { email, isActive: true } });
    // Сообщения по-русски (CLAUDE.md: UI-тексты на русском). Generic "Неверный email или пароль"
    // одинаково для "user not found" и "wrong password" — enumeration-protection.
    if (!user) throw new UnauthorizedException('Неверный email или пароль');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный email или пароль');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.cfg.get('jwt.accessSecret'),
        expiresIn: this.cfg.get('jwt.accessTtl') ?? '15m',
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, typ: 'refresh' },
      {
        secret: this.cfg.get('jwt.refreshSecret'),
        expiresIn: this.cfg.get('jwt.refreshTtl') ?? '7d',
      },
    );

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    user.lastLoginAt = new Date();
    await this.users.save(user);

    await this.audit.record({
      type: 'auth.login',
      userId: user.id,
      responsibleUserId: user.id,
      ipAddress: ip,
      userAgent: ua,
    });

    // Обогащаем ответ projectRoles — иначе Layout.tsx показывает "Пользователь"
    // вместо "Маркетолог клиента"/"Собственник" до первого whoami-refresh'а.
    // Форма ответа должна совпадать с whoami (auth.controller.ts:86-108).
    const roles = await this.projectRoles.find({ where: { userId: user.id } });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        globalRole: user.globalRole,
        projectRoles: roles.map((r) => ({
          projectId: r.projectId,
          role: r.role,
          isPrimary: r.isPrimary,
        })),
      },
    };
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('No refresh token');
    let payload: { sub: string; email: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.cfg.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') throw new UnauthorizedException('Not a refresh token');

    const user = await this.users.findOne({ where: { id: payload.sub, isActive: true } });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException('User not found');

    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token revoked');

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.cfg.get('jwt.accessSecret'),
        expiresIn: this.cfg.get('jwt.accessTtl') ?? '15m',
      },
    );

    await this.audit.record({
      type: 'auth.refresh',
      userId: user.id,
      responsibleUserId: user.id,
    });

    return { accessToken };
  }

  async logout(userId: string) {
    await this.users.update(userId, { refreshTokenHash: null });
    await this.audit.record({ type: 'auth.logout', userId, responsibleUserId: userId });
  }
}
