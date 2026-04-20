// Structured-view черновиков Стадии 2 — вместо сырого JSON.dump, который видел маркетолог.
//
// На Стадии 2 четыре блока (Challenge / Legend / Values / Mission), и каждый промпт возвращает
// структурированный JSON (см. backend/prompts/*.md). Здесь мы рендерим этот JSON как человеческий
// UI — плитки, списки, заголовки — в стиле Stage 1 Draft view.
//
// Почему не один универсальный table-renderer: формы разные по смыслу (legend — факты с датами,
// values — поведенческие ценности с manifestation'ами, mission — 3 варианта со scoring'ом,
// challenge — вопросы-гипотезы-риски). Пытаться покрыть это одной «умной» таблицей = получить
// уродливую генерику. Лучше 4 лаконичных компонента.
//
// Все view умеют fallback:
//   - Если `data` — строка (LLM вернул plain text вместо JSON) → рендерим как текст.
//   - Если `data` — пустой объект / не-ожидаемая форма → показываем «Формат неожиданный»
//     + текстовый слепок (safe: шрифтом текста, не моноширинным кодом).
//
// NB: типы описаны через interface'ы `Legend*` / `Values*` / `Mission*` / `Challenge*` —
// они не экспортируются из types/api.ts умышленно, чтобы не тянуть их в чужие рендеры.
// Если Stage 3 начнёт требовать такую же типизацию, вынесем отдельно.

import {
  CalendarDays,
  MapPin,
  User2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Quote,
  Ban,
  CheckCircle2,
  MessageCircleQuestion,
  Lightbulb,
  ShieldAlert,
} from 'lucide-react';

// ————————————————————————————————————————————————————————————————————
// Schemas (локально — см. backend/prompts/*.md)
// ————————————————————————————————————————————————————————————————————

interface LegendOrigin {
  year?: number;
  place?: string;
  founder_name?: string;
  founder_role?: string;
  reason_to_start?: string;
}
interface LegendMilestone {
  year?: number;
  event?: string;
  why_matters?: string;
}
interface LegendTurningPoint {
  year?: number;
  event?: string;
  before?: string;
  after?: string;
}
interface LegendCurrentState {
  team_size?: number;
  geography?: string;
  typical_check_rub?: number;
}
interface LegendData {
  legend?: {
    origin?: LegendOrigin;
    milestones?: LegendMilestone[];
    turning_point?: LegendTurningPoint;
    current_state?: LegendCurrentState;
  };
  unverified_claims?: string[];
  warnings?: string[];
}

interface ValueManifestation {
  context?: string;
  action?: string;
}
interface ValueItem {
  name?: string;
  definition?: string;
  manifestations?: ValueManifestation[];
  opposite?: string;
  source_quote?: string;
}
interface ValuesData {
  values?: ValueItem[];
  anti_values?: string[];
  warnings?: string[];
}

interface MissionVariant {
  text?: string;
  action_verb?: string;
  target?: string;
  outcome?: string;
  why_not_mercantile?: string;
  scoring?: {
    clarity?: number;
    uniqueness?: number;
    actionability?: number;
  };
}
interface MissionData {
  variants?: MissionVariant[];
  mercantile_flags?: string[];
  warnings?: string[];
}

interface ChallengeItem {
  question?: string;
  hypothesis?: string;
  risk_if_skipped?: string;
}
interface ChallengeData {
  challenges?: ChallengeItem[];
  surface_answer_signals?: string[];
}

// ————————————————————————————————————————————————————————————————————
// Helpers
// ————————————————————————————————————————————————————————————————————

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}

function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** Универсальный fallback: data — строка → рендерим абзацами. Пустой объект/неожиданный → плейсхолдер. */
function FallbackText({ raw, hint }: { raw: unknown; hint?: string }) {
  if (isNonEmptyString(raw)) {
    // Не показываем как код — просто абзацами.
    return (
      <div className="space-y-2 text-[13px] leading-relaxed text-[#44403C] whitespace-pre-line">
        {raw}
      </div>
    );
  }
  return (
    <div className="text-[13px] text-[#78716C] italic">
      {hint ?? 'Claude вернул ответ в нестандартном виде. Пересгенерируйте или откройте audit log (tsx).'}
    </div>
  );
}

/** Маленький «чип» факта — год, место, имя, роль. */
function Chip({ icon: Icon, children }: { icon?: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[#F5F5F4] text-[12px] text-[#44403C]">
      {Icon && <Icon className="w-3.5 h-3.5 text-[#78716C]" aria-hidden />}
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#78716C] mb-2">
      {children}
    </h4>
  );
}

function WarningsBlock({ warnings }: { warnings?: string[] }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div className="mt-4 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl flex gap-2">
      <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" aria-hidden />
      <div className="text-[13px] text-[#92400E] space-y-1">
        <p className="font-semibold">Валидатор просит доработать:</p>
        <ul className="list-disc pl-5 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// LegendView
// ————————————————————————————————————————————————————————————————————

function LegendView({ data }: { data: LegendData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Легенда должна быть JSON-объектом с полями origin, milestones, turning_point, current_state." />;
  }
  const d = data as LegendData;
  const hasLegend = isObject(d.legend);
  if (!hasLegend) {
    return <FallbackText raw={data} />;
  }
  const { origin, milestones, turning_point, current_state } = d.legend!;

  return (
    <div className="space-y-5">
      {/* Origin */}
      {origin && (
        <div>
          <SectionTitle>Точка старта</SectionTitle>
          <div className="flex flex-wrap gap-2 mb-2">
            {origin.year !== undefined && <Chip icon={CalendarDays}>{origin.year}</Chip>}
            {isNonEmptyString(origin.place) && <Chip icon={MapPin}>{origin.place}</Chip>}
            {isNonEmptyString(origin.founder_name) && (
              <Chip icon={User2}>
                {origin.founder_name}
                {isNonEmptyString(origin.founder_role) && ` · ${origin.founder_role}`}
              </Chip>
            )}
          </div>
          {isNonEmptyString(origin.reason_to_start) && (
            <p className="text-[14px] leading-relaxed text-[#1A1A1A]">{origin.reason_to_start}</p>
          )}
        </div>
      )}

      {/* Milestones */}
      {Array.isArray(milestones) && milestones.length > 0 && (
        <div>
          <SectionTitle>Поворотные даты</SectionTitle>
          <ol className="space-y-3 border-l-2 border-[#E7E5E4] pl-4">
            {milestones.map((m, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-[#4F46E5]"
                  aria-hidden
                />
                <div className="font-mono text-[11px] text-[#78716C] tabular-nums mb-0.5">
                  {m.year ?? '—'}
                </div>
                {isNonEmptyString(m.event) && (
                  <p className="font-medium text-[14px] text-[#1A1A1A] leading-snug">{m.event}</p>
                )}
                {isNonEmptyString(m.why_matters) && (
                  <p className="text-[13px] text-[#78716C] mt-0.5 leading-relaxed">{m.why_matters}</p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Turning point */}
      {turning_point && (isNonEmptyString(turning_point.event) || turning_point.year !== undefined) && (
        <div>
          <SectionTitle>Перелом</SectionTitle>
          <div className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl p-4 space-y-3">
            <div className="flex items-baseline gap-3">
              {turning_point.year !== undefined && (
                <span className="font-mono text-[14px] tabular-nums text-[#4F46E5] font-semibold">
                  {turning_point.year}
                </span>
              )}
              {isNonEmptyString(turning_point.event) && (
                <p className="font-medium text-[14px] text-[#1A1A1A]">{turning_point.event}</p>
              )}
            </div>
            {(isNonEmptyString(turning_point.before) || isNonEmptyString(turning_point.after)) && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div className="bg-white border border-[#E7E5E4] rounded-lg p-3">
                  <p className="uppercase-mono text-[#78716C] mb-1">До</p>
                  <p className="text-[13px] text-[#44403C] leading-relaxed">
                    {turning_point.before ?? '—'}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#A8A29E] hidden sm:block justify-self-center" aria-hidden />
                <div className="bg-white border border-[#86EFAC] rounded-lg p-3">
                  <p className="uppercase-mono text-[#15803D] mb-1">После</p>
                  <p className="text-[13px] text-[#44403C] leading-relaxed">
                    {turning_point.after ?? '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Current state */}
      {current_state && (
        <div>
          <SectionTitle>Сегодня</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {current_state.team_size !== undefined && <Chip>Команда: {current_state.team_size} чел.</Chip>}
            {isNonEmptyString(current_state.geography) && <Chip>{current_state.geography}</Chip>}
            {current_state.typical_check_rub !== undefined && (
              <Chip>Средний чек: {current_state.typical_check_rub.toLocaleString('ru-RU')} ₽</Chip>
            )}
          </div>
        </div>
      )}

      {/* Unverified claims */}
      {Array.isArray(d.unverified_claims) && d.unverified_claims.length > 0 && (
        <div>
          <SectionTitle>Утверждения без источника</SectionTitle>
          <p className="text-[12px] text-[#78716C] mb-2">
            Claude вынес это в отдельный список — перед утверждением легенды попросите собственника подтвердить.
          </p>
          <ul className="space-y-1.5">
            {d.unverified_claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[#44403C] leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0 mt-0.5" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <WarningsBlock warnings={d.warnings} />
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// ValuesView
// ————————————————————————————————————————————————————————————————————

function ValuesView({ data }: { data: ValuesData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Ценности должны быть JSON-массивом с полями name, definition, manifestations, opposite, source_quote." />;
  }
  const d = data as ValuesData;
  const values = Array.isArray(d.values) ? d.values : [];

  if (values.length === 0) {
    return <FallbackText raw={data} hint="Ни одной ценности не пришло. Попробуйте пересгенерировать с бόльшим исходником." />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {values.map((v, i) => (
          <ValueCard key={i} value={v} />
        ))}
      </div>

      {/* Anti-values */}
      {Array.isArray(d.anti_values) && d.anti_values.length > 0 && (
        <div>
          <SectionTitle>Что НЕ является ценностью</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {d.anti_values.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[13px] text-[#991B1B]"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden />
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <WarningsBlock warnings={d.warnings} />
    </div>
  );
}

function ValueCard({ value }: { value: ValueItem }) {
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-4 flex flex-col gap-3">
      <div>
        <h5 className="font-semibold text-[15px] text-[#1A1A1A] leading-tight">
          {value.name ?? 'Без названия'}
        </h5>
        {isNonEmptyString(value.definition) && (
          <p className="text-[13px] text-[#44403C] mt-1 leading-relaxed">{value.definition}</p>
        )}
      </div>

      {Array.isArray(value.manifestations) && value.manifestations.length > 0 && (
        <div>
          <p className="uppercase-mono text-[#78716C] mb-1.5">Как это выглядит в работе</p>
          <ul className="space-y-1.5">
            {value.manifestations.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[#44403C] leading-relaxed">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
                <span>
                  {isNonEmptyString(m.context) && <span className="text-[#78716C]">{m.context}: </span>}
                  {m.action ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isNonEmptyString(value.opposite) && (
        <div>
          <p className="uppercase-mono text-[#78716C] mb-1">Чего мы не делаем</p>
          <p className="text-[13px] text-[#991B1B] leading-relaxed">{value.opposite}</p>
        </div>
      )}

      {isNonEmptyString(value.source_quote) && (
        <div className="bg-[#FAFAF9] border-l-2 border-[#4F46E5] rounded-r-md px-3 py-2">
          <div className="flex items-start gap-2">
            <Quote className="w-3.5 h-3.5 text-[#4F46E5] flex-shrink-0 mt-1" aria-hidden />
            <p className="text-[12px] italic text-[#44403C] leading-relaxed">«{value.source_quote}»</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// MissionView
// ————————————————————————————————————————————————————————————————————

function MissionView({ data }: { data: MissionData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Миссия должна быть JSON с массивом variants (text, action_verb, target, outcome, scoring)." />;
  }
  const d = data as MissionData;
  const variants = Array.isArray(d.variants) ? d.variants : [];

  if (variants.length === 0) {
    return <FallbackText raw={data} hint="Вариантов миссии не пришло. Попробуйте пересгенерировать с бόльшим исходником." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {variants.map((v, i) => (
          <MissionVariantCard key={i} variant={v} index={i + 1} />
        ))}
      </div>

      {Array.isArray(d.mercantile_flags) && d.mercantile_flags.length > 0 && (
        <div>
          <SectionTitle>Денежные маркеры в исходнике</SectionTitle>
          <p className="text-[12px] text-[#78716C] mb-2">
            Эти слова в миссию не попали (канон запрещает), но они были в ответе собственника — возьмите на заметку.
          </p>
          <div className="flex flex-wrap gap-2">
            {d.mercantile_flags.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[12px] text-[#92400E]"
              >
                <ShieldAlert className="w-3 h-3" aria-hidden />
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <WarningsBlock warnings={d.warnings} />
    </div>
  );
}

function MissionVariantCard({ variant, index }: { variant: MissionVariant; index: number }) {
  const s = variant.scoring;
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[13px] flex items-center justify-center">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-[#1A1A1A] leading-relaxed">
            {variant.text ?? '—'}
          </p>
          {(isNonEmptyString(variant.action_verb) || isNonEmptyString(variant.target) || isNonEmptyString(variant.outcome)) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {isNonEmptyString(variant.action_verb) && <Chip>Глагол: {variant.action_verb}</Chip>}
              {isNonEmptyString(variant.target) && <Chip>Кому: {variant.target}</Chip>}
              {isNonEmptyString(variant.outcome) && <Chip>Результат: {variant.outcome}</Chip>}
            </div>
          )}
          {isNonEmptyString(variant.why_not_mercantile) && (
            <p className="text-[12px] text-[#78716C] mt-2 leading-relaxed">
              Почему не сводится к деньгам: {variant.why_not_mercantile}
            </p>
          )}
          {s && (s.clarity !== undefined || s.uniqueness !== undefined || s.actionability !== undefined) && (
            <div className="mt-3 pt-3 border-t border-[#F5F5F4] grid grid-cols-3 gap-3">
              <ScoreBar label="Понятность" value={s.clarity} />
              <ScoreBar label="Уникальность" value={s.uniqueness} />
              <ScoreBar label="Применимость" value={s.actionability} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return <div />;
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11px] text-[#78716C]">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-[#44403C]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#4F46E5] rounded-full"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// ChallengeView
// ————————————————————————————————————————————————————————————————————

function ChallengeView({ data }: { data: ChallengeData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Ответ должен быть JSON с challenges[] и surface_answer_signals[]." />;
  }
  const d = data as ChallengeData;
  const challenges = Array.isArray(d.challenges) ? d.challenges : [];

  return (
    <div className="space-y-5">
      {challenges.length > 0 ? (
        <div>
          <SectionTitle>Вопросы для собственника</SectionTitle>
          <ol className="space-y-3">
            {challenges.map((c, i) => (
              <li key={i} className="bg-white border border-[#E7E5E4] rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-[#EEF2FF] flex items-center justify-center">
                    <MessageCircleQuestion className="w-4 h-4 text-[#4F46E5]" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-[14px] font-medium text-[#1A1A1A] leading-snug">
                      {c.question ?? '—'}
                    </p>
                    {isNonEmptyString(c.hypothesis) && (
                      <div className="flex items-start gap-2 text-[13px] text-[#44403C]">
                        <Lightbulb className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0 mt-0.5" aria-hidden />
                        <span>
                          <span className="text-[#78716C]">Гипотеза: </span>
                          {c.hypothesis}
                        </span>
                      </div>
                    )}
                    {isNonEmptyString(c.risk_if_skipped) && (
                      <div className="flex items-start gap-2 text-[13px] text-[#991B1B]">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden />
                        <span>
                          <span className="text-[#78716C]">Что потеряем, если пропустим: </span>
                          {c.risk_if_skipped}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <FallbackText raw={data} hint="Уточняющих вопросов не пришло — возможно, ответ собственника уже достаточно конкретен." />
      )}

      {/* Surface-answer signals */}
      {Array.isArray(d.surface_answer_signals) && d.surface_answer_signals.length > 0 && (
        <div>
          <SectionTitle>Слова-маркеры «ответ для галочки»</SectionTitle>
          <p className="text-[12px] text-[#78716C] mb-2">
            Если собственник произнёс эти слова — скорее всего за ними нет живой практики. Задайте уточняющий.
          </p>
          <div className="flex flex-wrap gap-2">
            {d.surface_answer_signals.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-[#FFFBEB] border border-[#FDE68A] text-[12px] text-[#92400E]"
              >
                <Sparkles className="w-3 h-3" aria-hidden />
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// Public entry: Stage2DraftView
// ————————————————————————————————————————————————————————————————————

export type Stage2Block = 'challenge' | 'legend' | 'values' | 'mission';

/**
 * Stage 2 draft renderer.
 *
 * @param block   Какой блок показываем — определяет схему рендера.
 * @param data    AIResult.json (предпочтительно) или AIResult.text (fallback).
 */
export default function Stage2DraftView({
  block,
  data,
}: {
  block: Stage2Block;
  data: unknown;
}) {
  if (data === null || data === undefined) {
    return <FallbackText raw={null} hint="Пусто." />;
  }
  switch (block) {
    case 'challenge':
      return <ChallengeView data={data} />;
    case 'legend':
      return <LegendView data={data} />;
    case 'values':
      return <ValuesView data={data} />;
    case 'mission':
      return <MissionView data={data} />;
    default:
      return <FallbackText raw={data} />;
  }
}
