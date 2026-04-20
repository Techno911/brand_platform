import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsObject, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ValidatorService } from './validator.service';

class ValidateDto {
  @IsUUID() projectId!: string;
  @IsString()
  @IsIn(['value', 'mission', 'vision', 'legend', 'archetype', 'positioning', 'we_we_are_not_pair', 'brand_message'])
  artifact!: string;
  @IsObject() payload!: Record<string, any>;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('validator')
export class ValidatorController {
  constructor(private readonly validator: ValidatorService) {}

  @Roles('chip_admin', 'tracker', 'marketer')
  @Post('run')
  run(@Body() dto: ValidateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.validator.validate({
      projectId: dto.projectId,
      userId: user.id,
      artifact: dto.artifact,
      payload: dto.payload,
    });
  }
}
