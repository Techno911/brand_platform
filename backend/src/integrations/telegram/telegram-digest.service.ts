import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, In, Repository } from 'typeorm';
import { PromptRun } from '../../observability/prompt-run.entity';
import { AuditEvent } from '../../observability/audit-event.entity';
import { SecurityEvent } from '../../security/security-event.entity';
import { GoldenSetRun } from '../../golden-set/golden-set-run.entity';
import { TelegramBotService } from './telegram-bot.service';

/**
 * Ежедневный дайджест для chip_admin в Telegram. Cron стреляет в 09:00 MSK,
 * считает срезы за последние 24 часа по четырём таблицам и шлёт одно сообщение.
 *
 * Паттерн Горшкова: админ открывает телефон утром — одно сообщение закрывает вопрос
 * «вчера всё было тихо?». Без дайджеста админ заходит в Grafana и смотрит 5 дашбордов
 * → уходит, так и не поняв, надо ли реагировать.
 *
 * Контент специально лаконичный — 4 числа + ссылка на админку. Детали — по клику.
 */
@Injectable()
export class TelegramDigestService {
  private readonly logger = new Logger('TelegramDigestService');
  private readonly frontendUrl: string;

  constructor(
    private readonly bot: TelegramBotService,
    private readonly config: ConfigService,
    @InjectRepository(PromptRun) private readonly runs: Repository<PromptRun>,
    @InjectRepository(AuditEvent) private readonly audit: Repository<AuditEvent>,
    @InjectRepository(SecurityEvent) private readonly security: Repository<SecurityEvent>,
    @InjectRepository(GoldenSetRun) private readonly golden: Repository<GoldenSetRun>,
  ) {
    this.frontendUrl =
      this.config.get<string>('frontendUrl') ?? 'https://bp.chirkov.info';
  }

  /**
   * 09:00 по Москве. Если бот не сконфигурирован (пустые env) — notify() вернёт
   * ok:false, логируем и выходим. Не 500, не throw — cron не должен падать.
   */
  @Cron('0 9 * * *', { timeZone: 'Europe/Moscow' })
  async dailyDigest(): Promise<void> {
    if (!this.bot.isEnabled()) {
      this.logger.log('daily digest skipped — telegram bot not configured');
      return;
    }
    const result = await this.sendDigest('cron');
    if (!result.ok) {
      this.logger.warn(`daily digest send failed: ${result.reason ?? 'unknown'}`);
    }
  }

  /**
   * Публичный метод для ручного триггера через POST /integrations/telegram/digest-now.
   * Возвращает ok/reason — контроллер отдаёт это клиенту.
   */
  async sendNow(): Promise<{ ok: boolean; reason?: string }> {
    return this.sendDigest('manual');
  }

  private async sendDigest(source: 'cron' | 'manual'): Promise<{ ok: boolean; reason?: string }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Параллельно считаем срезы — четыре независимых count'а.
    const [critSec, silent, regressions, approvals] = await Promise.all([
      this.security.count({
        where: { detectedAt: MoreThan(since), severity: In(['high', 'critical']) },
      }),
      this.runs.count({
        where: { createdAt: MoreThan(since), status: In(['failed', 'budget_exceeded']) },
      }),
      this.golden
        .createQueryBuilder('g')
        .where('g.started_at > :since', { since })
        .andWhere('g.aggregate_regression > g.threshold')
        .getCount(),
      this.audit.count({
        where: { createdAt: MoreThan(since), type: 'owner.approved' },
      }),
    ]);

    const adminUrl = `${this.frontendUrl.replace(/\/$/, '')}/admin/security`;
    const header = source === 'manual' ? '🧪 Тестовый дайджест BP' : '🌅 Дайджест BP за сутки';
    const body = [
      '',
      `🔒 Критичных инцидентов безопасности: *${critSec}*`,
      `⚠️ Провальных AI-вызовов: *${silent}*`,
      `📉 Регрессий эталонов: *${regressions}*`,
      `✅ Утверждений собственниками: *${approvals}*`,
      '',
      `Админка: ${adminUrl}`,
    ].join('\n');
    const text = `${header}\n${body}`;

    return this.bot.notify(text, { parseMode: 'Markdown' });
  }
}
