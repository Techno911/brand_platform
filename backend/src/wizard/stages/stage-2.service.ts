import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AIService } from '../../ai/ai.service';
import { WizardService } from '../wizard.service';
import { Row, RowStatus, RowType } from '../row.entity';

/**
 * Stage 2: Owner session → Legend + Values + Mission + Vision.
 * - /challenge-owner-response in thinking-partner mode while owner answers.
 * - /legend-draft, /values-draft, /mission-variants (3–5 variants).
 *
 * Persistence model (introduced 2026-04-20 to fix «Stage 2 пустая после возврата»):
 * Каждый из трёх генераторных методов теперь сохраняет в `payload` ДВА поля:
 *  · `ownerText` — сырой ввод маркетолога (транскрипт/ответы собственника) — нужен чтобы
 *    на возврате восстановить textarea;
 *  · `draft`/`variants` — то, что вернул Claude (не менялось).
 *
 * Row имеет `sheet=4` (лист «Сессия»), `type` маркирует блок: legend_fact | value | mission_variant.
 * `getState()` читает latest-row на каждый тип и собирает полный стейт 3 блоков
 * (challenge не сохраняется — это «thinking partner» live-intro без row).
 *
 * `acceptBlock()` ставит row.status='completed' + finalized=draft — это заменяет
 * прежний frontend-only toggle (который терялся при перезагрузке / переходе).
 */
@Injectable()
export class Stage2Service {
  constructor(
    private readonly ai: AIService,
    private readonly wizard: WizardService,
    @InjectRepository(Row)
    private readonly rows: Repository<Row>,
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
      const row = await this.wizard.createRow(projectId, 4, 'legend_fact', {
        ownerText: ownerTranscript,
        draft: r.text ?? r.json,
      });
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
      const row = await this.wizard.createRow(projectId, 4, 'value', {
        ownerText: ownerTranscript,
        draft: r.text ?? r.json,
      });
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
      const row = await this.wizard.createRow(projectId, 4, 'mission_variant', {
        ownerText: ownerTranscript,
        variants: r.text ?? r.json,
      });
      return { row, ai: r };
    }
    return { row: null, ai: r };
  }

  /**
   * Marker «маркетолог утвердил этот блок»: ставит row.status='completed' +
   * row.finalized=payload.draft|variants. Это персистентная версия бывшего
   * frontend-only флага `blocks[block].accepted`, который умирал при любой
   * навигации. Артём 2026-04-20: «нажал принять, и ничего не произошло».
   * Теперь accepted живёт в БД — при возврате виден чекмарк на вкладке.
   */
  async acceptBlock(projectId: string, block: 'legend' | 'values' | 'mission') {
    const type: RowType =
      block === 'legend' ? 'legend_fact' : block === 'values' ? 'value' : 'mission_variant';
    const row = await this.rows.findOne({
      where: { projectId, sheet: 4, type },
      order: { createdAt: 'DESC' },
    });
    if (!row) {
      throw new NotFoundException(
        `Блок «${block}» не сгенерирован — сначала нажмите «Сгенерировать».`,
      );
    }
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const draft = payload.draft ?? payload.variants;
    if (!draft) {
      throw new NotFoundException(
        `В блоке «${block}» нет черновика — пере-сгенерируйте и попробуйте ещё раз.`,
      );
    }
    row.status = 'completed' as RowStatus;
    row.finalized = (typeof draft === 'object' ? (draft as any) : { text: draft }) as any;
    await this.rows.save(row);
    return { row };
  }

  /**
   * Снять утверждение с блока — маркетолог хочет внести правку. Возвращает
   * блок к 'planned', сбрасывает finalized. Текст и черновик не трогаем.
   */
  async reopenBlock(projectId: string, block: 'legend' | 'values' | 'mission') {
    const type: RowType =
      block === 'legend' ? 'legend_fact' : block === 'values' ? 'value' : 'mission_variant';
    const row = await this.rows.findOne({
      where: { projectId, sheet: 4, type },
      order: { createdAt: 'DESC' },
    });
    if (!row) return { row: null };
    row.status = 'planned' as RowStatus;
    row.finalized = null;
    await this.rows.save(row);
    return { row };
  }

  /**
   * Восстановление стейта Stage 2 для 3 блоков (challenge — live, не сохраняется).
   * Возвращает то же, что Stage2Page держит в state: { text, draft, accepted }.
   * Фронт перерисует вкладки с чекмарками, Textarea и Canvas.
   */
  async getState(projectId: string) {
    const [legend, values, mission] = await Promise.all([
      this.rows.findOne({
        where: { projectId, sheet: 4, type: 'legend_fact' },
        order: { createdAt: 'DESC' },
      }),
      this.rows.findOne({
        where: { projectId, sheet: 4, type: 'value' },
        order: { createdAt: 'DESC' },
      }),
      this.rows.findOne({
        where: { projectId, sheet: 4, type: 'mission_variant' },
        order: { createdAt: 'DESC' },
      }),
    ]);
    const unpackLegendOrValues = (row: Row | null) => {
      if (!row) return { text: '', draft: null, accepted: false };
      const p = (row.payload ?? {}) as { ownerText?: string; draft?: unknown };
      return {
        text: typeof p.ownerText === 'string' ? p.ownerText : '',
        draft: p.draft ?? null,
        accepted: row.status === 'completed' && !!row.finalized,
      };
    };
    const unpackMission = (row: Row | null) => {
      if (!row) return { text: '', draft: null, accepted: false };
      const p = (row.payload ?? {}) as { ownerText?: string; variants?: unknown };
      return {
        text: typeof p.ownerText === 'string' ? p.ownerText : '',
        draft: p.variants ?? null,
        accepted: row.status === 'completed' && !!row.finalized,
      };
    };
    return {
      legend: unpackLegendOrValues(legend),
      values: unpackLegendOrValues(values),
      mission: unpackMission(mission),
    };
  }
}
