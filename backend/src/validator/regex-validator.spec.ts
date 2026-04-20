import { describe, it, expect, beforeEach } from 'vitest';
import { RegexValidatorService } from './regex-validator.service';

describe('RegexValidatorService · brand_message', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('пустой месседж → ошибка msg.empty', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: '' } });
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.code === 'msg.empty')).toBe(true);
  });

  it('3 слова → msg.too_short', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: 'Слишком мало слов' } });
    expect(r.passed).toBe(false);
    expect(r.errors.some((e) => e.code === 'msg.too_short')).toBe(true);
  });

  it('8 слов → msg.too_long', () => {
    const r = v.validate({
      artifact: 'brand_message',
      payload: { text: 'Это восемь слов и уже слишком много получается тут' },
    });
    // Восемь слов:
    const count = 'Это восемь слов и уже слишком много получается'.trim().split(/\s+/).length;
    expect(count).toBe(8);
    const r2 = v.validate({ artifact: 'brand_message', payload: { text: 'Это восемь слов и уже слишком много получается' } });
    expect(r2.errors.some((e) => e.code === 'msg.too_long')).toBe(true);
  });

  it('5 слов — passed без warning', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: 'Прозрачность без скрытых доплат гарантирована' } });
    expect(r.passed).toBe(true);
    expect(r.warnings.length).toBe(0);
  });

  it('ровно 4 слова → borderline warning', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: 'Улыбка без лишних вопросов' } });
    expect(r.passed).toBe(true);
    expect(r.warnings.some((w) => w.code === 'msg.borderline')).toBe(true);
  });

  it('ровно 7 слов → borderline warning', () => {
    const r = v.validate({
      artifact: 'brand_message',
      payload: { text: 'Открытая стоматология где пациент знает каждый шаг' },
    });
    expect(r.passed).toBe(true);
    expect(r.warnings.some((w) => w.code === 'msg.borderline')).toBe(true);
  });

  it('двойной "!!" → msg.punctuation error', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: 'Открытая стоматология гарантированно!!' } });
    expect(r.errors.some((e) => e.code === 'msg.punctuation')).toBe(true);
  });

  it('цифра в месседже → warning msg.has_digits', () => {
    const r = v.validate({ artifact: 'brand_message', payload: { text: 'Лечим 1000 пациентов в месяц' } });
    expect(r.warnings.some((w) => w.code === 'msg.has_digits')).toBe(true);
  });
});

describe('RegexValidatorService · value', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('пустое имя → value.empty', () => {
    const r = v.validate({ artifact: 'value', payload: { name: '', manifestations: [1, 2] } });
    expect(r.errors.some((e) => e.code === 'value.empty')).toBe(true);
  });

  it('4 слова → value.too_long (ценность 1-3 слова)', () => {
    const r = v.validate({
      artifact: 'value',
      payload: { name: 'Много слов в ценности', manifestations: [1, 2] },
    });
    expect(r.errors.some((e) => e.code === 'value.too_long')).toBe(true);
  });

  it('1 manifestation → value.manifestations_missing', () => {
    const r = v.validate({ artifact: 'value', payload: { name: 'Честность', manifestations: ['один'] } });
    expect(r.errors.some((e) => e.code === 'value.manifestations_missing')).toBe(true);
  });

  it('1 слово + 2 manifestations → passed', () => {
    const r = v.validate({ artifact: 'value', payload: { name: 'Честность', manifestations: ['да', 'нет'] } });
    expect(r.passed).toBe(true);
  });
});

describe('RegexValidatorService · mission', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('упоминание "прибыль" → mission.money_marker', () => {
    const r = v.validate({
      artifact: 'mission',
      payload: { text: 'Наша миссия — максимальная прибыль клиники.' },
    });
    expect(r.errors.some((e) => e.code === 'mission.money_marker')).toBe(true);
  });

  it('упоминание "деньги" → mission.money_marker', () => {
    const r = v.validate({ artifact: 'mission', payload: { text: 'Мы зарабатываем деньги хорошо.' } });
    expect(r.errors.some((e) => e.code === 'mission.money_marker')).toBe(true);
  });

  it('3 предложения → warning multi_sentence', () => {
    const r = v.validate({
      artifact: 'mission',
      payload: { text: 'Мы лечим. Мы учим. Мы растём.' },
    });
    expect(r.warnings.some((w) => w.code === 'mission.multi_sentence')).toBe(true);
  });

  it('1 корректное предложение → passed без warning', () => {
    const r = v.validate({
      artifact: 'mission',
      payload: { text: 'Сделать стоматологию понятной и предсказуемой для каждого пациента.' },
    });
    expect(r.passed).toBe(true);
  });

  it('пустая миссия → mission.empty', () => {
    const r = v.validate({ artifact: 'mission', payload: { text: '' } });
    expect(r.errors.some((e) => e.code === 'mission.empty')).toBe(true);
  });
});

describe('RegexValidatorService · archetype', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it.each([
    'ruler', 'hero', 'sage', 'explorer', 'magician', 'outlaw',
    'lover', 'caregiver', 'creator', 'jester', 'regular_guy', 'innocent',
  ])('канонический "%s" → passed', (arch) => {
    const r = v.validate({ artifact: 'archetype', payload: { archetype: arch } });
    expect(r.passed).toBe(true);
  });

  it('"kingmaker" не в каноне → archetype.invalid', () => {
    const r = v.validate({ artifact: 'archetype', payload: { archetype: 'kingmaker' } });
    expect(r.errors.some((e) => e.code === 'archetype.invalid')).toBe(true);
  });
});

describe('RegexValidatorService · legend', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('2 факта → legend.too_few_facts', () => {
    const r = v.validate({
      artifact: 'legend',
      payload: { facts: [{ year: 2014, what: 'a' }, { year: 2016, what: 'b' }] },
    });
    expect(r.errors.some((e) => e.code === 'legend.too_few_facts')).toBe(true);
  });

  it('3 факта без года в одном → legend.fact_no_date', () => {
    const r = v.validate({
      artifact: 'legend',
      payload: { facts: [{ year: 2014, what: 'a' }, { year: 2016, what: 'b' }, { what: 'c' }] },
    });
    expect(r.errors.some((e) => e.code === 'legend.fact_no_date')).toBe(true);
  });

  it('3 факта с годами → passed', () => {
    const r = v.validate({
      artifact: 'legend',
      payload: {
        facts: [
          { year: 2014, what: 'Открытие клиники' },
          { year: 2016, what: 'Филиал в СПб' },
          { year: 2020, what: '10 тыс пациентов' },
        ],
      },
    });
    expect(r.passed).toBe(true);
  });
});

describe('RegexValidatorService · positioning', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('пустое → positioning.empty', () => {
    const r = v.validate({ artifact: 'positioning', payload: { text: '' } });
    expect(r.errors.some((e) => e.code === 'positioning.empty')).toBe(true);
  });

  it('> 25 слов → positioning.too_long', () => {
    const big = Array(30).fill('слово').join(' ');
    const r = v.validate({ artifact: 'positioning', payload: { text: big } });
    expect(r.errors.some((e) => e.code === 'positioning.too_long')).toBe(true);
  });

  it('15 слов → passed', () => {
    const text = Array(15).fill('слово').join(' ');
    const r = v.validate({ artifact: 'positioning', payload: { text } });
    expect(r.passed).toBe(true);
  });
});

describe('RegexValidatorService · we_we_are_not_pair', () => {
  let v: RegexValidatorService;
  beforeEach(() => { v = new RegexValidatorService(); });

  it('only we без weAreNot → incomplete', () => {
    const r = v.validate({ artifact: 'we_we_are_not_pair', payload: { we: 'Прозрачные' } });
    expect(r.errors.some((e) => e.code === 'we_pair.incomplete')).toBe(true);
  });

  it('both → passed', () => {
    const r = v.validate({
      artifact: 'we_we_are_not_pair',
      payload: { we: 'Прозрачные', weAreNot: 'Запугивающие' },
    });
    expect(r.passed).toBe(true);
  });
});
