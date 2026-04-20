import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PiiRedactorService } from './pii-redactor.service';
import { SecurityEventsService } from './security-events.service';

export interface SanitizeOptions {
  projectId?: string | null;
  userId?: string | null;
  source: 'brief_upload' | 'owner_interview' | 'marketer_input' | 'client_feedback' | 'other';
  maxLength?: number;
}

export interface SanitizedBrief {
  sanitized: string;
  wrapped: string;          // <user_input>...</user_input> escaped
  piiRedactions: Array<{ kind: string; count: number }>;
  promptInjectionHits: Array<{ pattern: string; excerpt: string }>;
  rejected: boolean;
  rejectReason?: string;
  truncated: boolean;
  originalLength: number;
  sanitizedLength: number;
}

/**
 * BriefSanitizerService — Schherbatyuk TOP-1 LLM vulnerability mitigation.
 *
 * Pipeline:
 *   1. Length check (reject > max)
 *   2. Prompt injection blacklist (regex + known jailbreak markers)
 *   3. Delimiter escaping (so user text cannot break out of <user_input>)
 *   4. PII auto-redaction (delegated to PiiRedactorService)
 *   5. Wrap in <user_input>...</user_input>
 *
 * Invariants:
 *   - Any injection hit >= HIGH severity => reject=true, do not call Anthropic.
 *   - All hits logged to security_events for chip_admin dashboard.
 *   - Service never throws for "clean" input; only rejects structurally bad input.
 */
@Injectable()
export class BriefSanitizerService {
  private readonly maxLength: number;

  // Jailbreak / injection markers — case insensitive where applicable.
  // Ordered by severity: HIGH patterns short-circuit.
  private readonly highSeverityPatterns: Array<{ rx: RegExp; label: string }> = [
    { rx: /ignore (?:all |the )?previous instructions?/i, label: 'jailbreak.ignore_previous' },
    { rx: /disregard (?:all |the )?(?:prior|previous|above) (?:prompts?|instructions?|rules?)/i, label: 'jailbreak.disregard_prior' },
    { rx: /you are now (?:DAN|an? unrestricted)/i, label: 'jailbreak.dan_persona' },
    { rx: /<\|im_start\|>|<\|im_end\|>|<\|system\|>/i, label: 'jailbreak.chatml_markers' },
    { rx: /\[INST\]|\[\/INST\]|\[SYSTEM\]/i, label: 'jailbreak.instruction_markers' },
    { rx: /\bSystem:\s/i, label: 'jailbreak.system_prefix' },
    { rx: /###\s*(?:system|assistant|user)\s*###/i, label: 'jailbreak.role_header' },
    { rx: /reveal (?:the |your )?system prompt/i, label: 'jailbreak.reveal_system_prompt' },
    { rx: /print (?:the |your )?(?:system )?prompt/i, label: 'jailbreak.print_prompt' },
    { rx: /jailbreak|jail\s*break/i, label: 'jailbreak.literal' },
    { rx: /exec\(|os\.system|subprocess\./i, label: 'code_injection.python' },
    { rx: /<script[^>]*>/i, label: 'code_injection.script_tag' },
  ];

  private readonly mediumSeverityPatterns: Array<{ rx: RegExp; label: string }> = [
    { rx: /```(?:system|assistant)[^`]*```/i, label: 'markdown.role_fence' },
    { rx: /---\s*system\s*---/i, label: 'markdown.system_frontmatter' },
    { rx: /^\s*system:\s*/im, label: 'markdown.line_system_prefix' },
    { rx: /<\/?(?:system|assistant|user|tool)[^>]*>/i, label: 'xml.role_tag' },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly pii: PiiRedactorService,
    private readonly securityEvents: SecurityEventsService,
  ) {
    this.maxLength = this.config.get<number>('security.briefSanitizerMaxLen') ?? 200000;
  }

  async sanitize(input: string, opts: SanitizeOptions): Promise<SanitizedBrief> {
    const originalLength = (input ?? '').length;
    let text = input ?? '';

    // 1. Length
    let truncated = false;
    if (originalLength > (opts.maxLength ?? this.maxLength)) {
      const limit = opts.maxLength ?? this.maxLength;
      text = text.slice(0, limit);
      truncated = true;
    }

    // 2. Injection detection
    const hits: Array<{ pattern: string; excerpt: string; severity: 'HIGH' | 'MEDIUM' }> = [];
    for (const p of this.highSeverityPatterns) {
      const m = p.rx.exec(text);
      if (m) {
        hits.push({
          pattern: p.label,
          excerpt: m[0].slice(0, 160),
          severity: 'HIGH',
        });
      }
    }
    for (const p of this.mediumSeverityPatterns) {
      const m = p.rx.exec(text);
      if (m) {
        hits.push({
          pattern: p.label,
          excerpt: m[0].slice(0, 160),
          severity: 'MEDIUM',
        });
      }
    }

    // Log every hit
    for (const h of hits) {
      await this.securityEvents.record({
        type: 'prompt_injection_detected',
        severity: h.severity === 'HIGH' ? 'high' : 'medium',
        projectId: opts.projectId ?? null,
        userId: opts.userId ?? null,
        source: 'brief_sanitizer',
        matchedPattern: h.pattern,
        excerpt: h.excerpt,
        meta: { inputSource: opts.source, truncated, originalLength },
      });
    }

    // HIGH => reject
    const highHits = hits.filter((h) => h.severity === 'HIGH');
    if (highHits.length > 0) {
      return {
        sanitized: '',
        wrapped: '',
        piiRedactions: [],
        promptInjectionHits: hits.map((h) => ({ pattern: h.pattern, excerpt: h.excerpt })),
        rejected: true,
        rejectReason: `Prompt injection detected: ${highHits.map((h) => h.pattern).join(', ')}`,
        truncated,
        originalLength,
        sanitizedLength: 0,
      };
    }

    // 3. Delimiter escape — user cannot produce literal </user_input>
    let sanitized = text
      .replace(/<\/?user_input>/gi, (m) => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      .replace(/<\/?system>/gi, (m) => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      .replace(/<\/?assistant>/gi, (m) => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'));

    // 4. PII redaction
    const piiResult = this.pii.redact(sanitized);
    sanitized = piiResult.sanitized;

    if (piiResult.redactions.length > 0) {
      await this.securityEvents.record({
        type: 'pii_detected',
        severity: 'medium',
        projectId: opts.projectId ?? null,
        userId: opts.userId ?? null,
        source: 'brief_sanitizer',
        meta: { redactions: piiResult.redactions, inputSource: opts.source },
      });
    }

    // 5. Wrap
    const wrapped = `<user_input>\n${sanitized}\n</user_input>`;

    return {
      sanitized,
      wrapped,
      piiRedactions: piiResult.redactions,
      promptInjectionHits: hits.map((h) => ({ pattern: h.pattern, excerpt: h.excerpt })),
      rejected: false,
      truncated,
      originalLength,
      sanitizedLength: sanitized.length,
    };
  }
}
