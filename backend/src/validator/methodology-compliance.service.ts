import { Injectable } from '@nestjs/common';
import { AIService } from '../ai/ai.service';

export interface MethodologyComplianceInput {
  projectId: string;
  userId: string;
  artifact: string;
  payload: Record<string, any>;
}

export interface MethodologyComplianceResult {
  passed: boolean;
  canonRef: string[];
  violations: string[];
  rationale: string;
  runId?: string;
}

/**
 * INSIGHTS §4 / §5 delta-2: methodology-compliance-check.
 * Separate from quality LLM-judge. Asks a dedicated prompt to verify
 * the artefact follows Brand Platform 3.1 canon (offline B2C, owner-driven,
 * no performance-marketing mixing, etc.).
 */
@Injectable()
export class MethodologyComplianceService {
  constructor(private readonly ai: AIService) {}

  async check(input: MethodologyComplianceInput): Promise<MethodologyComplianceResult> {
    const r = await this.ai.invoke({
      projectId: input.projectId,
      userId: input.userId,
      kind: 'methodology_compliance_check',
      promptName: 'methodology-compliance-check',
      useJudge: true,
      variables: {
        artifact: input.artifact,
        payloadJson: JSON.stringify(input.payload, null, 2),
      },
    });
    if (!r.ok) {
      return {
        passed: true,
        canonRef: [],
        violations: [`methodology_judge_unavailable: ${r.rejectReason ?? 'unknown'}`],
        rationale: 'methodology check degraded — fail-open, mark manual review',
      };
    }
    const parsed = this.parse(r.text ?? '');
    return { ...parsed, runId: r.runId };
  }

  private parse(text: string): Omit<MethodologyComplianceResult, 'runId'> {
    const m = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/(\{[\s\S]*\})/);
    if (m) {
      try {
        const obj = JSON.parse(m[1]);
        return {
          passed: Boolean(obj.passed),
          canonRef: Array.isArray(obj.canon_ref) ? obj.canon_ref.map(String) : [],
          violations: Array.isArray(obj.violations) ? obj.violations.map(String) : [],
          rationale: String(obj.rationale ?? '').slice(0, 2000),
        };
      } catch {
        /* fall through */
      }
    }
    return {
      passed: /\bpass(ed)?\b|\bcompliant\b/i.test(text),
      canonRef: [],
      violations: [],
      rationale: text.slice(0, 2000),
    };
  }
}
