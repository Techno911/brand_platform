import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';

/** chip_admin notifications (Gurbanov, Elkin pattern). Stage changes, wizard stuck, budget alerts. */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger('TelegramBotService');
  private readonly token: string;
  private readonly adminChatId: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('observability.telegramBotToken') ?? '';
    this.adminChatId = this.config.get<string>('observability.telegramAdminChatId') ?? '';
    this.enabled = Boolean(this.token && this.adminChatId);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async notify(text: string, extra?: { parseMode?: 'Markdown' | 'HTML' }): Promise<{ ok: boolean; reason?: string }> {
    if (!this.enabled) return { ok: false, reason: 'telegram_disabled' };
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        chat_id: this.adminChatId,
        text,
        parse_mode: extra?.parseMode ?? 'Markdown',
        disable_web_page_preview: true,
      });
      const req = https.request(
        {
          method: 'POST',
          hostname: 'api.telegram.org',
          path: `/bot${this.token}/sendMessage`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 5000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.from(c)));
          res.on('end', () => {
            const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
            if (!ok) {
              this.logger.warn(
                `telegram notify ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`,
              );
            }
            resolve({ ok, reason: ok ? undefined : `http_${res.statusCode}` });
          });
        },
      );
      req.on('error', (err) => {
        this.logger.warn(`telegram notify failed: ${err?.message}`);
        resolve({ ok: false, reason: err?.message });
      });
      req.write(payload);
      req.end();
    });
  }
}
