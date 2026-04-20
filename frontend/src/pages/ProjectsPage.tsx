import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, FolderKanban, Search, Lightbulb } from 'lucide-react';
import { http } from '../api/http';
import type { Project, Industry, ProjectTariff, ProjectStatus } from '../types/api';
import { useAuthStore } from '../store/auth';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';

// Список клиентов для селекта в форме создания. Грузим один раз при открытии
// модалки — 10-30 клиентов, кэшировать отдельно не стоит. Shape соответствует
// GET /clients (backend: ClientsController.list → Client entity).
interface ClientOption {
  id: string;
  name: string;
}

const INDUSTRY_LABEL: Record<Industry, string> = {
  stomatology: 'Стоматология',
  furniture: 'Мебель',
  restaurant: 'Ресторан',
  salon: 'Салон красоты',
  kids_center: 'Детский центр',
  auto_service: 'Автосервис',
  other: 'Другое',
};

const STATUS_META: Record<ProjectStatus, {
  label: string;
  variant: 'solid' | 'outline' | 'soft';
  color: 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}> = {
  draft: { label: 'Черновик', variant: 'soft', color: 'neutral' },
  stage_1: { label: 'Стадия 1', variant: 'soft', color: 'primary' },
  stage_2: { label: 'Стадия 2', variant: 'soft', color: 'primary' },
  stage_3: { label: 'Стадия 3', variant: 'soft', color: 'primary' },
  stage_4: { label: 'Стадия 4', variant: 'soft', color: 'primary' },
  finalized: { label: 'Финал', variant: 'soft', color: 'success' },
  archived: { label: 'Архив', variant: 'soft', color: 'neutral' },
  abandoned: { label: 'Остановлен', variant: 'soft', color: 'danger' },
};

type FilterValue = 'all' | 'active' | 'finalized' | 'archived';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  // ?filter=active|finalized|archived|all — чтобы ссылаться из StatCard на дашборде.
  // Без параметра — дефолт 'active' (самое частое состояние вкладки).
  const urlFilter = searchParams.get('filter') as FilterValue | null;
  const [filter, setFilter] = useState<FilterValue>(
    urlFilter && ['active', 'finalized', 'archived', 'all'].includes(urlFilter)
      ? urlFilter
      : 'active',
  );
  // ?newForClient=<uuid> → автоматически открывает модалку и пред-заполняет клиента.
  // Используется CTA'шками с ClientDetailPage («Создать первый проект» для клиента).
  const preselectedClientId = searchParams.get('newForClient');

  // Проекты создаёт chip_admin или tracker — маркетологи и owner_viewer'ы ведут уже
  // созданные проекты. Tracker — operational global-роль (восстановлена 2026-04-19
  // вместо удалённого chip_manager), ему разрешено заводить проекты и команду.
  const canCreate = user?.globalRole === 'chip_admin' || user?.globalRole === 'tracker';

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<Project[]>('/projects');
        setProjects(res.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Автооткрытие модалки, если в URL есть ?newForClient=...
  useEffect(() => {
    if (preselectedClientId && canCreate) setShowCreate(true);
  }, [preselectedClientId, canCreate]);

  const closeModal = () => {
    setShowCreate(false);
    // Убираем query param, чтобы повторное открытие шло с чистым состоянием.
    if (preselectedClientId) {
      searchParams.delete('newForClient');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.client?.name ?? '').toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'all') return true;
      if (filter === 'finalized') return p.status === 'finalized';
      if (filter === 'archived') return p.status === 'archived' || p.status === 'abandoned';
      // active
      return p.status !== 'archived' && p.status !== 'finalized' && p.status !== 'abandoned';
    });
  }, [projects, search, filter]);

  // Счётчики по каждому фильтру — показываем рядом с лейблом, как в handoff'е.
  // Считаем из ПОЛНОГО списка, а не из filtered — чтобы число не зависело от текущего выбора.
  const counts = useMemo<Record<FilterValue, number>>(() => ({
    active: projects.filter((p) =>
      p.status !== 'archived' && p.status !== 'finalized' && p.status !== 'abandoned').length,
    finalized: projects.filter((p) => p.status === 'finalized').length,
    archived: projects.filter((p) => p.status === 'archived' || p.status === 'abandoned').length,
    all: projects.length,
  }), [projects]);

  return (
    <div className="space-y-6 fade-in">
      {/* Toolbar: поиск + фильтр + CTA */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <div className="flex-1 max-w-md">
          <Input
            iconLeft={Search}
            placeholder="Найти по бренду или клиенту…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск проектов"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F5F5F4] rounded-xl" role="group" aria-label="Фильтр проектов">
          {(['active', 'finalized', 'archived', 'all'] as FilterValue[]).map((f) => {
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  'px-3 h-8 rounded-lg text-[13px] font-medium',
                  'inline-flex items-center gap-1.5',
                  'transition-[background-color,color,box-shadow] duration-200',
                  isActive
                    ? 'bg-white text-[#1A1A1A] shadow-[0_1px_2px_0_rgba(0,0,0,0.06)]'
                    : 'bg-transparent text-[#78716C] hover:text-[#1A1A1A]',
                ].join(' ')}
                aria-pressed={isActive}
              >
                <span>{FILTER_LABEL[f]}</span>
                <span className={[
                  'font-mono tabular-nums text-[11px]',
                  isActive ? 'text-[#78716C]' : 'text-[#A8A29E]',
                ].join(' ')}>
                  {counts[f]}
                </span>
              </button>
            );
          })}
        </div>
        {canCreate && (
          <div className="md:ml-auto">
            <Button
              variant="primary"
              size="md"
              iconLeft={Plus}
              onClick={() => setShowCreate(true)}
            >
              Новый проект
            </Button>
          </div>
        )}
      </div>

      {/* Содержимое */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-[#F5F5F4] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Card.Body>
            <EmptyState
              icon={FolderKanban}
              title={search ? 'По вашему запросу ничего не нашли' : 'Проектов нет'}
              description={
                search
                  ? 'Попробуйте другой запрос или сбросьте фильтр.'
                  : canCreate
                  ? 'Создайте первый проект — сразу откроется wizard методологии.'
                  : 'Дождитесь, пока проджект Чиркова добавит вас в проект.'
              }
              action={
                canCreate && !search ? (
                  <Button variant="primary" iconLeft={Plus} onClick={() => setShowCreate(true)}>
                    Создать проект
                  </Button>
                ) : search ? (
                  <Button variant="secondary" onClick={() => { setSearch(''); setFilter('active'); }}>
                    Сбросить фильтры
                  </Button>
                ) : undefined
              }
            />
          </Card.Body>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={closeModal}
        title="Новый проект"
        description="Заведите бренд, стадии откроются последовательно."
        width={560}
      >
        <CreateProjectForm
          preselectedClientId={preselectedClientId}
          onCreated={(p) => {
            setProjects([p, ...projects]);
            closeModal();
          }}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}

const FILTER_LABEL: Record<FilterValue, string> = {
  active: 'Активные',
  finalized: 'Завершённые',
  archived: 'В архиве',
  all: 'Все',
};

// ———————————————————————————————————————————————————————————————
// ProjectCard — одна карточка проекта в grid'е
// ———————————————————————————————————————————————————————————————

function ProjectCard({ project }: { project: Project }) {
  const meta = STATUS_META[project.status] ?? STATUS_META.draft;
  const stageProgress = (project.currentStage / 4) * 100;
  const budget = parseFloat(project.budgetUsd || '0');
  const spent = parseFloat(project.spentUsd || '0');
  const budgetPct = budget > 0 ? (spent / budget) * 100 : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]
        focus-visible:ring-offset-2 rounded-2xl"
    >
      <Card variant="interactive" className="h-full">
        <Card.Body className="h-full flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-[#1A1A1A] leading-tight truncate">
                {project.name}
              </h3>
              <p className="text-[#78716C] text-xs mt-1 truncate">
                {project.client?.name ?? '—'}
              </p>
            </div>
            <Badge variant={meta.variant} color={meta.color}>{meta.label}</Badge>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge variant="soft" color="neutral">
              {INDUSTRY_LABEL[project.industry] ?? project.industry}
            </Badge>
            <Badge variant="soft" color="neutral">{labelTariff(project.tariff)}</Badge>
          </div>

          <div className="pt-3 mt-auto border-t border-[#E7E5E4] grid grid-cols-2 gap-4">
            <div>
              <p className="uppercase-mono mb-1.5">Стадия</p>
              <div className="flex items-center gap-2">
                <ProgressBar value={stageProgress} color="primary" height={6} />
                <span className="font-mono text-[11px] text-[#78716C] tabular-nums flex-shrink-0">
                  {project.currentStage}/4
                </span>
              </div>
            </div>
            {budget > 0 ? (
              <div>
                <p className="uppercase-mono mb-1.5">Бюджет</p>
                <div className="flex items-center gap-2">
                  <ProgressBar
                    value={budgetPct}
                    color={budgetPct > 85 ? 'warning' : 'primary'}
                    height={6}
                  />
                  <span className="font-mono text-[11px] text-[#78716C] tabular-nums flex-shrink-0">
                    {Math.round(budgetPct)}%
                  </span>
                </div>
              </div>
            ) : (
              <div aria-hidden />
            )}
          </div>
        </Card.Body>
      </Card>
    </Link>
  );
}

function labelTariff(t: ProjectTariff): string {
  switch (t) {
    case 'economy': return 'Economy';
    case 'standard': return 'Standard';
    case 'premium': return 'Premium';
    default: return String(t);
  }
}

// ———————————————————————————————————————————————————————————————
// CreateProjectForm — форма внутри Modal
// ———————————————————————————————————————————————————————————————

function CreateProjectForm({
  onCreated,
  onCancel,
  preselectedClientId,
}: {
  onCreated: (p: Project) => void;
  onCancel: () => void;
  /** Если передан — поле «Клиент» показываем readonly (пришли со страницы клиента). */
  preselectedClientId?: string | null;
}) {
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState<string>(preselectedClientId ?? '');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [industry, setIndustry] = useState<Industry>('stomatology');
  const [tariff, setTariff] = useState<ProjectTariff>('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Грузим клиентов для селекта. Backend: GET /clients (chip_admin only).
  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<ClientOption[]>('/clients');
        setClients(res.data ?? []);
      } catch {
        // если не пришло — UI покажет «список пуст», submit заблокирован
      } finally {
        setClientsLoading(false);
      }
    })();
  }, []);

  const preselectedName = useMemo(
    () => clients.find((c) => c.id === preselectedClientId)?.name,
    [clients, preselectedClientId],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Выберите клиента из списка');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Backend CreateProjectDto ждёт clientId (UUID). Раньше форма слала clientName —
      // это отбрасывалось ValidationPipe'ом как unknown property, что приводило к 400.
      const res = await http.post<Project>('/projects', { name, clientId, industry, tariff });
      onCreated(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось создать проект');
    } finally {
      setLoading(false);
    }
  };

  // Живой пример заполнения — бренд одежды «Холст». Помогает админу понять формат.
  // Подбираем по имени из существующих клиентов; если «Холст» не сидирован — тихо не делаем.
  const fillExample = () => {
    const hasContent = name.trim().length > 0;
    if (hasContent) {
      const ok = window.confirm('Перезаписать заполненные поля примером «Холст»?');
      if (!ok) return;
    }
    setName('Холст — бренд-платформа 2026');
    const holst = clients.find((c) => /холст/i.test(c.name));
    if (holst && !preselectedClientId) setClientId(holst.id);
    setIndustry('other');
    setTariff('standard');
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Название бренда"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Например: Белая Линия"
        hint="Коммерческое имя, которое видят клиенты. Можно со спецсимволами и кавычками."
        autoFocus
      />
      {/* Клиент. Раньше было свободное текстовое поле «clientName», которое backend
          отбрасывал — проект не создавался. Теперь — селект из /clients (эти
          сущности заводятся отдельно через «Клиенты и команда»). Если на форму
          пришли со страницы клиента (?newForClient=...), показываем readonly бейдж. */}
      {preselectedClientId ? (
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">Клиент</label>
          <div className="w-full h-10 px-3 rounded-lg bg-[#F5F5F4] border border-[#E7E5E4] flex items-center text-sm text-[#1A1A1A]">
            {preselectedName ?? 'Загружаем…'}
          </div>
          <p className="mt-1.5 text-xs text-[#78716C]">
            Клиент подставлен автоматически. Чтобы создать проект для другого клиента — закройте это окно и откройте нужного клиента в разделе «Клиенты и команда».
          </p>
        </div>
      ) : (
        <div>
          <label htmlFor="client" className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
            Клиент (ИП / ООО)
          </label>
          <select
            id="client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            disabled={clientsLoading || clients.length === 0}
            className="w-full h-10 px-3 text-sm bg-[#F5F5F4] border border-[#E7E5E4]
              rounded-lg transition-colors duration-200
              focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]
              disabled:opacity-60"
          >
            <option value="">{clientsLoading ? 'Загружаем клиентов…' : '— выберите клиента —'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-[#78716C]">
            Если нужного клиента нет в списке — сначала заведите его в разделе «Клиенты и команда» через «Новый клиент». Один клиент = одна бренд-платформа; следующий пересбор — отдельный проект.
          </p>
        </div>
      )}
      <div>
        <label htmlFor="industry" className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          Индустрия
        </label>
        <select
          id="industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value as Industry)}
          className="w-full h-10 px-3 text-sm bg-[#F5F5F4] border border-[#E7E5E4]
            rounded-lg transition-colors duration-200
            focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
        >
          {Object.entries(INDUSTRY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-[#78716C]">
          Влияет на industry_context: 4 прайм-вопроса и 5 стоп-слов для Claude. «Другое» — если ничего не подошло точно.
        </p>
      </div>
      <div>
        <label htmlFor="tariff" className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
          Тариф
        </label>
        <select
          id="tariff"
          value={tariff}
          onChange={(e) => setTariff(e.target.value as ProjectTariff)}
          className="w-full h-10 px-3 text-sm bg-[#F5F5F4] border border-[#E7E5E4]
            rounded-lg transition-colors duration-200
            focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
        >
          <option value="economy">Economy · 5 000 ₽/мес · без ручного разбора</option>
          <option value="standard">Standard · 12 000 ₽/мес · 2 ч разбора</option>
          <option value="premium">Premium · 28 000 ₽/мес · безлимит разбор + оффлайн-встреча</option>
        </select>
        <p className="mt-1.5 text-xs text-[#78716C]">
          Месячный лимит AI-вызовов и часы ревью Чиркова. По умолчанию Standard — годится для 90% проектов.
        </p>
      </div>

      {error && (
        <div role="alert"
          className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-sm text-[#B91C1C]">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
        {/* «Показать пример» — заполняет форму данными бренда «Холст» (второй сид-клиент).
            Слева чтобы не конкурировал визуально с primary CTA «Создать проект» справа. */}
        <button
          type="button"
          onClick={fillExample}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
            text-xs font-medium text-[#4F46E5] hover:bg-[#EEF2FF]
            transition-colors"
          aria-label="Заполнить форму примером (бренд одежды «Холст»)"
        >
          <Lightbulb className="w-3.5 h-3.5" aria-hidden />
          Показать пример («Холст»)
        </button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? 'Создаю…' : 'Создать проект'}
          </Button>
        </div>
      </div>
    </form>
  );
}
