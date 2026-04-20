import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoundtripLimiterService } from './roundtrip-limiter.service';

const makeConfig = (max = 5) => ({
  get: (k: string) => (k === 'ai.maxAgentRoundtripsPerStage' ? max : undefined),
}) as any;

describe('RoundtripLimiterService', () => {
  let svc: RoundtripLimiterService;

  beforeEach(() => {
    svc = new RoundtripLimiterService(makeConfig(5));
  });

  it('первые 5 вызовов allowed=true', () => {
    for (let i = 1; i <= 5; i++) {
      const r = svc.tryIncrement('p1', 2);
      expect(r.allowed).toBe(true);
      expect(r.count).toBe(i);
      expect(r.max).toBe(5);
    }
  });

  it('6-й вызов allowed=false', () => {
    for (let i = 0; i < 5; i++) svc.tryIncrement('p1', 2);
    const r = svc.tryIncrement('p1', 2);
    expect(r.allowed).toBe(false);
    expect(r.count).toBe(6);
  });

  it('разные projectId не смешиваются', () => {
    for (let i = 0; i < 5; i++) svc.tryIncrement('p1', 2);
    const r = svc.tryIncrement('p2', 2);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
  });

  it('разные stage не смешиваются', () => {
    for (let i = 0; i < 5; i++) svc.tryIncrement('p1', 2);
    const r = svc.tryIncrement('p1', 3);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
  });

  it('reset() очищает счётчик', () => {
    for (let i = 0; i < 5; i++) svc.tryIncrement('p1', 2);
    svc.reset('p1', 2);
    const r = svc.tryIncrement('p1', 2);
    expect(r.count).toBe(1);
    expect(r.allowed).toBe(true);
  });

  it('через час счётчик авто-сбрасывается', () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-04-17T10:00:00Z').getTime();
    vi.setSystemTime(baseTime);
    for (let i = 0; i < 5; i++) svc.tryIncrement('p1', 2);
    expect(svc.tryIncrement('p1', 2).allowed).toBe(false);
    // +61 минута
    vi.setSystemTime(baseTime + 61 * 60 * 1000);
    const r = svc.tryIncrement('p1', 2);
    expect(r.allowed).toBe(true);
    expect(r.count).toBe(1);
    vi.useRealTimers();
  });

  it('дефолт max=5 при отсутствии config', () => {
    const s2 = new RoundtripLimiterService({ get: () => undefined } as any);
    const r = s2.tryIncrement('x', 1);
    expect(r.max).toBe(5);
  });

  it('кастомный max=3 применяется', () => {
    const s3 = new RoundtripLimiterService(makeConfig(3));
    for (let i = 0; i < 3; i++) expect(s3.tryIncrement('a', 1).allowed).toBe(true);
    expect(s3.tryIncrement('a', 1).allowed).toBe(false);
  });
});
