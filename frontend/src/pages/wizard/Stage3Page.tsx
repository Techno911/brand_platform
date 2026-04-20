import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Sparkles, Target, Swords, CheckCircle2, Send, AlertCircle,
  ShieldCheck, Lock, Lightbulb, FileText, ArrowRight,
} from 'lucide-react';
import WizardShell from './WizardShell';
import SufflerPanel, { type SufflerHint } from '../../components/SufflerPanel';
import TimeSavedChip from '../../components/TimeSavedChip';
import OnboardingBanner from '../../components/OnboardingBanner';
import FeedbackForm from '../../components/FeedbackForm';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import FinalizedStageView from '../../components/FinalizedStageView';
import ValidatorBadge from '../../components/ValidatorBadge';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import Stage3DraftView from './Stage3DraftView';
import { http } from '../../api/http';
import { useProjectRole } from '../../hooks/useProjectRole';
import type { AIResult, Project, Row, ValidationReport } from '../../types/api';

type Block = 'positioning' | 'messages' | 'critique' | 'borderline';
const BLOCKS: Block[] = ['positioning', 'messages', 'critique', 'borderline'];

// canvasExpectation — что появится в канвасе после генерации. Рендерится в
// EmptyCanvasPlaceholder, снимает страх «а что вообще будет».
// messagePlaceholder / messageExample — только для critique/borderline, где маркетолог
// вручную вводит месседж. Пример — нейтральный, не привязан к стоматологии.
const LABELS: Record<Block, {
  short: string;
  title: string;
  hint: string;
  cta: string;
  icon: typeof Target;
  canvasExpectation: string;
  messagePlaceholder?: string;
  messageExample?: string;
}> = {
  positioning: {
    short: 'Позиционирование',
    title: 'Позиционирование',
    hint: 'Claude подберёт архетип (из 6 канона ЧиП) и сформулирует позиционирование. Входы — утверждённый портрет клиента со Стадии 1 и ценности/миссия/легенда со Стадии 2 — подтянутся автоматически.',
    cta: 'Сгенерировать позиционирование',
    icon: Target,
    canvasExpectation:
      'Выбранный архетип бренда из 6 канонических (+ обоснование), формула позиционирования «для кого → против чего → благодаря чему», и 2-3 альтернативы для выбора.',
  },
  messages: {
    short: 'Месседжи',
    title: '3 варианта месседжа',
    hint: 'Месседж = квинтэссенция бренда в 4-7 словах. Без денег, без клише, должен работать на всех 3 ЦА одновременно.',
    cta: 'Сгенерировать 3 месседжа',
    icon: Sparkles,
    canvasExpectation:
      '3 варианта месседжа в разных регистрах (рациональный / эмоциональный / провокационный). Каждый — 4-7 слов, прошёл через валидатор: запрещённые слова → смысл → канон.',
  },
  critique: {
    short: 'Критика',
    title: 'Критик в 3 ролях',
    hint: 'Вставьте выбранный вами месседж. Claude пройдётся 3 голосами (архитектор бренда / продакт-менеджер / отраслевой эксперт) и укажет 3 проблемы каждым.',
    cta: 'Запустить критиков',
    icon: Swords,
    canvasExpectation:
      '3 голоса критиков, каждый даёт 3 замечания — итого 9 проблем. Плюс общий вердикт: принимать, дорабатывать или выбрасывать.',
    messagePlaceholder: 'Например: Одежда, которая переживёт ваш развод',
    messageExample: 'Одежда, которая переживёт ваш развод',
  },
  borderline: {
    short: 'Финальная проверка',
    title: 'Финальная проверка формулировки',
    hint: 'Если месседж на границе (ровно 4 или 7 слов, близок к запрещённому маркеру) — отдельный проверяющий выносит вердикт: зелёный / жёлтый / красный.',
    cta: 'Провести финальную проверку',
    icon: ShieldCheck,
    canvasExpectation:
      'Светофор зелёный / жёлтый / красный + объяснение вердикта. Если жёлтый — список того, что надо переформулировать. Если красный — список запрещённых маркеров в тексте.',
    messagePlaceholder: 'Например: Работаем для тех, кто устал',
    messageExample: 'Работаем для тех, кто устал',
  },
};

interface BlockState {
  messageText: string;      // для critique/borderline
  result: AIResult | null;
  validation: ValidationReport | null;
  elapsed: number;
  accepted: boolean;
}

const INITIAL_STATE: BlockState = {
  messageText: '',
  result: null,
  validation: null,
  elapsed: 0,
  accepted: false,
};

// ————————————————————————————————————————————————————————————————
// Auto-inputs: собираем входы для Stage 3 из финализированных rows
// Стадий 1-2. Маркетолог не вставляет JSON вручную — платформа
// подтягивает готовые артефакты. Source of truth — row.finalized
// (marketer finalize), fallback — payload.draft (последняя генерация).
// ————————————————————————————————————————————————————————————————

interface AutoInputs {
  voice_of_customer?: unknown;
  legend?: unknown;
  values?: unknown;
  mission?: unknown;
}

interface InputsReadiness {
  voice_of_customer: boolean;
  legend: boolean;
  values: boolean;
  mission: boolean;
}

function latestRowPayload(rows: Row[], sheet: number, type: string): unknown {
  const filtered = rows
    .filter((r) => r.sheet === sheet && r.type === type)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!filtered.length) return undefined;
  const r = filtered[0];
  // Приоритет: финализированный (маркетолог утвердил) → сырой payload.
  if (r.finalized && Object.keys(r.finalized).length > 0) return r.finalized;
  // Stage1 interview-row хранит patterns в payload.patterns.
  const p = r.payload as any;
  if (p?.patterns) return p.patterns;
  // Stage2 legend/value/mission хранит текст черновика в payload.draft / payload.variants.
  if (p?.draft) return p.draft;
  if (p?.variants) return p.variants;
  return r.payload;
}

function computeAutoInputs(rows: Row[]): { inputs: AutoInputs; ready: InputsReadiness } {
  const voice_of_customer = latestRowPayload(rows, 1, 'interview');
  const legend = latestRowPayload(rows, 4, 'legend_fact');
  const values = latestRowPayload(rows, 4, 'value');
  const mission = latestRowPayload(rows, 4, 'mission_variant');

  const isReady = (v: unknown) =>
    v !== undefined && v !== null &&
    (typeof v === 'string' ? v.trim().length > 0 : true);

  return {
    inputs: { voice_of_customer, legend, values, mission },
    ready: {
      voice_of_customer: isReady(voice_of_customer),
      legend: isReady(legend),
      values: isReady(values),
      mission: isReady(mission),
    },
  };
}

export default function Stage3Page() {
  const { id } = useParams<{ id: string }>();
  const { isOwnerViewer } = useProjectRole(id);
  const [projectMeta, setProjectMeta] = useState<Project | null>(null);
  useEffect(() => {
    if (!id) return;
    http.get<Project>(`/projects/${id}`).then((res) => setProjectMeta(res.data)).catch(() => {});
  }, [id]);
  const isFinalized = projectMeta?.status === 'finalized' || projectMeta?.status === 'archived';
  const [active, setActive] = useState<Block>('positioning');
  const [blocks, setBlocks] = useState<Record<Block, BlockState>>({
    positioning: { ...INITIAL_STATE },
    messages: { ...INITIAL_STATE },
    critique: { ...INITIAL_STATE },
    borderline: { ...INITIAL_STATE },
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Таймстемп сабмита стадии на одобрение — см. комментарий в Stage2Page.
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  const current = blocks[active];

  // Подтягиваем утверждённые/последние row'ы Стадий 1-2 при загрузке страницы.
  // Это избавляет маркетолога от ручного копирования JSON входов.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await http.get<Row[]>(`/wizard/projects/${id}/rows`);
        if (!cancelled) setRows(res.data);
      } catch {
        // Тихо: если rows не загрузились — покажем предупреждение в readiness-панели.
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { inputs: autoInputs, ready: inputsReady } = useMemo(
    () => computeAutoInputs(rows),
    [rows],
  );
  const allInputsReady =
    inputsReady.voice_of_customer &&
    inputsReady.legend &&
    inputsReady.values &&
    inputsReady.mission;

  const updateBlock = (block: Block, patch: Partial<BlockState>) => {
    setBlocks((prev) => ({ ...prev, [block]: { ...prev[block], ...patch } }));
  };

  const run = async () => {
    if (!id) return;
    setLoading(true); setError('');
    const t0 = Date.now();
    try {
      let res;
      if (active === 'positioning' || active === 'messages') {
        if (!allInputsReady) {
          setError('Закройте Стадию 2 полностью — нужны легенда, ценности, миссия и голос клиента. Без них Claude не сможет собрать позиционирование.');
          setLoading(false);
          return;
        }
        const endpoint = active === 'positioning'
          ? '/wizard/stage-3/positioning-draft'
          : '/wizard/stage-3/message-variants';
        res = await http.post<AIResult>(endpoint, { projectId: id, inputs: autoInputs });
      } else if (active === 'critique') {
        if (current.messageText.trim().length < 4) {
          setError('Месседж не может быть короче 4 слов');
          setLoading(false);
          return;
        }
        res = await http.post<AIResult>('/wizard/stage-3/critique', { projectId: id, text: current.messageText });
      } else {
        if (current.messageText.trim().length < 4) {
          setError('Месседж не может быть короче 4 слов');
          setLoading(false);
          return;
        }
        res = await http.post<AIResult>('/wizard/stage-3/borderline', { projectId: id, text: current.messageText });
      }

      const validation = (res.data.json?.validation as ValidationReport | undefined) ?? null;
      updateBlock(active, {
        result: res.data,
        validation,
        elapsed: (Date.now() - t0) / 1000,
        accepted: false,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Claude не справился');
    } finally {
      setLoading(false);
    }
  };

  // Accept = авто-переход на следующий неутверждённый блок (паттерн из Stage2Page).
  // Раньше было: «жми Accept → остаёшься на той же вкладке → листаешь вручную на
  // следующую». Новое: один клик закрывает вкладку и открывает следующую неутверждённую.
  // Если все остальные уже утверждены — остаёмся на текущей, StickySubmitBar
  // активирует кнопку «На одобрение собственника».
  const accept = () => {
    const nextIdx = BLOCKS.indexOf(active);
    let nextBlock: Block | null = null;
    for (let step = 1; step <= BLOCKS.length; step++) {
      const cand = BLOCKS[(nextIdx + step) % BLOCKS.length];
      if (cand === active) continue;
      if (!blocks[cand].accepted) { nextBlock = cand; break; }
    }
    updateBlock(active, { accepted: true });
    if (nextBlock) {
      setActive(nextBlock);
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };
  const reopen = () => updateBlock(active, { accepted: false });

  // Regenerate из FeedbackForm: требует payload с 3 полями (rejected/reason/reformulate)
  // и после сабмита сразу триггерит `run()` — единственный способ маркетолога
  // запустить пере-генерацию с правками (старая inline-кнопка «Пересгенерировать»
  // удалена вместе с дубль-кнопкой Accept в CanvasCard).
  const submitFeedbackAndRegen = async (payload: { rejected: string; reason: string; reformulate: string }) => {
    await submitFeedback(payload);
    await run();
  };

  const submitFeedback = async (payload: { rejected: string; reason: string; reformulate: string }) => {
    if (!id) return;
    await http.post('/wizard/feedback', {
      projectId: id,
      artifact: active === 'positioning' ? 'stage_3.positioning' : 'stage_3.message',
      verdict: 'revise',
      rejectedText: payload.rejected,
      reasonText: payload.reason,
      reformulationHint: payload.reformulate,
    });
  };

  const submitForApproval = async () => {
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await http.post(`/projects/${id}/approvals/request`, { projectId: id, stage: 3 });
      // Зафиксировали сабмит в состоянии — Sticky-бар сменится на зелёный
      // баннер «отправлено, ждём». Паттерн и контекст — как в Stage2Page.
      setSubmittedAt(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось отправить на одобрение');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptedCount = useMemo(
    () => BLOCKS.filter((b) => blocks[b].accepted).length,
    [blocks],
  );
  const allAccepted = acceptedCount === BLOCKS.length;

  const hints: SufflerHint[] = [
    { id: '1', title: '4-7 слов — закон', body: 'Месседж 3 или 8 слов — автоматически красный. Валидатор не пропустит.', severity: 'danger' },
    {
      id: '2',
      title: 'Архетип из канона ЧиП',
      body:
        'Только 6 архетипов: Заботливый, Мудрец, Бунтарь, Искатель, Правитель, Простодушный. ' +
        'Никаких «суррогатов» типа «Герой + Заботливый». Если мотив клиента не ложится ни на один — ' +
        'выбирайте ближайший, Claude отметит натяжку в warnings.',
    },
    { id: '3', title: 'Универсальность', body: 'Месседж должен работать для всех 3 сегментов ЦА из Стадии 1. Если только для одного — красный.' },
    { id: '4', title: 'Без денег', body: 'Слова «доход», «прибыль», «выручка», «рост», «деньги» — маркер срыва. Сразу красный.', severity: 'warning' },
  ];

  const needsAutoInputs = active === 'positioning' || active === 'messages';
  const needsMessage = active === 'critique' || active === 'borderline';
  const IconCurrent = LABELS[active].icon;
  const runDisabled =
    loading ||
    (needsAutoInputs && (rowsLoading || !allInputsReady)) ||
    (needsMessage && current.messageText.trim().length < 4);

  // Архивный режим для finalized/archived проектов.
  if (isFinalized && id) {
    return (
      <WizardShell
        stage={3}
        title="Архетип и позиционирование — архив"
        subtitle="Выбранный архетип и утверждённое позиционирование бренда."
      >
        <FinalizedStageView projectId={id} stage={3} />
      </WizardShell>
    );
  }

  // owner_viewer: Stage 3 целиком — writer-зона (positioning/messages/critique/borderline
  // все дергают POST /wizard/stage-3/* и валидатор). Показываем read-only экран.
  if (isOwnerViewer) {
    return (
      <WizardShell
        stage={3}
        title="Архетип, позиционирование, месседж"
        subtitle="На этой стадии маркетолог вместе с Claude выбирает архетип, строит позиционирование и отбирает месседж. Вам останется главный шаг — утвердить формулировку, под которой будет жить бренд."
      >
        <ReadOnlyBanner>
          Стадия 3 — самая «инструментальная»: Claude проходит критиками и валидатором,
          маркетолог итерирует формулировки. Готовый месседж придёт к вам на странице{' '}
          <Link to={`/projects/${id}/approvals`} className="underline font-medium">
            Утверждения
          </Link>{' '}
          — там и будет решающее слово.
        </ReadOnlyBanner>
        <Card className="mt-6">
          <Card.Body>
            <EmptyState
              icon={FileText}
              title="Месседж ещё не собран"
              description="Маркетолог дорабатывает формулировку. Как только все 3 валидатора дадут зелёный — увидите финал на утверждении."
              action={
                <Link
                  to={`/projects/${id}/approvals`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors"
                >
                  К утверждениям
                  <ArrowRight className="w-4 h-4" />
                </Link>
              }
            />
          </Card.Body>
        </Card>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      stage={3}
      title="Архетип, позиционирование, месседж"
      subtitle="Ядро бренда. Claude предложит архетип из 6 канонических, позиционирование по формуле и 3 варианта месседжа. Утверждайте только после зелёного светофора валидатора."
    >
      <OnboardingBanner
        storageKey="bp.onboarding.stage-3"
        title="Критикуйте Claude"
        body="Не спешите утверждать первый вариант. Запустите 3 критиков (архитектор бренда / продакт-менеджер / отраслевой эксперт), прочитайте замечания, пере-сформулируйте. Промышленная бренд-книга — это 3-5 итераций, не одна."
      />

      <div className="mt-6">
        <Tabs value={active} onValueChange={(v) => { setActive(v as Block); setError(''); }}>
          <Tabs.List>
            {BLOCKS.map((b) => (
              <Tabs.Tab key={b} value={b}>
                <span className="inline-flex items-center gap-2">
                  {blocks[b].accepted && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" aria-hidden />
                  )}
                  {LABELS[b].short}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_320px] gap-6 mt-6 pb-24">
        {/* Input (left 40%) */}
        <div>
          <Card>
            <Card.Header>
              <div className="flex items-start gap-2">
                <IconCurrent className="w-4 h-4 text-[#4F46E5] mt-0.5" aria-hidden />
                <div>
                  <Card.Title>{LABELS[active].title}</Card.Title>
                  <Card.Description>{LABELS[active].hint}</Card.Description>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {needsAutoInputs ? (
                <InputsReadinessPanel
                  ready={inputsReady}
                  loading={rowsLoading}
                  projectId={id}
                />
              ) : null}
              {needsMessage ? (
                <Input
                  value={current.messageText}
                  onChange={(e) => updateBlock(active, { messageText: e.target.value, accepted: false })}
                  placeholder={LABELS[active].messagePlaceholder ?? 'Ваш месседж'}
                  label="Месседж бренда"
                  hint="4-7 слов. Без денег, без клише. Должен работать на все 3 ЦА."
                  sizeField="lg"
                />
              ) : null}

              <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
                {/* Кнопка-пример для critique/borderline. Для positioning/messages не нужна —
                    там InputsReadinessPanel подтягивает входы автоматически. */}
                {needsMessage && LABELS[active].messageExample ? (
                  <button
                    type="button"
                    onClick={() => {
                      const current = blocks[active].messageText.trim();
                      if (current.length > 0) {
                        const ok = window.confirm('Заменить введённый месседж примером?');
                        if (!ok) return;
                      }
                      updateBlock(active, {
                        messageText: LABELS[active].messageExample as string,
                        accepted: false,
                      });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F46E5]
                      hover:text-[#3730A3] transition-colors rounded-md px-2 py-1 -my-1 -mx-1
                      hover:bg-[#EEF2FF]"
                  >
                    <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                    Показать пример
                  </button>
                ) : <span />}
                <Button
                  variant="primary"
                  size="md"
                  iconLeft={Sparkles}
                  loading={loading}
                  onClick={run}
                  disabled={runDisabled}
                >
                  {loading ? 'Claude работает…' : LABELS[active].cta}
                </Button>
              </div>
            </Card.Body>
          </Card>

          {error && (
            <div
              role="alert"
              className="mt-4 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#B91C1C] flex gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* AI Canvas (right 60%) */}
        <div className="space-y-5">
          {current.validation && <ValidatorBadge report={current.validation} />}

          {current.result ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <TimeSavedChip generationSeconds={current.elapsed} manualMinutesEquivalent={120} />
                {current.result.status !== 'ok' && (
                  <Badge variant="soft" color="warning">
                    Сработал запасной план{current.result.reason ? ` — ${current.result.reason}` : ''}
                  </Badge>
                )}
              </div>

              <CanvasCard
                accepted={current.accepted}
                title={`Результат — ${LABELS[active].short}`}
              >
                <Stage3DraftView
                  block={active}
                  data={current.result.json ?? current.result.text}
                />
              </CanvasCard>

              {/* FeedbackForm теперь единственная точка «Принять / Пере-генерировать» —
                  paттерн унифицирован со Stage 2 (см. её заметку в CLAUDE.md).
                  Accept заблокирован если валидатор даёт красный светофор: методология
                  не пропускает утверждение при срабатывании стоп-слов.
                  NB: проп `acceptLabel`/`reopenLabel` не переопределяем — дефолты
                  FeedbackForm покрывают все 4 блока Stage 3. */}
              <FeedbackForm
                draftId={current.result.promptRunId}
                rowId={current.result.promptRunId}
                onSubmit={submitFeedbackAndRegen}
                onAccept={current.validation?.trafficLight === 'red' ? undefined : accept}
                accepted={current.accepted}
                onReopen={reopen}
              />
            </>
          ) : (
            <EmptyCanvasPlaceholder expectation={LABELS[active].canvasExpectation} />
          )}
        </div>

        <aside className="hidden xl:block">
          <SufflerPanel hints={hints} />
        </aside>
      </div>

      {submittedAt ? (
        <StickySubmittedBar submittedAt={submittedAt} projectId={id ?? ''} stage={3} />
      ) : (
        <StickySubmitBar
          blocks={BLOCKS.map((b) => ({ label: LABELS[b].short, accepted: blocks[b].accepted }))}
          allAccepted={allAccepted}
          submitting={submitting}
          onSubmit={submitForApproval}
        />
      )}
    </WizardShell>
  );
}

// ———————————————————————————————————————————————————————————————
// Shared sub-components (копии из Stage2 — оставляем inline для явности)
// ———————————————————————————————————————————————————————————————

function CanvasCard({
  accepted,
  title,
  children,
}: {
  accepted: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'relative bg-white rounded-[20px] border overflow-hidden',
        accepted
          ? 'border-[#86EFAC]'
          : 'border-[#E7E5E4] shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {!accepted && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4F46E5]" aria-hidden />
      )}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="uppercase-mono text-[#78716C]">{title}</p>
        {accepted ? (
          <Badge variant="soft" color="success" icon={CheckCircle2}>
            Утверждено маркетологом
          </Badge>
        ) : (
          <Badge variant="soft" color="primary" icon={Sparkles}>
            AI-черновик
          </Badge>
        )}
      </div>
      <div className="px-6 pb-5">{children}</div>
    </div>
  );
}

// EmptyCanvasPlaceholder говорит заранее, ЧТО появится после генерации — разное per-block.
// Маркетолог не ждёт вслепую, энергия входа ниже.
function EmptyCanvasPlaceholder({ expectation }: { expectation: string }) {
  return (
    <div className="h-full min-h-[280px] border-2 border-dashed border-[#E7E5E4]
      rounded-[20px] flex flex-col items-center justify-center text-center p-8 bg-[#FAFAF9]">
      <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-3">
        <Sparkles className="w-5 h-5 text-[#4F46E5]" aria-hidden />
      </div>
      <p className="text-sm font-medium text-[#44403C]">Что Claude вернёт в канвас</p>
      <p className="text-xs text-[#78716C] mt-2 max-w-md leading-relaxed">
        {expectation}
      </p>
      <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#A8A29E] mt-4">
        нажмите «Сгенерировать» ниже
      </p>
    </div>
  );
}

function StickySubmitBar({
  blocks,
  allAccepted,
  submitting,
  onSubmit,
}: {
  blocks: { label: string; accepted: boolean }[];
  allAccepted: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const acceptedCount = blocks.filter((b) => b.accepted).length;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md
        border-t border-[#E7E5E4] py-3 px-6"
      style={{ paddingLeft: 'calc(var(--sidebar-w, 240px) + 24px)' }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {blocks.map((b) => (
            <span
              key={b.label}
              className={[
                'inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap',
                b.accepted ? 'text-[#15803D]' : 'text-[#78716C]',
              ].join(' ')}
            >
              <span
                className={[
                  'w-2 h-2 rounded-full flex-shrink-0',
                  b.accepted ? 'bg-[#22C55E]' : 'bg-[#D6D3D1]',
                ].join(' ')}
                aria-hidden
              />
              {b.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[13px] font-mono tabular-nums text-[#78716C]">
            {acceptedCount}/{blocks.length}
          </span>
          <Button
            variant="primary"
            size="md"
            iconRight={Send}
            onClick={onSubmit}
            loading={submitting}
            disabled={!allAccepted}
          >
            На одобрение собственника
          </Button>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// StickySubmittedBar — «Стадия отправлена собственнику» (после успешного сабмита).
// Копия из Stage2Page с тем же тоном (зелёный = подтверждение без blocker'а).
// ————————————————————————————————————————————————————————————————

function StickySubmittedBar({
  submittedAt,
  projectId,
  stage,
}: {
  submittedAt: Date;
  projectId: string;
  stage: 1 | 2 | 3 | 4;
}) {
  const timeStr = submittedAt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#F0FDF4] backdrop-blur-md
        border-t border-[#86EFAC] py-3 px-6"
      style={{ paddingLeft: 'calc(var(--sidebar-w, 240px) + 24px)' }}
      role="status"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-[#15803D] flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#14532D]">
              Стадия {stage} отправлена собственнику на подпись
            </p>
            <p className="text-xs text-[#166534]">
              {timeStr} · собственник увидит черновики на странице «Утверждения» и поставит подпись.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`/projects/${projectId}/approvals`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D]
              text-white text-sm font-medium hover:bg-[#166534] transition-colors"
          >
            Открыть «Утверждения»
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// Панель готовности входов. Раньше маркетолог копипастил JSON со Стадий 1-2;
// теперь платформа подтягивает артефакты автоматически и показывает, что
// готово ✓, а чего не хватает. Когда чего-то нет — объясняем, что вернуться
// на Стадию 2 и закрыть её.
// ————————————————————————————————————————————————————————————————

function InputsReadinessPanel({
  ready,
  loading,
  projectId,
}: {
  ready: InputsReadiness;
  loading: boolean;
  projectId: string | undefined;
}) {
  const items: Array<{ key: keyof InputsReadiness; label: string; hint: string }> = [
    { key: 'voice_of_customer', label: 'Голос клиента', hint: 'Паттерны интервью со Стадии 1' },
    { key: 'legend', label: 'Легенда', hint: 'История бренда со Стадии 2' },
    { key: 'values', label: 'Ценности', hint: 'Ценности собственника со Стадии 2' },
    { key: 'mission', label: 'Миссия', hint: 'Варианты миссии со Стадии 2' },
  ];

  const allReady = items.every((i) => ready[i.key]);
  const missing = items.filter((i) => !ready[i.key]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#78716C] mb-1">
          Входы для Claude
        </p>
        <p className="text-xs text-[#78716C] leading-relaxed">
          Позиционирование собирается из утверждённых артефактов Стадий 1-2 — подтягиваются автоматически.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-[#A8A29E] italic">Проверяем артефакты…</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const ok = ready[item.key];
            return (
              <li
                key={item.key}
                className="flex items-start gap-2 text-sm"
              >
                {ok ? (
                  <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
                ) : (
                  <Lock className="w-4 h-4 text-[#A8A29E] flex-shrink-0 mt-0.5" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className={ok ? 'text-[#15803D] font-medium' : 'text-[#78716C] font-medium'}>
                    {item.label}
                  </p>
                  <p className="text-[11px] text-[#A8A29E] leading-tight">{item.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !allReady && (
        <div className="mt-3 p-3 rounded-xl bg-[#FEF3C7] border border-[#FCD34D] text-xs text-[#92400E]">
          <p className="font-medium mb-1">Не хватает: {missing.map((m) => m.label).join(', ')}.</p>
          <p className="leading-relaxed">
            Вернитесь на{' '}
            <a
              href={projectId ? `/projects/${projectId}/stage-2` : '#'}
              className="underline font-medium"
            >
              Стадию 2
            </a>{' '}
            и доведите её до конца — без этих артефактов Claude не сможет предложить позиционирование.
          </p>
        </div>
      )}
    </div>
  );
}
