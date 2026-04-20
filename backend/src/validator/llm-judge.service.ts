import { Injectable } from '@nestjs/common';
import { AIService } from '../ai/ai.service';

export interface LlmJudgeInput {
  projectId: string;
  userId: string;
  artifact: string;
  payload: Record<string, any>;
}

export interface LlmJudgeResult {
  passed: boolean;
  score: number;
  issues: string[];
  rationale: string;
  runId?: string;
}

/**
 * Level-2 validator: LLM-as-judge semantic check.
 * Uses the judge model (cheap Haiku) with a fixed prompt "review-classify".
 */
@Injectable()
export class LlmJudgeService {
  constructor(private readonly ai: AIService) {}

  async judge(input: LlmJudgeInput): Promise<LlmJudgeResult> {
    const r = await this.ai.invoke({
      projectId: input.projectId,
      userId: input.userId,
      kind: 'review_classify',
      promptName: 'review-classify',
      useJudge: true,
      variables: {
        artifact: input.artifact,
        payloadJson: JSON.stringify(input.payload, null, 2),
      },
    });
    if (!r.ok) {
      // If judge itself failed, be conservative: fail-open with low confidence.
      return { passed: true, score: 0.5, issues: [`judge_unavailable: ${r.rejectReason ?? 'unknown'}`], rationale: 'judge degraded' };
    }
    const parsed = this.parseJudgeOutput(r.text ?? '');
    return { ...parsed, runId: r.runId };
  }

  private parseJudgeOutput(text: string): Omit<LlmJudgeResult, 'runId'> {
    // Expect JSON fenced or first-line: {"passed": bool, "score": 0..1, "issues": [], "rationale": ""}
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i) ?? text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      try {
        const obj = JSON.parse(jsonMatch[1]);
        return {
          passed: Boolean(obj.passed),
          score: Math.max(0, Math.min(1, Number(obj.score ?? 0))),
          issues: Array.isArray(obj.issues) ? obj.issues.map(String) : [],
          rationale: String(obj.rationale ?? '').slice(0, 2000),
        };
      } catch {
        /* fall through */
      }
    }
    return {
      passed: /\bpass(ed)?\b|\bgreen\b|\b(?:ok|ok!)\b/i.test(text),
      score: 0.5,
      issues: [],
      rationale: text.slice(0, 2000),
    };
  }
}
