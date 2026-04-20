import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { GoldenSetModule } from '../golden-set/golden-set.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([]), GoldenSetModule, ObservabilityModule],
  controllers: [HealthController],
  providers: [ScheduledTasksService],
  exports: [ScheduledTasksService],
})
export class HealthModule {}
