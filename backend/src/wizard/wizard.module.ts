import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Row } from './row.entity';
import { Draft } from './draft.entity';
import { Approval } from './approval.entity';
import { Project } from '../projects/project.entity';
import { WizardService } from './wizard.service';
import { Stage1Service } from './stages/stage-1.service';
import { Stage2Service } from './stages/stage-2.service';
import { Stage3Service } from './stages/stage-3.service';
import { Stage4Service } from './stages/stage-4.service';
import { FeedbackService } from './feedback.service';
import { ApprovalService } from './approval.service';
import { WizardController } from './wizard.controller';
import { AIModule } from '../ai/ai.module';
import { ValidatorModule } from '../validator/validator.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ExporterModule } from '../exporter/exporter.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Row, Draft, Approval, Project]),
    AIModule,
    ValidatorModule,
    ObservabilityModule,
    ExporterModule,
    ProjectsModule,
  ],
  providers: [
    WizardService,
    Stage1Service,
    Stage2Service,
    Stage3Service,
    Stage4Service,
    FeedbackService,
    ApprovalService,
  ],
  controllers: [WizardController],
  exports: [
    WizardService,
    Stage1Service,
    Stage2Service,
    Stage3Service,
    Stage4Service,
    FeedbackService,
    ApprovalService,
  ],
})
export class WizardModule {}
