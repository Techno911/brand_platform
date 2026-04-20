import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SecurityEvent } from './security-event.entity';
import { BriefSanitizerService } from './brief-sanitizer.service';
import { PiiRedactorService } from './pii-redactor.service';
import { ToolCallSandboxService } from './tool-call-sandbox.service';
import { SecurityEventsService } from './security-events.service';
import { SecurityController } from './security.controller';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SecurityEvent]),
    ObservabilityModule,
  ],
  providers: [
    BriefSanitizerService,
    PiiRedactorService,
    ToolCallSandboxService,
    SecurityEventsService,
  ],
  controllers: [SecurityController],
  exports: [
    BriefSanitizerService,
    PiiRedactorService,
    ToolCallSandboxService,
    SecurityEventsService,
  ],
})
export class SecurityModule {}
