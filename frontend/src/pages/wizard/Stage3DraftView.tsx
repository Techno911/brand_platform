// Structured-view черновиков Стадии 3 — вместо сырого JSON.dump.
//
// На Стадии 3 четыре блока: Positioning / Messages / Critique / Borderline. Каждый промпт
// возвращает структурированный JSON, фронт рендерит его как человеческий UI.
//
// Schemas — см. backend/prompts/positioning-draft.md, message-variants.md, critique-message.md,
// review-classify.md (borderline).
//
// Как и в Stage2DraftView, каждый view имеет fallback на строку / нестандартную форму.

import {
  Target,
  ShieldCheck,
  AlertTriangle,
  Quote,
  ArrowRight,
  Check,
  X,
  Star,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { ARCHETYPES, archetypeRu } from '../../config/archetypes';

// ————————————————————————————————————————————————————————————————————
// Schemas (локально — см. backend/prompts/*.md)
// ————————————————————————————————————————————————————————————————————

interface PositioningData {
  archetype?: {
    primary?: string;
    secondary?: string | null;
    shadow?: string;
    evidence?: string[];
  };
  we_pair?: {
    we_are?: string[];
    we_are_not?: string[];
  };
  positioning_statement?: string;
  category?: string;
  competitor_diff?: string;
  warnings?: string[];
}

interface MessageVariant {
  text?: string;
  word_count?: number;
  hook_type?: string;
  memorability_score?: number;
  methodology_fit?: string;
}
interface MessagesData {
  variants?: MessageVariant[];
  rejected_candidates?: Array<{ text?: string; reason?: string }>;
  warnings?: string[];
}

interface CritiqueError {
  severity?: 'high' | 'medium' | 'low';
  text?: string;
  evidence?: string;
}
interface CritiqueImprovement {
  improvement?: string;
  expected_effect?: string;
}
interface CritiqueSingle {
  role?: string;
  iteration?: number;
  errors?: CritiqueError[];
  improvements?: CritiqueImprovement[];
  verdict?: 'keep' | 'revise' | 'reject';
}
/** Backend возвращает массив: [{ role, result: AIResult<CritiqueSingle> }]. Фронт часть этой
 *  логики знает — он передаёт сюда либо уже объединённый массив CritiqueSingle[], либо
 *  обёртку как есть. Нормализуем оба случая.
 */
type CritiqueData = CritiqueSingle[] | {
  role?: string;
  result?: { json?: CritiqueSingle };
}[] | CritiqueSingle | unknown;

interface BorderlineData {
  verdict?: 'green' | 'yellow' | 'red';
  trafficLight?: 'green' | 'yellow' | 'red';
  reasoning?: string;
  issues?: string[];
  warnings?: string[];
}

// ————————————————————————————————————————————————————————————————————
// Helpers (дублируют Stage2DraftView — сознательно, чтобы не тянуть
// кросс-файловые зависимости, если один из view будет развиваться отдельно).
// ————————————————————————————————————————————————————————————————————

function isNonEmptyString(x: unknown): x is string {
  return typeof x === 'string' && x.trim().length > 0;
}
function isObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function FallbackText({ raw, hint }: { raw: unknown; hint?: string }) {
  if (isNonEmptyString(raw)) {
    return (
      <div className="space-y-2 text-[13px] leading-relaxed text-[#44403C] whitespace-pre-line">
        {raw}
      </div>
    );
  }
  return (
    <div className="text-[13px] text-[#78716C] italic">
      {hint ?? 'Claude вернул ответ в нестандартном виде. Пересгенерируйте.'}
    </div>
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
// PositioningView
// ————————————————————————————————————————————————————————————————————

function PositioningView({ data }: { data: PositioningData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Позиционирование должно быть JSON-объектом с archetype, we_pair, positioning_statement, category, competitor_diff." />;
  }
  const d = data as PositioningData;
  const archetypeRuName = archetypeRu(d.archetype?.primary);
  const archetypeMeta = archetypeRuName
    ? ARCHETYPES.find((a) => a.ru === archetypeRuName)
    : null;

  return (
    <div className="space-y-5">
      {/* Archetype block */}
      {d.archetype && (
        <div className="bg-[#FAF5FF] border border-[#E9D5FF] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5 text-[#4F46E5]" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline flex-wrap gap-2">
                <p className="uppercase-mono text-[#78716C]">Архетип</p>
                {d.archetype.primary && (
                  <span className="font-semibold text-[15px] text-[#1A1A1A]">
                    {archetypeRuName ?? d.archetype.primary}
                  </span>
                )}
              </div>
              {archetypeMeta && (
                <p className="text-[13px] text-[#44403C] mt-1">
                  {archetypeMeta.short}. <span className="text-[#78716C]">{archetypeMeta.example}</span>
                </p>
              )}
              {isNonEmptyString(d.archetype.secondary) && (
                <div className="mt-2 flex items-center gap-2 text-[12px]">
                  <span className="text-[#78716C]">Вторичный:</span>
                  <span className="font-medium text-[#44403C]">
                    {archetypeRu(d.archetype.secondary) ?? d.archetype.secondary}
                  </span>
                </div>
              )}
              {isNonEmptyString(d.archetype.shadow) && (
                <p className="text-[12px] text-[#78716C] mt-2 italic">
                  Тень: {d.archetype.shadow}
                </p>
              )}
              {Array.isArray(d.archetype.evidence) && d.archetype.evidence.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="uppercase-mono text-[#78716C]">Доказательства</p>
                  <ul className="space-y-1">
                    {d.archetype.evidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#44403C] leading-relaxed">
                        <Quote className="w-3 h-3 text-[#4F46E5] flex-shrink-0 mt-1" aria-hidden />
                        <span className="italic">«{e}»</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Positioning statement */}
      {isNonEmptyString(d.positioning_statement) && (
        <div>
          <SectionTitle>Позиционирование</SectionTitle>
          <div className="bg-white border-l-4 border-[#4F46E5] rounded-r-lg px-4 py-3">
            <p className="text-[15px] font-medium text-[#1A1A1A] leading-relaxed">
              {d.positioning_statement}
            </p>
          </div>
        </div>
      )}

      {/* Category + competitor diff */}
      {(isNonEmptyString(d.category) || isNonEmptyString(d.competitor_diff)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {isNonEmptyString(d.category) && (
            <div className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl p-3">
              <p className="uppercase-mono text-[#78716C] mb-1">Категория</p>
              <p className="text-[13px] text-[#1A1A1A]">{d.category}</p>
            </div>
          )}
          {isNonEmptyString(d.competitor_diff) && (
            <div className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl p-3">
              <p className="uppercase-mono text-[#78716C] mb-1">Отличие от конкурента</p>
              <p className="text-[13px] text-[#1A1A1A]">{d.competitor_diff}</p>
            </div>
          )}
        </div>
      )}

      {/* We pair */}
      {d.we_pair && (Array.isArray(d.we_pair.we_are) || Array.isArray(d.we_pair.we_are_not)) && (
        <div>
          <SectionTitle>Мы / Мы не</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border border-[#86EFAC] rounded-xl p-3">
              <p className="uppercase-mono text-[#15803D] mb-2">Мы</p>
              <ul className="space-y-1.5">
                {(d.we_pair.we_are ?? []).map((x, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#1A1A1A] leading-relaxed">
                    <Check className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-[#FECACA] rounded-xl p-3">
              <p className="uppercase-mono text-[#991B1B] mb-2">Мы не</p>
              <ul className="space-y-1.5">
                {(d.we_pair.we_are_not ?? []).map((x, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#1A1A1A] leading-relaxed">
                    <X className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0 mt-0.5" aria-hidden />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <WarningsBlock warnings={d.warnings} />
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// MessagesView
// ————————————————————————————————————————————————————————————————————

function MessagesView({ data }: { data: MessagesData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Месседжи должны быть JSON с variants[] и (опц.) rejected_candidates[]." />;
  }
  const d = data as MessagesData;
  const variants = Array.isArray(d.variants) ? d.variants : [];

  if (variants.length === 0) {
    return <FallbackText raw={data} hint="Вариантов месседжа не пришло. Попробуйте пересгенерировать." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {variants.map((v, i) => (
          <MessageVariantCard key={i} variant={v} index={i + 1} />
        ))}
      </div>

      {Array.isArray(d.rejected_candidates) && d.rejected_candidates.length > 0 && (
        <div>
          <SectionTitle>Что Claude отбросил</SectionTitle>
          <p className="text-[12px] text-[#78716C] mb-2">
            Эти варианты пришли в голову, но не прошли — посмотрите, вдруг идея вдохновит.
          </p>
          <ul className="space-y-2">
            {d.rejected_candidates.map((c, i) => (
              <li key={i} className="bg-[#FAFAF9] border border-[#E7E5E4] rounded-lg p-3 text-[13px]">
                <p className="text-[#44403C] line-through">{c.text ?? '—'}</p>
                {isNonEmptyString(c.reason) && (
                  <p className="text-[12px] text-[#78716C] mt-1">Почему: {c.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <WarningsBlock warnings={d.warnings} />
    </div>
  );
}

const HOOK_LABEL: Record<string, string> = {
  emotional: 'эмоция',
  rational: 'рацио',
  metaphoric: 'метафора',
  provocative: 'вызов',
  question: 'вопрос',
};

function MessageVariantCard({ variant, index }: { variant: MessageVariant; index: number }) {
  const score = variant.memorability_score;
  const pct = score !== undefined ? Math.round(Math.max(0, Math.min(1, score)) * 100) : null;
  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-[#EEF2FF] text-[#4F46E5] font-semibold text-[13px] flex items-center justify-center">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold text-[#1A1A1A] leading-snug">
            {variant.text ?? '—'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {variant.word_count !== undefined && (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#F5F5F4] text-[11px] text-[#78716C] font-mono tabular-nums">
                {variant.word_count} слов
              </span>
            )}
            {isNonEmptyString(variant.hook_type) && (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#EEF2FF] text-[11px] text-[#4F46E5]">
                <Sparkles className="w-3 h-3" aria-hidden />
                {HOOK_LABEL[variant.hook_type] ?? variant.hook_type}
              </span>
            )}
            {pct !== null && (
              <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-[#FEF3C7] text-[11px] text-[#92400E] font-mono tabular-nums">
                <Star className="w-3 h-3" aria-hidden />
                {pct}% запоминаемость
              </span>
            )}
          </div>
          {isNonEmptyString(variant.methodology_fit) && (
            <p className="text-[12px] text-[#78716C] mt-2 leading-relaxed">
              Опирается на: {variant.methodology_fit}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// CritiqueView
// ————————————————————————————————————————————————————————————————————

const ROLE_LABEL: Record<string, { ru: string; color: string }> = {
  senior_architect: { ru: 'Архитектор бренда', color: 'bg-[#EEF2FF] text-[#4F46E5]' },
  pm: { ru: 'Продакт-менеджер', color: 'bg-[#FEF3C7] text-[#92400E]' },
  domain_stakeholder: { ru: 'Отраслевой эксперт', color: 'bg-[#F0FDF4] text-[#15803D]' },
};

const VERDICT_LABEL: Record<string, { ru: string; color: string; icon: typeof Check }> = {
  keep: { ru: 'Оставить', color: 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]', icon: Check },
  revise: { ru: 'Переработать', color: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]', icon: TrendingDown },
  reject: { ru: 'Отклонить', color: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]', icon: X },
};

const SEVERITY_LABEL: Record<string, { ru: string; color: string }> = {
  high: { ru: 'критично', color: 'bg-[#FEF2F2] text-[#991B1B]' },
  medium: { ru: 'серьёзно', color: 'bg-[#FEF3C7] text-[#92400E]' },
  low: { ru: 'мелочь', color: 'bg-[#F5F5F4] text-[#78716C]' },
};

function normalizeCritiques(data: unknown): CritiqueSingle[] {
  // Массив wrapper'ов [{ role, result: { json: CritiqueSingle } }] — такое приходит с бэка.
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (!isObject(item)) return null;
        if ('question' in item || 'errors' in item) {
          // Уже CritiqueSingle
          return item as CritiqueSingle;
        }
        if ('result' in item && isObject((item as any).result)) {
          const result = (item as any).result;
          if (isObject(result.json)) {
            return {
              ...(result.json as object),
              role: (item as any).role,
            } as CritiqueSingle;
          }
        }
        return null;
      })
      .filter((x): x is CritiqueSingle => x !== null);
  }
  // Одиночный объект — завернём в массив.
  if (isObject(data)) {
    return [data as CritiqueSingle];
  }
  return [];
}

function CritiqueView({ data }: { data: CritiqueData }) {
  const critiques = normalizeCritiques(data);
  if (critiques.length === 0) {
    return <FallbackText raw={data} hint="Критики не отработали. Проверьте, что бэкенд вернул полный массив ролей." />;
  }

  return (
    <div className="space-y-4">
      {critiques.map((c, i) => (
        <CritiqueCard key={i} critique={c} />
      ))}
    </div>
  );
}

function CritiqueCard({ critique }: { critique: CritiqueSingle }) {
  const role = critique.role ? ROLE_LABEL[critique.role] : undefined;
  const verdict = critique.verdict ? VERDICT_LABEL[critique.verdict] : undefined;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl p-4">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span
            className={[
              'inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12px] font-medium',
              role?.color ?? 'bg-[#F5F5F4] text-[#78716C]',
            ].join(' ')}
          >
            {role?.ru ?? critique.role ?? 'Критик'}
          </span>
          {critique.iteration !== undefined && (
            <span className="font-mono text-[11px] text-[#78716C] tabular-nums">
              итерация {critique.iteration}
            </span>
          )}
        </div>
        {verdict && (
          <span
            className={[
              'inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[12px] font-medium border',
              verdict.color,
            ].join(' ')}
          >
            {VerdictIcon && <VerdictIcon className="w-3.5 h-3.5" aria-hidden />}
            {verdict.ru}
          </span>
        )}
      </div>

      {/* Errors */}
      {Array.isArray(critique.errors) && critique.errors.length > 0 && (
        <div className="mb-3">
          <p className="uppercase-mono text-[#78716C] mb-1.5">Что не так</p>
          <ul className="space-y-2">
            {critique.errors.map((e, i) => {
              const sev = e.severity ? SEVERITY_LABEL[e.severity] : undefined;
              return (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={[
                      'inline-flex items-center px-1.5 h-5 rounded text-[10px] font-medium uppercase flex-shrink-0 mt-0.5',
                      sev?.color ?? 'bg-[#F5F5F4] text-[#78716C]',
                    ].join(' ')}
                  >
                    {sev?.ru ?? e.severity ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
                    <p className="text-[#1A1A1A]">{e.text ?? '—'}</p>
                    {isNonEmptyString(e.evidence) && (
                      <p className="text-[12px] text-[#78716C] italic mt-0.5">«{e.evidence}»</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {Array.isArray(critique.improvements) && critique.improvements.length > 0 && (
        <div>
          <p className="uppercase-mono text-[#78716C] mb-1.5">Что улучшить</p>
          <ul className="space-y-2">
            {critique.improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed">
                <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5] flex-shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-[#1A1A1A]">{imp.improvement ?? '—'}</p>
                  {isNonEmptyString(imp.expected_effect) && (
                    <p className="text-[12px] text-[#78716C] mt-0.5">
                      <ArrowRight className="w-3 h-3 inline -mt-0.5 mr-1" aria-hidden />
                      {imp.expected_effect}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————————
// BorderlineView
// ————————————————————————————————————————————————————————————————————

function BorderlineView({ data }: { data: BorderlineData | string | unknown }) {
  if (!isObject(data)) {
    return <FallbackText raw={data} hint="Финальная проверка должна быть JSON с verdict (green/yellow/red) и reasoning." />;
  }
  const d = data as BorderlineData;
  const verdict = (d.verdict ?? d.trafficLight) as 'green' | 'yellow' | 'red' | undefined;

  const VERDICT_VIEW: Record<string, { ru: string; bg: string; border: string; text: string }> = {
    green: { ru: 'Зелёный — можно утверждать', bg: 'bg-[#F0FDF4]', border: 'border-[#86EFAC]', text: 'text-[#15803D]' },
    yellow: { ru: 'Жёлтый — можно, но подумайте', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', text: 'text-[#92400E]' },
    red: { ru: 'Красный — нельзя, переработать', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', text: 'text-[#991B1B]' },
  };

  const view = verdict ? VERDICT_VIEW[verdict] : undefined;

  return (
    <div className="space-y-4">
      {view && (
        <div className={`${view.bg} border ${view.border} rounded-xl p-4`}>
          <div className="flex items-center gap-3">
            <ShieldCheck className={`w-5 h-5 ${view.text} flex-shrink-0`} aria-hidden />
            <p className={`font-semibold text-[15px] ${view.text}`}>{view.ru}</p>
          </div>
          {isNonEmptyString(d.reasoning) && (
            <p className="text-[13px] text-[#44403C] mt-2 leading-relaxed">{d.reasoning}</p>
          )}
        </div>
      )}

      {Array.isArray(d.issues) && d.issues.length > 0 && (
        <div>
          <SectionTitle>Что нашёл проверяющий</SectionTitle>
          <ul className="space-y-1.5">
            {d.issues.map((is, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[#44403C] leading-relaxed">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0 mt-0.5" aria-hidden />
                <span>{is}</span>
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
// Public entry
// ————————————————————————————————————————————————————————————————————

export type Stage3Block = 'positioning' | 'messages' | 'critique' | 'borderline';

export default function Stage3DraftView({
  block,
  data,
}: {
  block: Stage3Block;
  data: unknown;
}) {
  if (data === null || data === undefined) {
    return <FallbackText raw={null} hint="Пусто." />;
  }
  switch (block) {
    case 'positioning':
      return <PositioningView data={data} />;
    case 'messages':
      return <MessagesView data={data} />;
    case 'critique':
      return <CritiqueView data={data as CritiqueData} />;
    case 'borderline':
      return <BorderlineView data={data} />;
    default:
      return <FallbackText raw={data} />;
  }
}
