import { Injectable } from '@nestjs/common';
import { BorderlineClassifierService, ClassificationResult } from './borderline-classifier.service';
import { MetricsService } from '../observability/metrics.service';

export interface ValidationInput {
  projectId: string;
  userId: string;
  artifact: any;
  payload: Record<string, any>;
}

export interface ValidationReport extends ClassificationResult {
  artifact: string;
  validatorPassed: boolean;
  blockedAtLevel: 'none' | 'regex' | 'llm_judge' | 'methodology' | 'borderline_red';
  timestamp: string;
}

/**
 * 3-level validator service:
 *   1. Regex (hard rules)
 *   2. LLM-judge (semantic quality)
 *   3. Methodology-compliance-check (BP 3.1 canon)
 *   + Borderline classifier (green/yellow/red)
 * Only `green` (+ `yellow` with explicit marketer override in UI) may promote to Approval.
 */
@Injectable()
export class ValidatorService {
  constructor(
    private readonly classifier: BorderlineClassifierService,
    private readonly metrics: MetricsService,
  ) {}

  async validate(input: ValidationInput): Promise<ValidationReport> {
    const result = await this.classifier.classify(input);
    let blockedAtLevel: ValidationReport['blockedAtLevel'] = 'none';
    if (!result.regex.passed) blockedAtLevel = 'regex';
    else if (result.methodology && !result.methodology.passed) blockedAtLevel = 'methodology';
    else if (result.judge && !result.judge.passed) blockedAtLevel = 'llm_judge';
    else if (result.trafficLight === 'red') blockedAtLevel = 'borderline_red';

    if (blockedAtLevel !== 'none') {
      this.metrics.validatorBlocks.inc({ level: blockedAtLevel, reason: String(input.artifact) });
    }

    return {
      ...result,
      artifact: String(input.artifact),
      validatorPassed: blockedAtLevel === 'none' && result.trafficLight !== 'red',
      blockedAtLevel,
      timestamp: new Date().toISOString(),
    };
  }
}
