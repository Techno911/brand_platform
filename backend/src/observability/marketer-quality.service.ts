import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketerQualityScore } from './marketer-quality-score.entity';
import { User } from '../users/user.entity';

/** Korobovtsev dashboard — quality per marketer over time. */
@Injectable()
export class MarketerQualityService {
  constructor(
    @InjectRepository(MarketerQualityScore)
    private readonly repo: Repository<MarketerQualityScore>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  record(
    marketerUserId: string,
    projectId: string | null,
    validatorKind: string,
    score: number,
    extras?: {
      regexViolations?: number;
      llmJudgeFlags?: number;
      methodologyViolations?: number;
      humanOverrideCount?: number;
    },
  ) {
    return this.repo.save(
      this.repo.create({
        marketerUserId,
        projectId,
        validatorKind,
        score: score.toFixed(3),
        regexViolations: extras?.regexViolations ?? 0,
        llmJudgeFlags: extras?.llmJudgeFlags ?? 0,
        methodologyViolations: extras?.methodologyViolations ?? 0,
        humanOverrideCount: extras?.humanOverrideCount ?? 0,
      }),
    );
  }

  // Dashboard для /admin/marketer-quality. Возвращаем per-marketer агрегат с
  // fullName/email (иначе фронт пришлось бы делать N+1 запрос на resolve имён).
  // Поля совпадают с `MarketerRow` на фронте: totalValidations (не samples),
  // humanOverrideCount, fullName, email.
  async dashboard() {
    const rows = await this.repo
      .createQueryBuilder('s')
      .select('s.marketer_user_id', 'marketerUserId')
      .addSelect('AVG(s.score)', 'avgScore')
      .addSelect('COUNT(*)', 'totalValidations')
      .addSelect('SUM(s.regex_violations)', 'regexViolations')
      .addSelect('SUM(s.llm_judge_flags)', 'llmJudgeFlags')
      .addSelect('SUM(s.methodology_violations)', 'methodologyViolations')
      .addSelect('SUM(s.human_override_count)', 'humanOverrideCount')
      .groupBy('s.marketer_user_id')
      .orderBy('"avgScore"', 'DESC')
      .getRawMany<{
        marketerUserId: string;
        avgScore: string;
        totalValidations: string;
        regexViolations: string;
        llmJudgeFlags: string;
        methodologyViolations: string;
        humanOverrideCount: string;
      }>();

    if (rows.length === 0) return [];

    const userIds = rows.map((r) => r.marketerUserId);
    const users = await this.usersRepo
      .createQueryBuilder('u')
      .where('u.id IN (:...ids)', { ids: userIds })
      .getMany();
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => {
      const u = userMap.get(r.marketerUserId);
      return {
        marketerUserId: r.marketerUserId,
        fullName: u?.fullName ?? 'Неизвестный маркетолог',
        email: u?.email ?? '—',
        avgScore: Number(r.avgScore),
        totalValidations: Number(r.totalValidations),
        regexViolations: Number(r.regexViolations ?? 0),
        llmJudgeFlags: Number(r.llmJudgeFlags ?? 0),
        methodologyViolations: Number(r.methodologyViolations ?? 0),
        humanOverrideCount: Number(r.humanOverrideCount ?? 0),
      };
    });
  }
}
