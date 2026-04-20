import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  // ObservabilityModule даёт AuditService — пишем audit-лог при reset-password,
  // удалении, смене роли (чувствительные операции chip_admin'a).
  imports: [TypeOrmModule.forFeature([User]), ObservabilityModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
