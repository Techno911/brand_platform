import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromptRun } from './prompt-run.entity';
import { AuditEvent } from './audit-event.entity';
import { MarketerQualityScore } from './marketer-quality-score.entity';
import { WizardStepEventRecord } from './wizard-step-event.entity';
import { User } from '../users/user.entity';
import { AuditService } from './audit.service';
import { PromptRunService } from './prompt-run.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { ObservabilityController } from './observability.controller';
import { MarketerQualityService } from './marketer-quality.service';
import { WizardStepEventsService } from './wizard-step-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PromptRun, AuditEvent, MarketerQualityScore, WizardStepEventRecord, User]),
  ],
  providers: [
    AuditService,
    PromptRunService,
    MetricsService,
    MarketerQualityService,
    WizardStepEventsService,
  ],
  controllers: [MetricsController, ObservabilityController],
  exports: [
    AuditService,
    PromptRunService,
    MetricsService,
    MarketerQualityService,
    WizardStepEventsService,
    TypeOrmModule,
  ],
})
export class ObservabilityModule {}
