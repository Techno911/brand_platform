import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { WizardService } from '../wizard.service';

/**
 * Stage 3: Archetype + Positioning + Brand Message.
 * - /positioning-draft (Stage 3a), /message-variants, /critique-message (3 critics × 3 iterations per Elkin).
 */
@Injectable()
export class Stage3Service {
  constructor(
    private readonly ai: AIService,
    private readonly wizard: WizardService,
  ) {}

  async positioningDraft(projectId: string, userId: string, inputs: Record<string, any>) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'positioning_draft',
      promptName: 'positioning-draft',
      variables: {
        inputsJson: JSON.stringify(inputs, null, 2),
      },
      stage: 3,
    });
    if (r.ok) {
      const row = await this.wizard.createRow(projectId, 5, 'positioning', { draft: r.text ?? r.json });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  async messageVariants(projectId: string, userId: string, inputs: Record<string, any>) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'message_variants',
      promptName: 'message-variants',
      variables: { inputsJson: JSON.stringify(inputs, null, 2) },
      stage: 3,
    });
    if (r.ok) {
      const row = await this.wizard.createRow(projectId, 6, 'message_variant', { variants: r.text ?? r.json });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  /** /critique-message — 3 critics × 3 iterations. Returns flat list of critiques. */
  async critiqueMessage(projectId: string, userId: string, messageText: string) {
    const out: any[] = [];
    for (const role of ['senior_architect', 'pm', 'domain_stakeholder']) {
      const r = await this.ai.invoke({
        projectId,
        userId,
        kind: 'critique_message',
        promptName: 'critique-message',
        variables: { role, iteration: 1 },
        userText: messageText,
        userTextSource: 'marketer_input',
        stage: 3,
      });
      out.push({ role, result: r });
      // Stop early if any critic flagged hard red
      if (!r.ok) break;
    }
    return out;
  }

  async borderlineClassify(projectId: string, userId: string, messageText: string) {
    return this.ai.invoke({
      projectId,
      userId,
      kind: 'borderline_classify',
      promptName: 'review-classify',
      useJudge: true,
      userText: messageText,
      userTextSource: 'marketer_input',
      stage: 3,
    });
  }
}
