import { Injectable } from '@nestjs/common';
import { RegexValidatorService } from './regex-validator.service';
import { LlmJudgeService } from './llm-judge.service';
import { MethodologyComplianceService } from './methodology-compliance.service';

export type TrafficLight = 'green' | 'yellow' | 'red';

export interface ClassificationInput {
  projectId: string;
  userId: string;
  artifact: any;
  payload: Record<string, any>;
}

export interface ClassificationResult {
  trafficLight: TrafficLight;
  reasons: string[];
  regex: ReturnType<RegexValidatorService['validate']>;
  judge?: Awaited<ReturnType<LlmJudgeService['judge']>>;
  methodology?: Awaited<ReturnType<MethodologyComplianceService['check']>>;
}

/**
 * INSIGHTS §4: borderline classifier.
 * Returns green / yellow / red by combining all 3 levels.
 * Red blocks. Yellow requires explicit marketer click. Green auto-promote.
 */
@Injectable()
export class BorderlineClassifierService {
  constructor(
    private readonly regex: RegexValidatorService,
    private readonly judge: LlmJudgeService,
    private readonly methodology: MethodologyComplianceService,
  ) {}

  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    const regex = this.regex.validate({ artifact: input.artifact, payload: input.payload });

    if (!regex.passed) {
      return {
        trafficLight: 'red',
        reasons: regex.errors.map((e) => `regex:${e.code}:${e.message}`),
        regex,
      };
    }

    const [judge, methodology] = await Promise.all([
      this.judge.judge({
        projectId: input.projectId,
        userId: input.userId,
        artifact: input.artifact,
        payload: input.payload,
      }),
      this.methodology.check({
        projectId: input.projectId,
        userId: input.userId,
        artifact: input.artifact,
        payload: input.payload,
      }),
    ]);

    const reasons: string[] = [];
    for (const w of regex.warnings) reasons.push(`warn:${w.code}:${w.message}`);
    for (const i of judge.issues) reasons.push(`judge:${i}`);
    for (const v of methodology.violations) reasons.push(`methodology:${v}`);

    let light: TrafficLight = 'green';
    if (!methodology.passed) light = 'red';
    else if (!judge.passed) light = 'red';
    else if (judge.score < 0.7) light = 'yellow';
    else if (regex.warnings.length > 0) light = 'yellow';

    return { trafficLight: light, reasons, regex, judge, methodology };
  }
}
