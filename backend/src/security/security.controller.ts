import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SecurityEventsService } from './security-events.service';
import { ToolCallSandboxService } from './tool-call-sandbox.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('security')
export class SecurityController {
  constructor(
    private readonly events: SecurityEventsService,
    private readonly toolSandbox: ToolCallSandboxService,
  ) {}

  @Roles('chip_admin', 'tracker')
  @Get('events')
  list(@Query('limit') limit?: string) {
    return this.events.list(limit ? Number(limit) : 500);
  }

  @Roles('chip_admin', 'tracker')
  @Get('projects/:id/events')
  listForProject(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.events.listByProject(id, limit ? Number(limit) : 200);
  }

  @Roles('chip_admin', 'tracker')
  @Get('tool-whitelist')
  whitelist() {
    return { tools: this.toolSandbox.list() };
  }
}
