import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { GoldenSetService } from './golden-set.service';
import { GoldenSetFixturesService } from './golden-set-fixtures.service';

class RunDto {
  @IsString() promptVersion!: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() commitSha?: string;
  @IsOptional() @IsString() tag?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('golden-set')
export class GoldenSetController {
  constructor(
    private readonly runner: GoldenSetService,
    private readonly fixtures: GoldenSetFixturesService,
  ) {}

  @Roles('chip_admin', 'tracker')
  @Get('cases')
  cases() {
    return this.fixtures.list();
  }

  @Roles('chip_admin', 'tracker')
  @Post('run')
  run(@Body() dto: RunDto, @CurrentUser() u: AuthenticatedUser) {
    return this.runner.run({
      promptVersion: dto.promptVersion,
      model: dto.model ?? 'claude-opus-4-7',
      commitSha: dto.commitSha,
      triggeredBy: u.email,
      userId: u.id,
      tag: dto.tag,
    });
  }

  @Roles('chip_admin', 'tracker')
  @Get('history')
  history(@Query('limit') limit?: string) {
    return this.runner.history(limit ? Number(limit) : 50);
  }
}
