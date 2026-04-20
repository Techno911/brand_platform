import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { WizardService } from '../wizard.service';

/**
 * Stage 2: Owner session → Legend + Values + Mission + Vision.
 * - /challenge-owner-response in thinking-partner mode while owner answers.
 * - /legend-draft, /values-draft, /mission-variants (3–5 variants).
 */
@Injectable()
export class Stage2Service {
  constructor(
    private readonly ai: AIService,
    private readonly wizard: WizardService,
  ) {}

  async challengeOwnerResponse(projectId: string, userId: string, ownerText: string) {
    return this.ai.invoke({
      projectId,
      userId,
      kind: 'challenge_owner_response',
      promptName: 'challenge-owner-response',
      userText: ownerText,
      userTextSource: 'owner_interview',
      stage: 2,
    });
  }

  async draftLegend(projectId: string, userId: string, ownerTranscript: string) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'legend_draft',
      promptName: 'legend-draft',
      userText: ownerTranscript,
      userTextSource: 'owner_interview',
      stage: 2,
    });
    if (r.ok) {
      const row = await this.wizard.createRow(projectId, 4, 'legend_fact', { draft: r.text ?? r.json });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  async draftValues(projectId: string, userId: string, ownerTranscript: string) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'values_draft',
      promptName: 'values-draft',
      userText: ownerTranscript,
      userTextSource: 'owner_interview',
      stage: 2,
    });
    if (r.ok) {
      const row = await this.wizard.createRow(projectId, 4, 'value', { draft: r.text ?? r.json });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  async missionVariants(projectId: string, userId: string, ownerTranscript: string) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'mission_variants',
      promptName: 'mission-variants',
      userText: ownerTranscript,
      userTextSource: 'owner_interview',
      stage: 2,
    });
    if (r.ok) {
      const row = await this.wizard.createRow(projectId, 4, 'mission_variant', { variants: r.text ?? r.json });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }
}
