import { Injectable } from '@nestjs/common';
import { AIService } from '../../ai/ai.service';
import { WizardService } from '../wizard.service';

/**
 * Stage 4: 4 tests of the brand message (parallel, per Hegay).
 * Tests: memorability / differentiation / claim-backing / emotional-hook (BP 3.1 sheet 6).
 */
@Injectable()
export class Stage4Service {
  private readonly tests = [
    'memorability_test',
    'differentiation_test',
    'claim_backing_test',
    'emotional_hook_test',
  ];

  constructor(
    private readonly ai: AIService,
    private readonly wizard: WizardService,
  ) {}

  async runAllTests(projectId: string, userId: string, messageText: string) {
    const results = await Promise.all(
      this.tests.map(async (test) => {
        const r = await this.ai.invoke({
          projectId,
          userId,
          kind: 'review_classify',
          promptName: 'review-classify',
          useJudge: true,
          variables: { test },
          userText: messageText,
          userTextSource: 'marketer_input',
          stage: 4,
        });
        return { test, result: r };
      }),
    );
    for (const { test, result } of results) {
      await this.wizard.createRow(projectId, 6, 'message_test_result', {
        test,
        passed: result.ok,
        output: result.text ?? result.json,
        runId: result.runId,
      });
    }
    return results;
  }
}
