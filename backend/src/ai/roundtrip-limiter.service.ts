import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * INSIGHTS §5 delta-9: if multi-agent roundtrips ping-pong, cap them.
 * In-memory per (projectId + stage). Soft cap — enforces max N calls/stage/hour.
 */
@Injectable()
export class RoundtripLimiterService {
  private readonly counters = new Map<string, { count: number; resetAt: number }>();
  private readonly max: number;

  constructor(private readonly config: ConfigService) {
    this.max = this.config.get<number>('ai.maxAgentRoundtripsPerStage') ?? 5;
  }

  private key(projectId: string, stage: number) {
    return `${projectId}#${stage}`;
  }

  /** Returns false if limit hit. Auto-resets every hour. */
  tryIncrement(projectId: string, stage: number): { allowed: boolean; count: number; max: number } {
    const k = this.key(projectId, stage);
    const now = Date.now();
    let rec = this.counters.get(k);
    if (!rec || rec.resetAt < now) {
      rec = { count: 0, resetAt: now + 60 * 60 * 1000 };
    }
    rec.count++;
    this.counters.set(k, rec);
    return { allowed: rec.count <= this.max, count: rec.count, max: this.max };
  }

  reset(projectId: string, stage: number) {
    this.counters.delete(this.key(projectId, stage));
  }
}
