import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoldenSetService } from '../golden-set/golden-set.service';

/**
 * INSIGHTS §1 "Routines (scheduled tasks): nightly golden-set — yes".
 * Runs nightly at 03:00 server time; uses latest prompt version tag in env var.
 */
@Injectable()
export class ScheduledTasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ScheduledTasksService');
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly goldenSet: GoldenSetService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    // Check every 30 minutes whether we are past the 3 AM boundary since last run.
    const lastRunKey = 'bp:golden-set:last-run';
    let lastRun = 0;
    this.timer = setInterval(async () => {
      try {
        const now = new Date();
        const hour = now.getHours();
        if (hour !== 3) return;
        if (Date.now() - lastRun < 22 * 60 * 60 * 1000) return;
        lastRun = Date.now();
        this.logger.log(`Nightly golden-set run starting`);
        const version = process.env.PROMPT_VERSION ?? 'nightly';
        const model = this.config.get<string>('anthropic.model') ?? 'claude-opus-4-7';
        await this.goldenSet.run({
          promptVersion: version,
          model,
          triggeredBy: 'cron-nightly',
        });
      } catch (err: any) {
        this.logger.error(`Nightly golden-set run failed: ${err?.message}`);
      }
    }, 30 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
