import { Injectable } from '@nestjs/common';

export interface RegexValidationInput {
  artifact:
    | 'value'
    | 'mission'
    | 'vision'
    | 'legend'
    | 'archetype'
    | 'positioning'
    | 'we_we_are_not_pair'
    | 'brand_message';
  payload: Record<string, any>;
}

export interface RegexValidationResult {
  passed: boolean;
  errors: Array<{ code: string; field?: string; message: string }>;
  warnings: Array<{ code: string; field?: string; message: string }>;
}

/**
 * Level-1 validator: hard rules from BP 3.1 methodology.
 * E.g. brand message = 4–7 words, value = 1–3 words, mission = 1 sentence.
 */
@Injectable()
export class RegexValidatorService {
  validate(input: RegexValidationInput): RegexValidationResult {
    const errors: RegexValidationResult['errors'] = [];
    const warnings: RegexValidationResult['warnings'] = [];

    switch (input.artifact) {
      case 'brand_message':
        this.validateBrandMessage(input.payload, errors, warnings);
        break;
      case 'value':
        this.validateValue(input.payload, errors, warnings);
        break;
      case 'mission':
        this.validateMission(input.payload, errors, warnings);
        break;
      case 'vision':
        this.validateVision(input.payload, errors, warnings);
        break;
      case 'legend':
        this.validateLegend(input.payload, errors, warnings);
        break;
      case 'archetype':
        this.validateArchetype(input.payload, errors, warnings);
        break;
      case 'positioning':
        this.validatePositioning(input.payload, errors, warnings);
        break;
      case 'we_we_are_not_pair':
        this.validateWePair(input.payload, errors, warnings);
        break;
    }

    return { passed: errors.length === 0, errors, warnings };
  }

  private wordCount(s: string): number {
    if (!s) return 0;
    return s.trim().split(/\s+/).filter(Boolean).length;
  }

  private validateBrandMessage(p: any, errs: any[], warns: any[]) {
    const text = (p?.text ?? '').trim();
    if (!text) {
      errs.push({ code: 'msg.empty', field: 'text', message: 'Бренд-месседж не может быть пустым' });
      return;
    }
    const n = this.wordCount(text);
    if (n < 4) errs.push({ code: 'msg.too_short', field: 'text', message: `Меньше 4 слов: ${n}` });
    if (n > 7) errs.push({ code: 'msg.too_long', field: 'text', message: `Больше 7 слов: ${n}` });
    if (n === 4 || n === 7) warns.push({ code: 'msg.borderline', field: 'text', message: `На границе: ${n} слов` });
    if (/[!?]{2,}/.test(text)) errs.push({ code: 'msg.punctuation', field: 'text', message: 'Избыточная пунктуация' });
    if (/\d/.test(text)) warns.push({ code: 'msg.has_digits', field: 'text', message: 'Цифры в месседже — обычно слабо' });
  }

  private validateValue(p: any, errs: any[], _warns: any[]) {
    const text = (p?.name ?? p?.text ?? '').trim();
    if (!text) errs.push({ code: 'value.empty', field: 'name', message: 'Название ценности пустое' });
    const n = this.wordCount(text);
    if (n > 3) errs.push({ code: 'value.too_long', field: 'name', message: `Ценность — 1-3 слова, у вас ${n}` });
    if ((p?.manifestations?.length ?? 0) < 2) {
      errs.push({ code: 'value.manifestations_missing', message: 'Минимум 2 проявления (да/нет)' });
    }
  }

  private validateMission(p: any, errs: any[], warns: any[]) {
    const text = (p?.text ?? '').trim();
    if (!text) errs.push({ code: 'mission.empty', message: 'Миссия пустая' });
    const sentences = text.split(/[.!?]+\s+/).filter(Boolean).length;
    if (sentences > 2) warns.push({ code: 'mission.multi_sentence', message: 'Миссия в 1 предложение обычно сильнее' });
    if (/(?:деньги|заработок|прибыль|выручка)/i.test(text)) {
      errs.push({ code: 'mission.money_marker', message: 'Миссия не может быть про деньги — это цель, а не миссия' });
    }
  }

  private validateVision(p: any, errs: any[], _warns: any[]) {
    const text = (p?.text ?? '').trim();
    if (!text) errs.push({ code: 'vision.empty', message: 'Видение пустое' });
  }

  private validateLegend(p: any, errs: any[], _warns: any[]) {
    const facts: any[] = p?.facts ?? [];
    if (facts.length < 3) errs.push({ code: 'legend.too_few_facts', message: 'Минимум 3 факта в легенде' });
    for (const f of facts) {
      if (!f?.year && !f?.date) {
        errs.push({ code: 'legend.fact_no_date', message: 'Каждый факт должен иметь дату' });
      }
    }
  }

  private validateArchetype(p: any, errs: any[], _warns: any[]) {
    const allowed = new Set([
      'ruler', 'hero', 'sage', 'explorer', 'magician', 'outlaw',
      'lover', 'caregiver', 'creator', 'jester', 'regular_guy', 'innocent',
    ]);
    const archetype = String(p?.archetype ?? '').toLowerCase();
    if (!allowed.has(archetype)) {
      errs.push({ code: 'archetype.invalid', message: `Архетип "${archetype}" не из канонических 12` });
    }
  }

  private validatePositioning(p: any, errs: any[], _warns: any[]) {
    const text = (p?.text ?? '').trim();
    if (!text) errs.push({ code: 'positioning.empty', message: 'Позиционирование пустое' });
    if (this.wordCount(text) > 25) {
      errs.push({ code: 'positioning.too_long', message: 'Позиционирование > 25 слов — сложно запомнить' });
    }
  }

  private validateWePair(p: any, errs: any[], _warns: any[]) {
    if (!p?.we || !p?.weAreNot) {
      errs.push({ code: 'we_pair.incomplete', message: 'Пара "мы это / мы не это" должна быть заполнена полностью' });
    }
  }
}
