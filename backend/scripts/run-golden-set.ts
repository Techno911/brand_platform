/**
 * run-golden-set.ts — CLI-обёртка для ночного прогона и CI-gate.
 *
 * Ожидаемое поведение:
 *   - Поднимает NestApplicationContext без HTTP-слоя.
 *   - Вызывает GoldenSetService.run({ promptVersion, model, triggeredBy }).
 *   - Печатает JSON-отчёт в stdout.
 *   - Exit code = 1 при regression > threshold (чтобы CI блокировал merge).
 *
 * INSIGHTS §4 / C-5: `>15%` регрессии блокирует релиз промптов.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GoldenSetService } from '../src/golden-set/golden-set.service';
import { ConfigService } from '@nestjs/config';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const goldenSet = app.get(GoldenSetService);
    const config = app.get(ConfigService);

    const promptVersion = process.env.PROMPT_VERSION ?? 'cli';
    const model = config.get<string>('anthropic.model') ?? 'claude-opus-4-7';
    const commitSha = process.env.GIT_COMMIT_SHA ?? null;
    const tag = process.env.GOLDEN_SET_TAG ?? undefined;

    const report = await goldenSet.run({
      promptVersion,
      model,
      commitSha: commitSha ?? undefined,
      triggeredBy: process.env.GOLDEN_SET_TRIGGERED_BY ?? 'ci',
      tag,
    });
    console.log(JSON.stringify(report, null, 2));

    if (report.status === 'failed') {
      console.error(
        `\n✗ golden-set regression ${report.aggregateRegression.toFixed(4)} > threshold ${report.threshold}`,
      );
      process.exit(1);
    } else {
      console.log(
        `\n✓ golden-set passed (aggregate ${report.aggregateRegression.toFixed(4)} ≤ threshold ${report.threshold})`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('golden-set runner failed:', err);
  process.exit(1);
});
