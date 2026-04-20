import { describe, it, expect, beforeEach } from 'vitest';
import { PiiRedactorService } from './pii-redactor.service';

describe('PiiRedactorService', () => {
  let svc: PiiRedactorService;

  beforeEach(() => {
    svc = new PiiRedactorService();
  });

  it('пустой input возвращает пустой output без редакций', () => {
    const r = svc.redact('');
    expect(r.sanitized).toBe('');
    expect(r.redactions).toEqual([]);
  });

  it('null input безопасно обрабатывается', () => {
    const r = svc.redact(null as any);
    expect(r.sanitized).toBe('');
    expect(r.redactions).toEqual([]);
  });

  it('чистый текст без PII не меняется', () => {
    const input = 'Клиника стоматологии — 10 лет на рынке, фокус на детях.';
    const r = svc.redact(input);
    expect(r.sanitized).toBe(input);
    expect(r.redactions).toEqual([]);
  });

  it('российский паспорт 4+6 цифр заменяется', () => {
    const r = svc.redact('Паспорт: 4510 123456, серия выдана ОВД');
    expect(r.sanitized).toContain('[REDACTED_PASSPORT]');
    expect(r.sanitized).not.toContain('4510 123456');
    expect(r.redactions.find((x) => x.kind === 'ru_passport')?.count).toBe(1);
  });

  it('российский телефон +7 заменяется', () => {
    const r = svc.redact('Звоните +7 (495) 123-45-67 в рабочие часы.');
    expect(r.sanitized).toContain('[REDACTED_PHONE]');
    expect(r.sanitized).not.toContain('495');
  });

  it('email заменяется', () => {
    const r = svc.redact('Пишите на info@chirkov-bp.ru.');
    expect(r.sanitized).toContain('[REDACTED_EMAIL]');
    expect(r.sanitized).not.toContain('chirkov-bp.ru');
  });

  it('credit card 16 цифр заменяется', () => {
    const r = svc.redact('Карта 4111 1111 1111 1111 оплачена.');
    expect(r.sanitized).toContain('[REDACTED_CARD]');
    expect(r.sanitized).not.toContain('4111');
  });

  it('api key 32+ alnum символа редактируется как token', () => {
    const key = 'sk' + 'a'.repeat(45);
    const r = svc.redact(`Ключ: ${key}`);
    // Может совпасть как token_or_key либо credit_card (в зависимости от порядка).
    // Главное — не должен утечь raw.
    expect(r.sanitized).not.toContain(key);
  });

  it('IPv4 заменяется', () => {
    const r = svc.redact('Сервер 192.168.1.100 отвечает.');
    expect(r.sanitized).toContain('[REDACTED_IP]');
  });

  it('URL с user:pass@host редактируется', () => {
    const r = svc.redact('Подключение: https://admin:s3cret@internal.db:5432/bp');
    expect(r.sanitized).toContain('[REDACTED_URL_CREDS]');
    expect(r.sanitized).not.toContain('s3cret');
  });

  it('множественные PII в одной строке — все редактятся', () => {
    const r = svc.redact('user@example.com звонит +7 495 123 45 67 карта 4111111111111111');
    expect(r.sanitized).not.toContain('user@example.com');
    expect(r.sanitized).not.toContain('4111111111111111');
    // Не менее 2 kind'ов в редакциях
    expect(r.redactions.length).toBeGreaterThanOrEqual(2);
  });

  it('hasAny возвращает true на email', () => {
    expect(svc.hasAny('pm@chirkov.ru обсудим')).toBe(true);
  });

  it('hasAny возвращает false на чистый текст', () => {
    expect(svc.hasAny('Клиника стоматологии, 10 лет')).toBe(false);
  });

  it('INN 10 цифр редактируется', () => {
    const r = svc.redact('ИНН: 7703123456 из ЕГРЮЛ.');
    // Может быть сматчено как ru_inn, либо частично как credit_card, но raw уйти не должен.
    expect(r.sanitized).not.toContain('7703123456');
  });
});
