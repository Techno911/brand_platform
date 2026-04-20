import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingConfig } from './billing-config.entity';
import { Invoice } from './invoice.entity';
import { Project } from '../projects/project.entity';
import { Client } from '../clients/client.entity';
import { BillingConfigService } from './billing-config.service';
import { InvoiceService } from './invoice.service';
import { BillingController } from './billing.controller';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BillingConfig, Invoice, Project, Client]),
    ObservabilityModule,
  ],
  providers: [BillingConfigService, InvoiceService],
  controllers: [BillingController],
  exports: [BillingConfigService, InvoiceService, TypeOrmModule],
})
export class BillingModule {}
