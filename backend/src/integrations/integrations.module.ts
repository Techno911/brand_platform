import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElevenLabsService } from './elevenlabs/elevenlabs.service';
import { FirefliesService } from './fireflies/fireflies.service';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramDigestService } from './telegram/telegram-digest.service';
import { CausalImpactService } from './causal-impact/causal-impact.service';
import { IntegrationsController } from './integrations.controller';
import { ObservabilityModule } from '../observability/observability.module';
import { SecurityEvent } from '../security/security-event.entity';
import { GoldenSetRun } from '../golden-set/golden-set-run.entity';

// AuthModule теперь @Global(), предоставляет JwtAuthGuard / RolesGuard / ProjectRole repo автоматически.
// SecurityEvent + GoldenSetRun регистрируем локально для TelegramDigestService:
// SecurityModule / GoldenSetModule не экспортируют TypeOrmModule.forFeature, поэтому биндим
// здесь — одна сущность может быть зарегистрирована в нескольких модулях, это нормально.
@Module({
  imports: [
    ConfigModule,
    ObservabilityModule,
    TypeOrmModule.forFeature([SecurityEvent, GoldenSetRun]),
  ],
  providers: [
    ElevenLabsService,
    FirefliesService,
    TelegramBotService,
    TelegramDigestService,
    CausalImpactService,
  ],
  controllers: [IntegrationsController],
  exports: [
    ElevenLabsService,
    FirefliesService,
    TelegramBotService,
    TelegramDigestService,
    CausalImpactService,
  ],
})
export class IntegrationsModule {}
