import { describe, it, expect, beforeEach } from 'vitest';
import { BorderlineClassifierService } from './borderline-classifier.service';
import { RegexValidatorService } from './regex-validator.service';

// Простые стабы LLM-судей — возвращают предсказуемые значения.
const makeJudgeStub = (passed = true, score = 0.9, issues: string[] = []) => ({
  judge: async () => ({ passed, score, issues }),
});
const makeMethodologyStub = (passed = true, violations: string[] = []) => ({
  check: async () => ({ passed, violations }),
});

describe('BorderlineClassifierService · traffic light', () => {
  let regex: RegexValidatorService;
  beforeEach(() => { regex = new RegexValidatorService(); });

  const ctx = { projectId: 'p1', userId: 'u1' };

  it('regex ошибка → red без вызова judge/methodology', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub() as any,
      makeMethodologyStub() as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: '' }, // пустое → regex.fail
    });
    expect(r.trafficLight).toBe('red');
    expect(r.judge).toBeUndefined();
    expect(r.methodology).toBeUndefined();
  });

  it('regex passed + judge passed + methodology passed + score=0.9 → green', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub(true, 0.9, []) as any,
      makeMethodologyStub(true, []) as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: 'Прозрачность без скрытых доплат гарантирована' }, // 5 слов, без warnings
    });
    expect(r.trafficLight).toBe('green');
  });

  it('regex passed + judge passed + methodology failed → red', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub(true, 0.9) as any,
      makeMethodologyStub(false, ['archetype выбран вне BP 3.1']) as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: 'Прозрачность без скрытых доплат гарантирована' },
    });
    expect(r.trafficLight).toBe('red');
    expect(r.reasons.some((x) => x.startsWith('methodology:'))).toBe(true);
  });

  it('regex warning (borderline 4 слова) → yellow', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub(true, 0.9) as any,
      makeMethodologyStub(true) as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: 'Улыбка без лишних вопросов' }, // ровно 4 слова → warning
    });
    expect(r.trafficLight).toBe('yellow');
  });

  it('judge score<0.7 → yellow', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub(true, 0.5) as any,
      makeMethodologyStub(true) as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: 'Прозрачность без скрытых доплат гарантирована' },
    });
    expect(r.trafficLight).toBe('yellow');
  });

  it('judge passed=false → red', async () => {
    const svc = new BorderlineClassifierService(
      regex,
      makeJudgeStub(false, 0.9, ['скучный']) as any,
      makeMethodologyStub(true) as any,
    );
    const r = await svc.classify({
      ...ctx,
      artifact: 'brand_message' as any,
      payload: { text: 'Прозрачность без скрытых доплат гарантирована' },
    });
    expect(r.trafficLight).toBe('red');
  });
});
