import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GlobalLLMQueueService } from './global-llm-queue.service';
import { ProjectBusyService } from './project-busy.service';
import { VendorRouterService } from './vendor-router.service';

/**
 * AI introspection endpoints.
 *
 * Назначение:
 *   - `/ai/queue/depth` — для баннера маркетологу «впереди в очереди N»
 *     (опрашивается раз в 5с клиентом). Возвращает поверхностную цифру,
 *     без per-vendor деталей (не раскрываем кухню клиенту).
 *   - `/ai/queue/snapshot` — для chip_admin dashboard (RBAC gated):
 *     полная картина per-vendor (rpm/tpm usage, inFlight, queue).
 *   - `/ai/projects/:id/busy` — проверка занят ли проект (для UI spinner).
 *   - `/ai/vendors` — список доступных провайдеров (chip_admin).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AIController {
  constructor(
    private readonly queue: GlobalLLMQueueService,
    private readonly projectBusy: ProjectBusyService,
    private readonly router: VendorRouterService,
  ) {}

  /** Публичный для всех залогиненных — маркетолог видит глобальную глубину. */
  @Get('queue/depth')
  queueDepth() {
    return { depth: this.queue.queueDepth() };
  }

  /** chip_admin + tracker — полная картина по вендорам (операционная диагностика). */
  @Roles('chip_admin', 'tracker')
  @Get('queue/snapshot')
  queueSnapshot() {
    return {
      global: { depth: this.queue.queueDepth() },
      vendors: this.queue.snapshot(),
    };
  }

  /** Маркетолог может спросить «свободен ли проект» для UI. */
  @Roles('chip_admin', 'tracker', 'marketer', 'owner_viewer')
  @Get('projects/:id/busy')
  async projectBusyCheck(@Param('id') id: string) {
    const free = await this.projectBusy.isFree(id);
    return { projectId: id, busy: !free };
  }

  /** chip_admin + tracker — какие вендоры сконфигурированы и доступны. */
  @Roles('chip_admin', 'tracker')
  @Get('vendors')
  vendors() {
    return this.router.allProviders().map((p) => ({
      vendor: p.vendor,
      available: p.isAvailable(),
      defaultModel: p.defaultModel(),
      judgeModel: p.judgeModel(),
      rateLimits: p.rateLimits(),
    }));
  }
}
