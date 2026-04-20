import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RotateCcw, CheckCircle2, Wallet, ExternalLink, FolderOpen } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import AdminPageIntro from '../../components/AdminPageIntro';

// Backend GET /observability/silent-failures возвращает PromptRun[] (см. ObservabilityController).
// prompt_run — Горшков-паттерн: все AI-вызовы в одном месте, retry/latency/error-code inline.
interface PromptRunRow {
  id: string;
  projectId: string | null;
  kind: string;
  model: string;
  status:
    | 'planned'
    | 'executing'
    | 'completed'
    | 'failed'
    | 'budget_exceeded'
    | 'rate_limited'
    | 'sanitized_out';
  errorCode: string | null;
  retryCount: number;
  providerLatencyMs: number;
  createdAt: string;
}

type View = 'all' | 'by-command' | 'by-error';

// Визуальный статус — три категории из дизайн-системы (ui_kits/brand-platform/Admin.jsx):
//   timeout (soft-danger) · retry (soft-warning) · blocked (soft-neutral).
// Маппим prompt_run.status + retryCount в эти три, чтобы UI читался с первого взгляда.
type VisualStatus = 'timeout' | 'retry' | 'blocked';
function visualStatus(run: PromptRunRow): VisualStatus {
  if (run.status === 'sanitized_out') return 'blocked';
  if (run.status === 'completed' && run.retryCount >= 1) return 'retry';
  return 'timeout';
}

// Маппинг «машинный код → что это значит по-человечески + что с этим делать».
// Раньше админ видел голые строки `CONTENT_FILTER`, `RATE_LIMITED`, `BUDGET_EXCEEDED`
// и не понимал, куда идти. Здесь — человеческое имя, объяснение причины, действие.
// Ключи должны совпадать с error_code/status из backend (prompt_run.entity.ts).
interface ErrorAction {
  humanName: string;
  whatToDo: string;
  cta?: 'open-project' | 'go-billing';
}
const ERROR_ACTIONS: Record<string, ErrorAction> = {
  CONTENT_FILTER: {
    humanName: 'Сработал контент-фильтр вендора',
    whatToDo:
      'В промпт попали данные, которые Anthropic/OpenAI считают небезопасными — PII клиента, агрессивный язык или попытка джейлбрейка. BriefSanitizer должен был поймать на входе — если не поймал, правьте его regex или ищите, откуда прилетела строка.',
    cta: 'open-project',
  },
  BUDGET_EXCEEDED: {
    humanName: 'Бюджет проекта исчерпан',
    whatToDo:
      'Проект потратил весь выделенный лимит сырьевой стоимости AI-вызовов. Увеличьте budgetUsd в настройках проекта или закройте его — новые вызовы не пойдут, пока бюджет на нуле.',
    cta: 'go-billing',
  },
  RATE_LIMITED: {
    humanName: 'Вендор throttle (429)',
    whatToDo:
      'Anthropic/OpenAI вернули 429 — превышен лимит RPM на нашем аккаунте. Очередь GlobalLLMQueue сама подождёт и повторит. Если валится подряд несколько часов — повысьте tier в консоли вендора или переключите стадию на fallback.',
    cta: 'open-project',
  },
  VENDOR_AUTH_FAILED: {
    humanName: 'API-ключ отклонён (401)',
    whatToDo:
      'Вендор вернул 401 — ключ протух, ротирован или превысил биллинговый лимит в консоли. Проверьте ANTHROPIC_API_KEY / OPENAI_API_KEY в .env сервера и статус счёта в console.anthropic.com.',
  },
  UPSTREAM_TIMEOUT: {
    humanName: 'Вендор не ответил за 60 секунд',
    whatToDo:
      'Перегрузка вендора или сетевой сбой. Платформа делает 3 retry с экспоненциальной задержкой — если упали все три, проверьте status.anthropic.com / status.openai.com и переключите primary-провайдер в vendor-router.',
    cta: 'open-project',
  },
};
// Fallback'и по статусу, когда errorCode нет.
const STATUS_ACTIONS: Record<string, ErrorAction> = {
  sanitized_out: {
    humanName: 'Заблокирован BriefSanitizer на входе',
    whatToDo:
      'Наш собственный санитайзер нашёл в промпте паттерн из prompt-injection blacklist до того, как вызов ушёл к вендору. Это правильное поведение, но если ложное срабатывание — скорректируйте регулярки в BriefSanitizerService.',
  },
  budget_exceeded: {
    humanName: 'Бюджет проекта исчерпан',
    whatToDo:
      'Проект потратил весь budgetUsd. Увеличьте лимит или закройте проект — новые AI-вызовы будут отклонены.',
    cta: 'go-billing',
  },
  rate_limited: {
    humanName: 'Вендор throttle (429)',
    whatToDo:
      'Превышен лимит вендора. Ждите минуту и повторяйте или переключите стадию на fallback-провайдер.',
    cta: 'open-project',
  },
  failed: {
    humanName: 'Упал без конкретного кода',
    whatToDo:
      'Вендор вернул ошибку без распознанного кода — смотрите raw-ответ в prompt_run.meta (открыть проект, там полный лог).',
    cta: 'open-project',
  },
};

function lookupAction(run: PromptRunRow): ErrorAction {
  if (run.errorCode && ERROR_ACTIONS[run.errorCode]) return ERROR_ACTIONS[run.errorCode];
  if (STATUS_ACTIONS[run.status]) return STATUS_ACTIONS[run.status];
  return {
    humanName: 'Неизвестная проблема',
    whatToDo: 'Ни error_code, ни status не распознан. Добавьте маппинг в SilentFailuresPage.tsx → ERROR_ACTIONS.',
    cta: 'open-project',
  };
}

// Silent failures — журнал упавших / проблемных prompt_run.
// Utilities вверху страницы: порог retry, кнопка обновления, счётчик «новых за час / всего».
// Админ смотрит эту страницу утром, Telegram-бот chip_admin присылает дайджест в 9:00 МСК.
export default function SilentFailuresPage() {
  const [rows, setRows] = useState<PromptRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(3);
  const [view, setView] = useState<View>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await http
        .get<PromptRunRow[]>(`/observability/silent-failures?retries=${threshold}`)
        .catch(() => ({ data: [] as PromptRunRow[] }));
      setRows(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Метрика «N новых» — срабатывания за последний час (час = «новое» в контексте
  // утреннего ревью). «Всего» — размер текущей выборки (limit=500 на backend).
  const newCount = useMemo(() => {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return rows.filter((r) => new Date(r.createdAt).getTime() >= hourAgo).length;
  }, [rows]);

  const byCommand = useMemo(() => groupBy(rows, (r) => r.kind), [rows]);
  const byError = useMemo(
    () => groupBy(rows, (r) => r.errorCode ?? r.status),
    [rows],
  );

  return (
    <div className="space-y-5">
      <AdminPageIntro
        icon={AlertTriangle}
        title="Проблемные AI-вызовы"
        whatIs="Журнал вызовов Claude/GPT, которые зависли, упали по таймауту или были заблокированы фильтром безопасности. Обычные успешные вызовы сюда НЕ попадают."
        whyForYou="Каждая строка сразу говорит, что случилось и куда идти: повторить запуск в проекте, поднять бюджет в биллинге или проверить API-ключ в env. Если одна и та же команда валится 5+ раз подряд — это сигнал, что проблема в шаблоне промпта, а не в Claude."
        whenToOpen="Каждое утро в 09:00 — после Telegram-дайджеста. Плюс сразу, если маркетолог пишет в чат «ничего не работает»."
      />

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label
            htmlFor="retry-threshold"
            className="text-xs font-medium text-[#57534E]"
          >
            Показывать сбои с retry от
          </label>
          <input
            id="retry-threshold"
            type="number"
            min={1}
            max={10}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value) || 1)}
            className={[
              'w-20 h-8 px-2 rounded-[10px] text-center',
              'border border-[#E7E5E4] bg-[#F5F5F4]',
              'font-mono text-[13px] text-[#1A1A1A] tabular-nums',
              'transition-[background-color,border-color,box-shadow] duration-200',
              'focus:outline-none focus:bg-white focus:border-[#4F46E5]',
              'focus:shadow-[0_0_0_1px_#4F46E5]',
            ].join(' ')}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          iconLeft={RotateCcw}
          onClick={load}
          loading={loading}
        >
          Обновить
        </Button>
        <div className="ml-auto flex items-center gap-2 text-[12px] text-[#78716C]">
          {newCount > 0 && (
            <Badge variant="soft" color="danger">
              {newCount} {pluralRu(newCount, ['новая', 'новых', 'новых'])} за час
            </Badge>
          )}
          <span className="tabular-nums">
            всего {rows.length} за сутки
          </span>
        </div>
      </div>

      {/* Tabs + panels */}
      <Tabs value={view} onValueChange={(v) => setView(v as View)}>
        <Tabs.List>
          <Tabs.Tab value="all">
            Все сбои
            <span className="font-mono text-[11px] text-[#A8A29E] ml-1.5 tabular-nums">
              {rows.length}
            </span>
          </Tabs.Tab>
          <Tabs.Tab value="by-command">
            По команде Claude
            <span className="font-mono text-[11px] text-[#A8A29E] ml-1.5 tabular-nums">
              {byCommand.length}
            </span>
          </Tabs.Tab>
          <Tabs.Tab value="by-error">
            По типу ошибки
            <span className="font-mono text-[11px] text-[#A8A29E] ml-1.5 tabular-nums">
              {byError.length}
            </span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="all" className="mt-5">
          {loading ? (
            <Card>
              <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="За сутки ни одного сбоя"
                description="Все AI-вызовы прошли без повторов сверх порога. Можно закрыть страницу."
              />
            </Card>
          ) : (
            <RunsTable rows={rows} />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="by-command" className="mt-5">
          {loading ? (
            <Card>
              <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
            </Card>
          ) : byCommand.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="Сбоев по командам нет"
                description="Ни одна из команд (Стадии 1–4) не упала в сбой за сутки."
              />
            </Card>
          ) : (
            <GroupedTable items={byCommand} label="Команда Claude" />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="by-error" className="mt-5">
          {loading ? (
            <Card>
              <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
            </Card>
          ) : byError.length === 0 ? (
            <Card>
              <EmptyState
                icon={CheckCircle2}
                title="Ошибок нет"
                description="Ни одного кода ошибки не зафиксировано за сутки."
              />
            </Card>
          ) : (
            <GroupedTable items={byError} label="Код ошибки" withActions />
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Таблица. Раньше было 7 колонок с голыми английскими кодами ошибок
// (CONTENT_FILTER / RATE_LIMITED / BUDGET_EXCEEDED). Админ не понимал, куда идти.
// Теперь: «Проблема» — человеческое имя + код subscript'ом, «Что делать» —
// объяснение + CTA (Открыть проект / К биллингу). Повторов/длительность
// схлопнуты в «Тех. детали», чтобы освободить горизонт.
// ────────────────────────────────────────────────────────────
function RunsTable({ rows }: { rows: PromptRunRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>ID запуска</Th>
              <Th>Команда</Th>
              <Th>Проблема</Th>
              <Th>Что делать</Th>
              <Th className="text-right">Тех. детали</Th>
              <Th>Когда</Th>
              <Th className="text-right">Действие</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const action = lookupAction(r);
              return (
                <tr
                  key={r.id}
                  className="border-b border-[#E7E5E4] last:border-b-0 hover:bg-[#FAFAF9] transition-colors align-top"
                >
                  <td className="px-3 py-3.5">
                    <span
                      className="font-mono text-[12px] text-[#1A1A1A] bg-[#F5F5F4] px-1.5 py-0.5 rounded-md"
                      title={r.id}
                    >
                      {formatRunId(r.id)}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-[13px] text-[#44403C] whitespace-nowrap">
                    {r.kind}
                  </td>
                  <td className="px-3 py-3.5 min-w-[220px]">
                    <StatusBadge status={visualStatus(r)} />
                    <p className="font-medium text-[13px] text-[#1A1A1A] mt-1.5">
                      {action.humanName}
                    </p>
                    {r.errorCode && (
                      <p
                        className="font-mono text-[11px] text-[#78716C] mt-0.5"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {r.errorCode}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3.5 max-w-md">
                    <p className="text-[12px] text-[#44403C] leading-relaxed">
                      {action.whatToDo}
                    </p>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-[12px] text-right tabular-nums whitespace-nowrap">
                    <div>
                      <span className="text-[#78716C]">×</span>
                      <span className="text-[#1A1A1A]">{r.retryCount}</span>
                      <span className="text-[#78716C]"> попыток</span>
                    </div>
                    <div style={{ color: r.providerLatencyMs > 20000 ? '#B91C1C' : '#78716C' }}>
                      {(r.providerLatencyMs / 1000).toFixed(2)}&nbsp;s
                    </div>
                  </td>
                  <td className="px-3 py-3.5 font-mono text-[12px] text-[#78716C] whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap text-right">
                    <ActionCta action={action} projectId={r.projectId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// CTA для каждой строки — зависит от action.cta:
//   'open-project' → уводит на /projects/:id (марекетолог там перезапустит стадию)
//   'go-billing'   → /admin/billing
//   undefined      → прочерк («действие на вашей стороне, не в UI»).
function ActionCta({ action, projectId }: { action: ErrorAction; projectId: string | null }) {
  if (action.cta === 'open-project' && projectId) {
    return (
      <Link to={`/projects/${projectId}`}>
        <Button variant="secondary" size="sm" iconLeft={FolderOpen}>
          Открыть проект
        </Button>
      </Link>
    );
  }
  if (action.cta === 'go-billing') {
    return (
      <Link to="/admin/billing">
        <Button variant="secondary" size="sm" iconLeft={Wallet}>
          К биллингу
        </Button>
      </Link>
    );
  }
  if (action.cta === 'open-project' && !projectId) {
    // projectId null (например, /golden-set run без проекта) — нечего открывать.
    return <span className="text-[#A8A29E] text-xs">—</span>;
  }
  return <span className="text-[#A8A29E] text-xs">env / код</span>;
}

// Агрегат «по типу ошибки». Вместо голого CONTENT_FILTER показываем
// {humanName + count + whatToDo}. Это и есть рабочий дашборд «где чаще всего болит».
function GroupedTable({
  items,
  label,
  withActions,
}: {
  items: Array<{ key: string; count: number }>;
  label: string;
  /** true для by-error: раскрываем humanName/whatToDo из ERROR_ACTIONS. */
  withActions?: boolean;
}) {
  const max = Math.max(...items.map((i) => i.count));
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <Th>{label}</Th>
              {withActions && <Th>Что с этим делать</Th>}
              <Th className="text-right">Сбоев</Th>
              <Th>Доля</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const action = withActions
                ? ERROR_ACTIONS[item.key] ?? STATUS_ACTIONS[item.key]
                : null;
              return (
                <tr
                  key={item.key}
                  className="border-b border-[#E7E5E4] last:border-b-0 hover:bg-[#FAFAF9] transition-colors align-top"
                >
                  <td className="px-3 py-3.5 min-w-[180px]">
                    {action ? (
                      <>
                        <p className="font-medium text-[13px] text-[#1A1A1A]">
                          {action.humanName}
                        </p>
                        <p
                          className="font-mono text-[11px] text-[#78716C] mt-0.5"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {item.key}
                        </p>
                      </>
                    ) : (
                      <span
                        className="font-mono text-[13px] text-[#1A1A1A]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {item.key}
                      </span>
                    )}
                  </td>
                  {withActions && (
                    <td className="px-3 py-3.5 max-w-md text-[12px] text-[#44403C] leading-relaxed">
                      {action?.whatToDo ?? 'Маппинг не найден — добавьте в ERROR_ACTIONS.'}
                    </td>
                  )}
                  <td className="px-3 py-3.5 font-mono text-[13px] text-right tabular-nums">
                    {item.count}
                  </td>
                  <td className="px-3 py-3.5 w-1/3">
                    <div className="h-1.5 bg-[#F5F5F4] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full transition-[width] duration-300 ease-out"
                        style={{ width: `${(item.count / max) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: VisualStatus }) {
  if (status === 'timeout') {
    return (
      <Badge variant="soft" color="danger">
        Упал по таймауту
      </Badge>
    );
  }
  if (status === 'retry') {
    return (
      <Badge variant="soft" color="warning">
        Повторяли
      </Badge>
    );
  }
  return (
    <Badge variant="soft" color="neutral">
      Заблокирован фильтром
    </Badge>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={[
        'px-3 py-2.5 uppercase-mono text-[#78716C] text-left',
        'border-b border-[#E7E5E4]',
        'whitespace-nowrap',
        className,
      ].join(' ')}
    >
      {children}
    </th>
  );
}

// ────────────────────────────────────────────────────────────
// utils
// ────────────────────────────────────────────────────────────
function groupBy<T>(items: T[], keyFn: (item: T) => string): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

// Короткий ID по паттерну из Admin.jsx: `run_` + 10 hex-символов uuid без дефисов.
function formatRunId(uuid: string): string {
  const hex = uuid.replace(/-/g, '').slice(0, 10);
  return `run_${hex}`;
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
