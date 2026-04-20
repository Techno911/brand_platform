import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BillingConfigService } from './billing-config.service';
import { InvoiceService } from './invoice.service';
import { InvoiceStatus } from './invoice.entity';

class UpdateCostFactorDto {
  @IsNumber() @Min(0.01) value!: number;
  @IsString() reason!: string;
}

class UpdateMarkupDto {
  @IsNumber() @Min(0) percent!: number;
}

class UpdateRateDto {
  @IsNumber() @Min(0.01) rate!: number;
}

class UpdateTariffDto {
  @IsOptional() @IsNumber() monthly_rub?: number;
  @IsOptional() @IsNumber() included_projects?: number;
  @IsOptional() @IsNumber() markup_percent?: number;
  @IsOptional() @IsNumber() sla_hours?: number;
  @IsOptional() @IsNumber() manual_review_hours?: number;
  @IsOptional() includes_offline_meeting?: boolean;
}

class IssueSubscriptionDto {
  @IsString() clientId!: string;
  @IsString() tariff!: string;
}

class SetInvoiceStatusDto {
  @IsIn(['draft', 'issued', 'paid', 'cancelled']) status!: InvoiceStatus;
  @IsOptional() @IsString() paymentRef?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly cfg: BillingConfigService,
    private readonly invoices: InvoiceService,
  ) {}

  @Roles('chip_admin')
  @Get('config')
  getConfig() {
    return this.cfg.get();
  }

  @Roles('chip_admin')
  @Patch('config/cost-factor')
  setCostFactor(@Body() dto: UpdateCostFactorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cfg.updateCostFactor(dto.value, user.id, dto.reason);
  }

  @Roles('chip_admin')
  @Patch('config/markup')
  setMarkup(@Body() dto: UpdateMarkupDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cfg.updateMarkup(dto.percent, user.id);
  }

  @Roles('chip_admin')
  @Patch('config/rate')
  setRate(@Body() dto: UpdateRateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cfg.updateCurrencyRate(dto.rate, user.id);
  }

  @Roles('chip_admin')
  @Patch('config/tariff/:key')
  setTariff(
    @Param('key') key: string,
    @Body() dto: UpdateTariffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cfg.updateTariff(key, dto, user.id);
  }

  @Roles('chip_admin')
  @Get('invoices')
  listInvoices(@Query('projectId') projectId?: string) {
    return projectId ? this.invoices.listForProject(projectId) : this.invoices.list();
  }

  @Roles('chip_admin')
  @Post('invoices/subscription')
  issueSub(@Body() dto: IssueSubscriptionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.issueSubscription(dto.clientId, dto.tariff, user.id);
  }

  @Roles('chip_admin')
  @Post('invoices/project/:projectId/finalize')
  issueFinalization(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.issueProjectFinalization(projectId, user.id);
  }

  @Roles('chip_admin')
  @Patch('invoices/:id/status')
  setInvoiceStatus(
    @Param('id') id: string,
    @Body() dto: SetInvoiceStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoices.setStatus(id, dto.status, user.id, dto.paymentRef);
  }
}
