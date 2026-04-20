import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { PromptRunService } from './prompt-run.service';
import { MarketerQualityService } from './marketer-quality.service';
import { WizardStepEventsService } from './wizard-step-events.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('observability')
export class ObservabilityController {
  constructor(
    private readonly audit: AuditService,
    private readonly promptRuns: PromptRunService,
    private readonly marketerQuality: MarketerQualityService,
    private readonly wizardEvents: WizardStepEventsService,
  ) {}

  /**
   * Silent failures — журнал упавших prompt_run (Горшков-паттерн).
   * Запрос делегируется в PromptRunService: status IN (failed, budget_exceeded,
   * rate_limited, sanitized_out) ИЛИ retry_count >= retries.
   *
   * Возвращаем prompt_run native-поля — фронт (SilentFailuresPage) рендерит
   * ID / kind / status / errorCode / retryCount / providerLatencyMs / createdAt
   * напрямую, без маппинга. audit_events для этой страницы НЕ используем —
   * в audit нет retry/latency, и страница бы показывала «—» там, где должны
   * быть секунды и ретраи.
   */
  @Roles('chip_admin', 'tracker')
  @Get('silent-failures')
  silentFailures(
    @Query('retries') retries?: string,
    @Query('limit') limit?: string,
  ) {
    return this.promptRuns.listSilentFailures(
      retries ? Number(retries) : 3,
      limit ? Number(limit) : 500,
    );
  }

  @Roles('chip_admin', 'tracker')
  @Get('projects/:id/prompt-runs')
  promptsForProject(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.promptRuns.listByProject(id, limit ? Number(limit) : 200);
  }

  @Roles('chip_admin', 'tracker')
  @Get('projects/:id/audit')
  auditForProject(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.audit.listByProject(id, limit ? Number(limit) : 200);
  }

  @Roles('chip_admin', 'tracker')
  @Get('marketer-quality')
  marketerQualityDashboard() {
    return this.marketerQuality.dashboard();
  }

  @Roles('chip_admin', 'tracker')
  @Get('projects/:id/wizard-events')
  wizardEventsForProject(@Param('id') id: string) {
    return this.wizardEvents.listByProject(id);
  }

  @Roles('chip_admin', 'tracker')
  @Get('wizard-dropoff')
  wizardDropoff() {
    return this.wizardEvents.dropoffFunnel();
  }
}
