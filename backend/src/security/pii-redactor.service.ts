import { Injectable } from '@nestjs/common';

export interface PiiRedactionResult {
  sanitized: string;
  redactions: Array<{ kind: string; count: number }>;
}

/** Schherbatyuk: PII auto-redaction in brief before Anthropic call. */
@Injectable()
export class PiiRedactorService {
  // Order matters: high-severity compound patterns first, чтобы email/phone
  // не разрезали их на куски. Отдельный тест pii-redactor.spec.ts доказывает
  // что url_creds матчится раньше, чем email.
  private readonly patterns: Array<{ kind: string; rx: RegExp; replacement: string }> = [
    // URL with credentials (user:pass@host) — должен быть ПЕРВЫМ, чтобы email-часть
    // "admin:pass" не была распознана как email отдельно.
    { kind: 'url_creds', rx: /https?:\/\/[^\s:\/]+:[^\s@\/]+@[^\s]+/g, replacement: '[REDACTED_URL_CREDS]' },
    // Russian passport "1234 567890"
    { kind: 'ru_passport', rx: /\b\d{4}\s?\d{6}\b/g, replacement: '[REDACTED_PASSPORT]' },
    // Russian phone +7 / 8 format (перед intl_phone — специфичнее)
    { kind: 'ru_phone', rx: /(?:\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/g, replacement: '[REDACTED_PHONE]' },
    // International phone-ish
    { kind: 'intl_phone', rx: /\+\d{1,3}[\s\-]?\d{3,5}[\s\-]?\d{3,5}[\s\-]?\d{2,5}/g, replacement: '[REDACTED_PHONE]' },
    // Credit card (13-19 digits with optional separators) — раньше ИНН, т.к. длиннее
    { kind: 'credit_card', rx: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[REDACTED_CARD]' },
    // Russian INN (10 or 12 digits, standalone)
    { kind: 'ru_inn', rx: /\b\d{10}\b|\b\d{12}\b/g, replacement: '[REDACTED_INN]' },
    // Email
    { kind: 'email', rx: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replacement: '[REDACTED_EMAIL]' },
    // API keys / tokens (32+ alnum)
    { kind: 'token_or_key', rx: /\b[A-Za-z0-9_\-]{32,}\b/g, replacement: '[REDACTED_TOKEN]' },
    // IPv4
    { kind: 'ipv4', rx: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
  ];

  redact(input: string): PiiRedactionResult {
    if (!input) return { sanitized: '', redactions: [] };
    let out = input;
    const redactions: Array<{ kind: string; count: number }> = [];
    for (const p of this.patterns) {
      let count = 0;
      out = out.replace(p.rx, () => {
        count++;
        return p.replacement;
      });
      if (count > 0) redactions.push({ kind: p.kind, count });
    }
    return { sanitized: out, redactions };
  }

  hasAny(input: string): boolean {
    if (!input) return false;
    return this.patterns.some((p) => p.rx.test(input));
  }
}
