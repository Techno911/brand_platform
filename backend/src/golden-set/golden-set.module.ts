import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoldenSetRun } from './golden-set-run.entity';
import { GoldenSetService } from './golden-set.service';
import { GoldenSetFixturesService } from './golden-set-fixtures.service';
import { GoldenSetController } from './golden-set.controller';
import { AIModule } from '../ai/ai.module';
import { ValidatorModule } from '../validator/validator.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GoldenSetRun]),
    AIModule,
    ValidatorModule,
    ObservabilityModule,
  ],
  providers: [GoldenSetService, GoldenSetFixturesService],
  controllers: [GoldenSetController],
  exports: [GoldenSetService, GoldenSetFixturesService],
})
export class GoldenSetModule {}
