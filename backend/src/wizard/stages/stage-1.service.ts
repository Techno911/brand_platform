import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIService } from '../../ai/ai.service';
import { WizardService } from '../wizard.service';
import { Row, RowStatus } from '../row.entity';

/**
 * Stage 1: "Voice of customer" (Интервью + Отзывы + Конкуренты).
 * - Marketer uploads brief → sanitize → parallel: interview patterns + reviews classifier + competitor extraction.
 * - Cross-check at end: rows populated → next stage unlocked.
 */
@Injectable()
export class Stage1Service {
  constructor(
    private readonly ai: AIService,
    private readonly wizard: WizardService,
    @InjectRepository(Row)
    private readonly rows: Repository<Row>,
  ) {}

  /**
   * «Утвердить и перейти к Стадии 2». Маркетолог закрывает Стадию 1 —
   * последний interview-row становится `finalized` + status='completed'.
   * Это не полный Approval (owner_viewer.approved_by) — это marker закрытия
   * маркетологической работы, которая открывает следующую стадию.
   *
   * Полный Approval Customer Portrait получит в составе итогового документа
   * на Стадии 4 через `artifact='final_document'`.
   */
  async finalizeStage1(projectId: string) {
    // Берём последнюю row с extracted patterns (не raw) — это то, что маркетолог видит
    // и готов «утвердить». Если patterns нет — значит пользователь не нажимал
    // «Извлечь паттерны», такой state утвердить нельзя.
    const row = await this.rows.findOne({
      where: { projectId, sheet: 1, type: 'interview' },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new NotFoundException('Нет ни одной row Стадии 1 — добавьте интервью и извлеките паттерны.');
    const patterns = (row.payload as any)?.patterns;
    if (!patterns || typeof patterns === 'string') {
      throw new NotFoundException('Черновик паттернов не сформирован — запустите «Извлечь паттерны».');
    }
    row.finalized = patterns;
    row.status = 'completed' as RowStatus;
    await this.rows.save(row);
    return { row };
  }

  /** /interview-patterns on raw interview transcript. */
  async runInterviewPatterns(projectId: string, userId: string, transcript: string) {
    const r = await this.ai.invoke({
      projectId,
      userId,
      kind: 'interview_patterns',
      promptName: 'interview-patterns',
      userText: transcript,
      userTextSource: 'brief_upload',
      stage: 1,
    });
    if (r.ok) {
      // AIService теперь парсит plain-text JSON и кладёт в r.json; для interview-patterns
      // это нормированная структура (InterviewPatterns). Фолбэк на r.text только если
      // Claude вернул нераспарсиваемый текст — тогда маркетолог увидит сырое содержимое.
      const patterns = r.json ?? r.text;
      const row = await this.wizard.createRow(projectId, 1, 'interview', { raw: transcript, patterns });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  /** /plan-mode-15q to deepen missing fields — Tverdoholobov. */
  async askClarifications(projectId: string, userId: string, currentState: Record<string, any>) {
    return this.ai.invoke({
      projectId,
      userId,
      kind: 'plan_mode_15q',
      promptName: 'plan-mode-15q',
      variables: {
        stage: 1,
        stateJson: JSON.stringify(currentState, null, 2),
      },
      stage: 1,
    });
  }
}
