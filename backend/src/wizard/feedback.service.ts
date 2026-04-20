import { Injectable } from '@nestjs/common';
import { AIService } from '../ai/ai.service';
import { AuditService } from '../observability/audit.service';

export type ClientFeedbackVerdict = 'reject' | 'revise' | 'accept';

export interface ClientFeedback {
  projectId: string;
  userId: string;          // marketer submitting the feedback
  artifact: string;
  verdict: ClientFeedbackVerdict;
  rejectedText: string;    // what the client rejected
  reasonText: string;      // why
  reformulationHint?: string;  // optional marketer-written rewrite suggestion
  originalDraftId?: string;
}

/**
 * Gorshkov pattern (INSIGHTS §3/§6): client feedback must NOT be pasted 1-to-1 into prompt.
 * Marketer structures it in 3 fields; we then templatize and pass to /critique-message.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly ai: AIService,
    private readonly audit: AuditService,
  ) {}

  async submit(f: ClientFeedback) {
    await this.audit.record({
      type: 'marketer.feedback_submitted',
      projectId: f.projectId,
      userId: f.userId,
      responsibleUserId: f.userId,
      meta: {
        artifact: f.artifact,
        verdict: f.verdict,
        hasHint: Boolean(f.reformulationHint?.trim()),
        rejectLen: f.rejectedText.length,
      },
    });

    // If accept — nothing to do.
    if (f.verdict === 'accept') return { ok: true, critique: null };

    // Else call /critique-message with structured template.
    const critique = await this.ai.invoke({
      projectId: f.projectId,
      userId: f.userId,
      kind: 'critique_message',
      promptName: 'critique-message',
      userText: [
        `[rejected]\n${f.rejectedText}`,
        `[reason]\n${f.reasonText}`,
        f.reformulationHint ? `[hint]\n${f.reformulationHint}` : '',
      ].filter(Boolean).join('\n\n'),
      userTextSource: 'client_feedback',
      variables: {
        artifact: f.artifact,
        verdict: f.verdict,
      },
    });

    return { ok: critique.ok, critique };
  }
}
