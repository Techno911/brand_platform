import { Module } from '@nestjs/common';
import { RegexValidatorService } from './regex-validator.service';
import { LlmJudgeService } from './llm-judge.service';
import { MethodologyComplianceService } from './methodology-compliance.service';
import { BorderlineClassifierService } from './borderline-classifier.service';
import { ValidatorService } from './validator.service';
import { ValidatorController } from './validator.controller';
import { AIModule } from '../ai/ai.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [AIModule, ObservabilityModule],
  providers: [
    RegexValidatorService,
    LlmJudgeService,
    MethodologyComplianceService,
    BorderlineClassifierService,
    ValidatorService,
  ],
  controllers: [ValidatorController],
  exports: [ValidatorService, BorderlineClassifierService],
})
export class ValidatorModule {}
