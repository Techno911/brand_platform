import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { User } from '../users/user.entity';
import { ProjectRole } from '../projects/project-role.entity';
import { ObservabilityModule } from '../observability/observability.module';

/**
 * @Global — JwtAuthGuard / RolesGuard нужны почти во всех модулях, а RolesGuard
 * требует ProjectRole repo в контексте модуля, где используется UseGuards(...).
 * Вместо того чтобы прописывать TypeOrmModule.forFeature([ProjectRole]) в 10+ модулях,
 * делаем AuthModule глобальным — он экспортирует и гарды, и ProjectRole-repo.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, ProjectRole]),
    ObservabilityModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  // Re-экспорт TypeOrmModule.forFeature делает ProjectRoleRepository
  // доступным в любом модуле, куда AuthModule виден через @Global().
  exports: [
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
