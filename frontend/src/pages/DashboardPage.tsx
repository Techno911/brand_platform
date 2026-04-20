import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderKanban, Sparkles, ArrowRight, Wallet, CheckCircle2,
  PlayCircle, Users,
} from 'lucide-react';
import { http } from '../api/http';
import { useAuthStore } from '../store/auth';
import type { Project, ProjectStatus } from '../types/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';

const STAGE_LABEL: Record<number, string> = {
  1: 'Стадия 1. Портрет клиента',
  2: 'Стадия 2. Сессия с собственником',
  3: 'Стадия 3. Архетип и позиционирование',
  4: 'Стадия 4. Четыре теста месседжа',
};

const STAGE_SHORT: Record<number, string> = {
  1: 'Стадия 1',
  2: 'Стадия 2',
  3: 'Стадия 3',
  4: 'Стадия 4',
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Роли в контексте дашборда:
  // · chip_admin — global, видит всё, но дашборд не его «рабочее место» (его — /admin/*).
  // · tracker — global ops: ведёт все проекты, так же как admin не имеет «своей стадии
  //   в конкретном проекте»; дашборд ему не рабочий, работа — /admin/*.
  // · marketer — ведёт сессии, следит за $-бюджетом AI-токенов, продолжает стадии.
  // · owner_viewer — читает, задаёт вопросы, подписывает. Не видит $ (платит фикс в ₽),
  //   и next-action у него не «продолжить стадию», а «подписать готовое».
  const isAdmin = user?.globalRole === 'chip_admin' || user?.globalRole === 'tracker';
  const hasMarketerRole = !!user?.projectRoles?.some((r) => r.role === 'marketer');
  const isOwnerOnly = !isAdmin && !hasMarketerRole &&
    !!user?.projectRoles?.some((r) => r.role === 'owner_viewer');

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<Project[]>('/projects');
        setProjects(res.data ?? []);
      } catch {
        // network/permissions — показываем пустое состояние
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = useMemo(
    () => projects.filter((p) =>
      p.status !== 'archived' && p.status !== 'finalized' && p.status !== 'abandoned'
    ),
    [projects],
  );
  const finalized = projects.filter((p) => p.status === 'finalized');

  // Next action — самый срочный проект (по ближайшему дедлайну) на текущей стадии.
  const nextAction = useMemo<NextAction | null>(() => {
    if (active.length === 0) return null;
    const withDeadline = active
      .map((p) => ({ p, days: daysLeft(p) }))
      .sort((a, b) => a.days - b.days);
    const top = withDeadline[0].p;
    return {
      projectId: top.id,
      projectName: top.name,
      stage: top.currentStage,
      stageLabel: STAGE_LABEL[top.currentStage] ?? 'Стадия',
      daysLeft: withDeadline[0].days,
    };
  }, [active]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Доброе утро';
    if (h >= 12 && h < 18) return 'Добрый день';
    if (h >= 18 && h < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  }, []);

  const totalBudget = active.reduce((s, p) => s + parseFloat(p.budgetUsd || '0'), 0);
  const totalSpent = active.reduce((s, p) => s + parseFloat(p.spentUsd || '0'), 0);
  const budgetRemaining = totalBudget - totalSpent;
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="space-y-6 fade-in">
      {/* Topbar приветствие */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1A1A]">
            {greeting}{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h2>
          <p className="text-[#78716C] text-sm mt-1">
            {isOwnerOnly
              ? 'Здесь ваши бренды и утверждения. Маркетолог присылает готовые формулировки — вам нужно прочитать и подписать.'
              : isAdmin
              ? 'Все проекты платформы и админские разделы. Слева — ваши шорткаты.'
              : 'Claude готовит черновики, вы ведёте сессию с собственником. Ниже — где вас ждут.'}
          </p>
        </div>
      </div>

      {/* Next-action chip — inbox-first pattern.
          Для chip_admin НЕ показываем: у него нет «стадии в проекте», его работа —
          админка (вход справа в блоке «Администрирование»). Раньше чип-админу
          предлагалось «Продолжи стадию 1 в Белая Линия» — это чужая задача.
          Для owner_viewer — текст другой: собственник не «продолжает стадию», он
          читает и подписывает; чип ведёт сразу на страницу утверждений. */}
      {loading ? (
        <div className="h-20 rounded-2xl bg-[#F5F5F4] animate-pulse" aria-hidden />
      ) : nextAction && !isAdmin ? (
        <NextActionChip action={nextAction} ownerMode={isOwnerOnly} />
      ) : null}

      {/* Stat-карточки «Активных / Завершённых / До дедлайна» нужны admin/tracker —
          они ведут ПОРТФЕЛЬ проектов и считают метрики. Для маркетолога и собственника
          клиента это вредный шум: у них один работодатель и один проект, «1 активный,
          0 завершённых» — тавтология и визуальный долг. Единственный чип сверху
          (NextActionChip) уже несёт точный next step, карточка проекта ниже несёт
          прогресс стадий. Повторять это счётчиками — избыточно. */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            label="Активных проектов"
            value={active.length}
            icon={FolderKanban}
            href="/projects?filter=active"
          />
          <StatCard
            label="Завершённых брендов"
            value={finalized.length}
            icon={CheckCircle2}
            href="/projects?filter=finalized"
          />
        </div>
      )}

      {/* Grid 60/40 — проекты слева, budget+feed справа */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Проекты — 60% = 3/5 */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            {/* Card.Header уже `flex items-center justify-between gap-3` — не оборачиваем лишний раз,
                иначе вложенный flex схлопывается до ширины контента и заголовок со ссылкой слипаются. */}
            <Card.Header>
              <Card.Title>Активные проекты</Card.Title>
              <Link
                to="/projects?filter=active"
                className="flex-shrink-0 text-[#4F46E5] text-sm font-medium hover:text-[#4338CA]
                  flex items-center gap-1 rounded-md px-1 -mx-1"
              >
                Все активные <ArrowRight className="w-4 h-4" />
              </Link>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-[#F5F5F4] animate-pulse" />
                  ))}
                </div>
              ) : active.length === 0 ? (
                <EmptyState
                  icon={FolderKanban}
                  title="Пока нет активных проектов"
                  description={isOwnerOnly
                    ? 'Ваш бренд-проект ещё не стартовал. Мы свяжемся, как только назначим маркетолога и расписание сессий.'
                    : isAdmin
                    ? 'Нажмите «Новый проект» в разделе «Проекты», чтобы создать первый.'
                    : 'Новый проект назначит администратор после вводного звонка с клиентом.'}
                />
              ) : (
                <ul className="space-y-3">
                  {active.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <ProjectListItem project={p} />
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>

          {/* Симметричная карточка завершённых брендов. Рендерим только если
              finalized.length > 0 — пустая «Пока нет завершённых» рядом с
              активными создаёт визуальный шум и ничему не учит. Когда
              завершённые есть, без этого блока админ видит счётчик «1» в
              StatCard, но не может добраться до самого проекта без клика
              через /projects+фильтр. Это и был UX-жалоба Чиркова. */}
          {!loading && finalized.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Завершённые бренды</Card.Title>
                <Link
                  to="/projects?filter=finalized"
                  className="flex-shrink-0 text-[#4F46E5] text-sm font-medium hover:text-[#4338CA]
                    flex items-center gap-1 rounded-md px-1 -mx-1"
                >
                  Все завершённые <ArrowRight className="w-4 h-4" />
                </Link>
              </Card.Header>
              <Card.Body>
                <ul className="space-y-3">
                  {finalized.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <ProjectListItem project={p} />
                    </li>
                  ))}
                </ul>
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Right column — 40% = 2/5 */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI-бюджет токенов — это внутренняя cost-of-goods ЧиП (оплата API
              Anthropic/OpenAI), а НЕ счёт клиента. Ни маркетолог, ни собственник
              за токены не платят — они платят фиксированную абонентку в рублях.
              Значит карточка показывается ТОЛЬКО admin/tracker; всем остальным
              она создавала ложное чувство ограничения и непонятные термины
              («сырьевая стоимость» — совсем не про бренд-платформу). */}
          {active.length > 0 && isAdmin && (
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#4F46E5]" />
                  <Card.Title>AI-бюджет токенов</Card.Title>
                </div>
              </Card.Header>
              <Card.Body>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[#78716C] text-xs">Потрачено</span>
                      <span className="font-mono text-sm tabular-nums text-[#1A1A1A]">
                        ${totalSpent.toFixed(2)} / ${totalBudget.toFixed(2)}
                      </span>
                    </div>
                    <ProgressBar
                      value={budgetPct}
                      color={budgetPct > 85 ? 'warning' : 'primary'}
                      ariaLabel="Использовано бюджета"
                    />
                  </div>
                  <p className="text-[#78716C] text-xs leading-relaxed">
                    Остаток{' '}
                    <span className="font-mono tabular-nums text-[#1A1A1A]">
                      ${budgetRemaining.toFixed(2)}
                    </span>{' '}
                    — API-оплата Anthropic/OpenAI по активным проектам (ваша себестоимость).
                  </p>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Гид — «что делать на платформе». Текст меняется по роли. */}
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                <Card.Title>Как устроена работа</Card.Title>
              </div>
            </Card.Header>
            <Card.Body>
              <ol className="space-y-2.5">
                {(isOwnerOnly
                  ? [
                      'Маркетолог проводит с вами сессии и готовит черновики бренд-платформы.',
                      'Вы читаете, обсуждаете, возвращаете на доработку — или подписываете.',
                      'После подписи формулировка становится финальной — отменить нельзя.',
                    ]
                  : [
                      'Claude готовит черновик — вы проверяете и редактируете вместе с собственником.',
                      'Если сомневаетесь — не жмите «Принять». Справа есть суфлёр с подсказками.',
                      'Финальный документ подписывает только собственник бизнеса.',
                    ]
                ).map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="font-mono text-[10px] text-[#4F46E5] mt-0.5 tabular-nums
                        w-5 h-5 rounded-full bg-[#EEF2FF] inline-flex items-center
                        justify-center flex-shrink-0"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[#44403C] text-xs leading-relaxed flex-1">{t}</p>
                  </li>
                ))}
              </ol>
            </Card.Body>
          </Card>

          {/* Admin shortcut — chip_admin и tracker. Tracker не видит биллинг, но все
              остальные observability-разделы ему доступны, шорткат ведёт в общий вход. */}
          {isAdmin && (
            <Card variant="elevated">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4F46E5]" />
                  <Card.Title>Администрирование</Card.Title>
                </div>
              </Card.Header>
              <Card.Body>
                <p className="text-[#78716C] text-xs leading-relaxed mb-3">
                  Сбои AI-вызовов, качество маркетологов, эталоны, безопасность.
                </p>
                <Link to="/admin/silent-failures">
                  <Button variant="secondary" size="sm" iconRight={ArrowRight} fullWidth>
                    Открыть админку
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Sub-components
// ———————————————————————————————————————————————————————————————

interface NextAction {
  projectId: string;
  projectName: string;
  stage: number;
  stageLabel: string;
  daysLeft: number;
}

// NextActionChip — primary action, всегда prominent (Linear-pattern, research §1.4).
// Ранее был conditional urgent/non-urgent → в non-urgent серый border прятал CTA.
// В premium SaaS primary action не «теряется», независимо от контекста.
// ownerMode: для собственника формулировка «Открыть на утверждение», ссылка на approvals.
function NextActionChip({ action, ownerMode }: { action: NextAction; ownerMode: boolean }) {
  const urgent = action.daysLeft <= 2;
  const href = ownerMode
    ? `/projects/${action.projectId}/approvals`
    : `/projects/${action.projectId}/stage-${action.stage}`;
  const headline = ownerMode
    ? `Открыть проект «${action.projectName}» на утверждение`
    : `Продолжить стадию ${action.stage} в проекте «${action.projectName}»`;
  const label = ownerMode ? 'Требуется ваша подпись' : 'Ваше следующее действие';
  return (
    <Link to={href} className="block">
      <div
        className="group relative rounded-2xl border-2 border-[#4F46E5] bg-[#EEF2FF] p-5
          hover:bg-[#E0E7FF] transition-[background-color] duration-200 ease-out"
      >
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center flex-shrink-0"
            aria-hidden
          >
            {ownerMode ? <CheckCircle2 className="w-6 h-6" /> : <PlayCircle className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="uppercase-mono mb-0.5">{label}</p>
            <p className="font-semibold text-[#1A1A1A] truncate">{headline}</p>
            <p className="text-[#78716C] text-xs mt-0.5">
              {urgent
                ? `Осталось ${action.daysLeft} ${plural(action.daysLeft, ['день', 'дня', 'дней'])} до дедлайна${ownerMode ? ' — посмотрите сегодня.' : ' — начните сейчас.'}`
                : `До дедлайна ${action.daysLeft} ${plural(action.daysLeft, ['день', 'дня', 'дней'])}.`
              }
            </p>
          </div>
          <ArrowRight
            className="w-5 h-5 flex-shrink-0 text-[#4F46E5] transition-transform duration-200
              group-hover:translate-x-1"
          />
        </div>
      </div>
    </Link>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  /** Если задан — карточка кликабельна и ведёт на указанный URL. */
  href?: string;
}) {
  const body = (
    <Card.Body className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#4F46E5] flex-shrink-0" />
        <span className="uppercase-mono truncate min-w-0">{label}</span>
      </div>
      <p
        className="text-[32px] font-semibold leading-[1.1] text-[#1A1A1A] tabular-nums"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
    </Card.Body>
  );
  if (href) {
    return (
      <Link
        to={href}
        className="block rounded-2xl focus:outline-none focus-visible:ring-2
          focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
      >
        <Card variant="interactive">{body}</Card>
      </Link>
    );
  }
  return <Card>{body}</Card>;
}

function ProjectListItem({ project }: { project: Project }) {
  const stageProgress = (project.currentStage / 4) * 100;
  return (
    <Link
      to={`/projects/${project.id}`}
      className="block group rounded-xl border border-[#E7E5E4] p-4
        hover:border-[#A5B4FC] hover:bg-[#FAFAF9]
        transition-[border-color,background-color] duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#1A1A1A] truncate">{project.name}</p>
          <p className="text-[#78716C] text-xs mt-0.5 truncate">
            {project.client?.name ?? '—'} · тариф {project.tariff}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="flex items-center gap-3 mt-3">
        <span className="text-[10px] font-mono text-[#78716C] tabular-nums flex-shrink-0">
          {STAGE_SHORT[project.currentStage] ?? 'Финал'}
        </span>
        <ProgressBar
          value={stageProgress}
          color="primary"
          height={4}
          ariaLabel={`Прогресс: ${STAGE_SHORT[project.currentStage]}`}
        />
        <span className="text-[10px] font-mono text-[#78716C] tabular-nums flex-shrink-0">
          {project.currentStage}/4
        </span>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const map: Record<ProjectStatus, {
    variant: 'solid' | 'outline' | 'soft';
    color: 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    label: string;
  }> = {
    draft: { variant: 'soft', color: 'neutral', label: 'Черновик' },
    stage_1: { variant: 'soft', color: 'primary', label: 'Стадия 1' },
    stage_2: { variant: 'soft', color: 'primary', label: 'Стадия 2' },
    stage_3: { variant: 'soft', color: 'primary', label: 'Стадия 3' },
    stage_4: { variant: 'soft', color: 'primary', label: 'Стадия 4' },
    finalized: { variant: 'soft', color: 'success', label: 'Финал' },
    archived: { variant: 'soft', color: 'neutral', label: 'В архиве' },
    abandoned: { variant: 'soft', color: 'danger', label: 'Остановлен' },
  };
  const s = map[status] ?? map.draft;
  return <Badge variant={s.variant} color={s.color}>{s.label}</Badge>;
}

// ———————————————————————————————————————————————————————————————
// Helpers
// ———————————————————————————————————————————————————————————————

function daysLeft(p: Project): number {
  const now = Date.now();
  const start = p.startedAt ? new Date(p.startedAt).getTime() : new Date(p.createdAt).getTime();
  const deadline = start + 14 * 24 * 3600 * 1000;
  return Math.max(0, Math.ceil((deadline - now) / (24 * 3600 * 1000)));
}

// Русский плюрализатор для дней.
function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
