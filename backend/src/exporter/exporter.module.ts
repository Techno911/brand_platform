import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Project } from '../projects/project.entity';
import { Row } from '../wizard/row.entity';
import { ExporterService } from './exporter.service';
import { S3ImmutableService } from './s3-immutable.service';
import { DocxExporterClient } from './docx-exporter.client';
import { XlsxExporterService } from './xlsx-exporter.service';
import { ExporterController } from './exporter.controller';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Project, Row]),
    ObservabilityModule,
  ],
  providers: [ExporterService, S3ImmutableService, DocxExporterClient, XlsxExporterService],
  controllers: [ExporterController],
  exports: [ExporterService, XlsxExporterService, S3ImmutableService, DocxExporterClient],
})
export class ExporterModule {}
