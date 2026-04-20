import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ElevenLabsService } from './elevenlabs/elevenlabs.service';
import { FirefliesService } from './fireflies/fireflies.service';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { TelegramDigestService } from './telegram/telegram-digest.service';

class ElevenDto {
  @IsString() projectId!: string;
  @IsString() ownerName!: string;
}

class FirefliesDto {
  @IsString() meetingId!: string;
}

class TelegramDto {
  @IsString() text!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly elevenlabs: ElevenLabsService,
    private readonly fireflies: FirefliesService,
    private readonly telegram: TelegramBotService,
    private readonly telegramDigest: TelegramDigestService,
  ) {}

  @Roles('chip_admin', 'tracker')
  @Get('status')
  status() {
    return {
      elevenlabs: this.elevenlabs.isEnabled(),
      fireflies: this.fireflies.isEnabled(),
      telegram: this.telegram.isEnabled(),
    };
  }

  @Roles('chip_admin', 'tracker')
  @Post('elevenlabs/pre-session')
  preSession(@Body() dto: ElevenDto) {
    return this.elevenlabs.generatePreSessionLink(dto.projectId, dto.ownerName);
  }

  @Roles('chip_admin', 'tracker')
  @Post('fireflies/fetch')
  firefliesFetch(@Body() dto: FirefliesDto) {
    return this.fireflies.fetchTranscript(dto.meetingId);
  }

  @Roles('chip_admin', 'tracker')
  @Post('telegram/notify')
  telegramNotify(@Body() dto: TelegramDto) {
    return this.telegram.notify(dto.text);
  }

  /**
   * Ручной триггер ежедневного дайджеста — для теста без ожидания 09:00 MSK.
   * Считает срезы за последние 24 часа по 4 таблицам и шлёт admin-chat'у.
   * Если бот не настроен — возвращает {ok:false}, не 500.
   */
  @Roles('chip_admin', 'tracker')
  @Post('telegram/digest-now')
  telegramDigestNow() {
    return this.telegramDigest.sendNow();
  }
}
