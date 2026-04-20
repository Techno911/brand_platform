import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * ProjectBusyService — per-project mutex через PostgreSQL advisory lock.
 *
 * Зачем (ответ на ВВ Вани от 17.04.2026):
 *   «Если у тебя садится работать несколько человек, сколько промтов можно
 *    гонять за раз».
 *
 * Но здесь более узкая семантика: **в рамках одного проекта** два
 * одновременных AI-вызова запрещены. Причина методологическая, не только
 * техническая:
 *   - Stage 2 «генерация ценности» и Stage 2 «генерация миссии» не должны
 *     стартовать параллельно. Миссия строится **на основе утверждённых
 *     ценностей** — race condition приведёт к тому, что миссия будет
 *     сгенерирована на стоке черновика ценностей (до правок маркетолога).
 *   - Golden-set прогон и живая генерация на одном проекте → проект
 *     «исчерпает бюджет» на параллельных запусках, kill-switch не сработает
 *     вовремя.
 *
 * Реализация:
 *   - `pg_try_advisory_xact_lock(key)` — non-blocking, возвращает false если
 *     занят. Lock автоматически освобождается при COMMIT/ROLLBACK
 *     транзакции. Для нас это удобно: `withLock` оборачивает AI-вызов в
 *     транзакцию, lock держится только пока идёт вызов.
 *   - Key = int64 hash от projectId (uuid). Используем pg advisory lock
 *     ключевой формат (bigint).
 *   - Блокировка рекурсивна не нужна: если тот же маркетолог запустит
 *     второй вызов — получит 409 PROJECT_BUSY + UI-подсказку «подождите».
 */
@Injectable()
export class ProjectBusyService {
  private readonly logger = new Logger('ProjectBusyService');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /**
   * Выполнить `fn` под project-level advisory lock. Если lock уже держит
   * другой инстанс — бросаем ConflictException `PROJECT_BUSY` (HTTP 409).
   */
  async withLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const key = this.keyFor(projectId);
    return await this.ds.transaction(async (mgr) => {
      const rows: Array<{ acquired: boolean }> = await mgr.query(
        'SELECT pg_try_advisory_xact_lock($1) AS acquired',
        [key],
      );
      const acquired = rows?.[0]?.acquired === true;
      if (!acquired) {
        throw new ConflictException({
          error: 'PROJECT_BUSY',
          message:
            'В этом проекте уже идёт генерация. Дождитесь её завершения — обычно 10-60 секунд.',
          projectId,
        });
      }
      return await fn();
    });
  }

  /**
   * Ненавязчивая проверка без захвата — для UI-кнопок (показать spinner
   * превентивно). Возвращает true, если lock свободен (best-effort — сразу
   * после вызова ситуация может измениться).
   */
  async isFree(projectId: string): Promise<boolean> {
    const key = this.keyFor(projectId);
    try {
      // Запрашиваем + сразу отпускаем (session-level для проверки).
      const rows: Array<{ acquired: boolean }> = await this.ds.query(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [key],
      );
      const acquired = rows?.[0]?.acquired === true;
      if (acquired) {
        await this.ds.query('SELECT pg_advisory_unlock($1)', [key]);
        return true;
      }
      return false;
    } catch (err: any) {
      this.logger.warn(`isFree() check failed: ${err?.message}`);
      return true; // fail-open, не блокируем UI из-за потери соединения
    }
  }

  /**
   * Hash UUID → bigint for advisory lock. Postgres требует int64, UUID =
   * 128 бит — берём первые 8 байт как int64, знак игнорируем (cast на
   * сервере через ::bigint). Коллизии в рамках 10-30 клиентов BP
   * вероятность <1e-12 — приемлемо.
   */
  private keyFor(projectId: string): string {
    const clean = projectId.replace(/-/g, '').slice(0, 16);
    // Берём первые 16 hex chars (8 bytes = 64 bits). Конвертируем через
    // BigInt чтобы получить signed int64 (pg advisory lock key).
    const big = BigInt('0x' + clean);
    // Clamp в signed int64 range.
    const max = BigInt('0x7fffffffffffffff');
    const signed = big > max ? big - (max + 1n) * 2n : big;
    return signed.toString();
  }
}
