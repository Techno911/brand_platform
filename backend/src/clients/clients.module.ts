import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ContractParserService } from './contract-parser.service';
import { AIModule } from '../ai/ai.module';

@Module({
  // AIModule экспортирует PromptLoaderService + VendorRouterService, которые
  // нужны ContractParserService. Циклов нет: AI не зависит от Clients.
  imports: [TypeOrmModule.forFeature([Client]), AIModule],
  providers: [ClientsService, ContractParserService],
  controllers: [ClientsController],
  exports: [ClientsService, TypeOrmModule],
})
export class ClientsModule {}
