import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, FileDown, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { http } from '../api/http';
import { useAuthStore } from '../store/auth';
import type { Project, Row, ApprovalRecord, Industry, ProjectTariff } from '../types/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

// Русские имена для индустрии/тарифа — в БД хранится английский ключ, но маркетологу
// показываем читаемую подпись. Мapping дублируется в ProjectsPage.tsx — источник правды
// один (types/api.ts), подписи локализуются в месте рендера (i18n в MVP не тянем).
const INDUSTRY_LABEL: Record<Industry, string> = {
  stomatology: 'Стоматология',
  furniture: 'Мебель',
  restaurant: 'Ресторан',
  salon: 'Салон красоты',
  kids_center: 'Детский центр',
  auto_service: 'Автосервис',
  other: 'Другое',
};

const TARIFF_LABEL: Record<ProjectTariff, string> = {
  economy: 'Economy',
  standard: 'Standard',
  premium: 'Premium',
};

// 7 артефактов канона 3.1 — русские подписи для карточки «Утверждения».
// Ключи == backend enum ApprovalArtifact, держать в sync с ApprovalsPage.
const ARTIFACT_LABEL: Record<string, string> = {
  legend: 'Легенда бренда',
  values: 'Ценности',
  mission: 'Миссия',
  vision: 'Видение',
  archetype_and_positioning: 'Архетип и позиционирование',
  brand_message: 'Бренд-месседж',
  final_document: 'Финальный документ',
};

const STAGE_CARDS = [
  { n: 1, title: 'Стадия 1. Портрет клиента', description: 'Голос клиента: сегменты, боль, мотивы, триггеры покупки.' },
  { n: 2, title: 'Стадия 2. Сессия с собственником', description: 'Легенда, ценности, миссия собственника. Claude работает напарником.' },
  { n: 3, title: 'Стадия 3. Архетип и позиционирование', description: 'Канонический архетип → позиционирование → 3 варианта месседжа.' },
  { n: 4, title: 'Стадия 4. Четыре теста месседжа', description: 'Тест семейного стола, эмоции, краткости, универсальности.' },
] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [project, setProject] = useState<Project | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'docx' | 'xlsx' | null>(null);
  const isOwner = user?.projectRoles?.some((r) => r.projectId === id && r.role === 'owner_viewer');
  const isMarketer = user?.projectRoles?.some((r) => r.projectId === id && r.role === 'marketer');
  // Admin-привилегии на странице проекта (технический экспорт до финализации,
  // отображение AI-бюджета) достаются обеим global-ролям. Tracker — operational
  // ops, ему нужно уметь выгрузить DOCX для клиента в середине работы (дебаг).
  const isAdmin = user?.globalRole === 'chip_admin' || user?.globalRole === 'tracker';

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [projectRes, rowsRes, approvalsRes] = await Promise.all([
          http.get<Project>(`/projects/${id}`),
          http.get<Row[]>(`/wizard/projects/${id}/rows`),
          http.get<ApprovalRecord[]>(`/wizard/projects/${id}/approvals`),
        ]);
        setProject(projectRes.data);
        setRows(rowsRes.data);
        setApprovals(approvalsRes.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Auto-redirect маркетолога на его текущую стадию. Админ/трекер/собственник
  // видят обзор с 4 карточками (у них задача — обзор, не исполнение). Маркетолог
  // же на обзор заходить НЕ должен: блок с тремя «закрытыми» стадиями не несёт
  // информации для исполнителя, пугает серыми замками и заставляет сделать лишний
  // клик. Переход делаем `replace: true`, чтобы кнопка «Назад» уводила в список
  // проектов, а не в ту же обзорку (иначе получим цикл redirect'ов).
  // Условия: роль == marketer В ЭТОМ проекте, нет админ-роли, проект не финализирован
  // (после финала марктолог может хотеть посмотреть итог 4 стадий и экспорт — обзор
  // уместен). Если стадия не 1..4 (например 0 — черновик) — тоже не редиректим.
  useEffect(() => {
    if (loading || !project || !id) return;
    if (!isMarketer || isAdmin || isOwner) return;
    if (project.status === 'finalized' || project.status === 'archived' || project.status === 'abandoned') return;
    const stage = project.currentStage;
    if (stage >= 1 && stage <= 4) {
      navigate(`/projects/${id}/stage-${stage}`, { replace: true });
    }
  }, [loading, project, id, isMarketer, isAdmin, isOwner, navigate]);

  // Бэкенд-контроллер: `@Controller('export')` (не `exporter`), ответ — бинарь
  // (`res.send(bytes)` + `Content-Disposition: attachment`), а не `{artifactUri}`.
  // Используем responseType:'blob' + клиентский download, чтобы не открывать новую
  // вкладку с 404 и не парсить JSON, которого нет.
  const handleExport = async (format: 'docx' | 'xlsx') => {
    if (!id) return;
    setExporting(format);
    try {
      const res = await http.post(`/export/projects/${id}/${format}`, {}, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (project?.name ?? `project-${id}`).replace(/[^\wа-яА-Я\-]+/gi, '_');
      a.download = `bp-${safeName}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      // axios + blob-response: сервер положил ошибку в JSON, но мы запросили blob.
      // Читаем blob как текст, чтобы достать message.
      let message = 'Экспорт недоступен';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const txt = await data.text();
          const parsed = JSON.parse(txt);
          message = parsed.message || message;
        } catch {
          /* empty blob / non-JSON — оставляем дефолт */
        }
      } else if (typeof data?.message === 'string') {
        message = data.message;
      }
      alert(message);
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <div className="p-6 text-[#A8A29E] text-sm">Загружаем…</div>;
  if (!project) return <div className="p-6 text-[#78716C]">Проект не найден</div>;

  const stageStatus = (stage: 1 | 2 | 3 | 4) => {
    // Финализированный проект — все 4 стадии показываем completed, даже если
    // currentStage застрял на 4 (в БД не докручиваем до 5, т.к. 5-ой стадии нет).
    if (project.status === 'finalized') return 'completed';
    if (project.currentStage > stage) return 'completed';
    if (project.currentStage === stage) return 'active';
    return 'locked';
  };

  return (
    <div className="space-y-6 fade-in">
      <Card>
        <Card.Body>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-[#1A1A1A] truncate">{project.name}</h2>
              <p className="text-[#78716C] text-sm mt-1">
                {project.client?.name ?? '—'} · индустрия: {INDUSTRY_LABEL[project.industry] ?? project.industry} · тариф: {TARIFF_LABEL[project.tariff] ?? project.tariff}
              </p>
              {/* AI-бюджет в $ — это cost-of-goods Чиркова, не счёт клиента.
                  Показываем только чип-админу и маркетологу; собственнику не нужно. */}
              {!isOwner && (
                <p className="text-[#78716C] text-sm mt-1 font-mono tabular-nums">
                  Бюджет AI: ${project.budgetUsd} · потрачено: ${project.spentUsd}
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {/* Экспорт активен только на финализированном проекте:
                  выгружать DOCX/XLSX с черновиками бессмысленно и вредно (клиент
                  может принять draft за финал). Admin при желании может
                  проверить техническую выгрузку в любой момент. */}
              <Button
                variant="secondary"
                iconLeft={FileDown}
                onClick={() => handleExport('xlsx')}
                disabled={!!exporting || (project.status !== 'finalized' && !isAdmin)}
              >
                {exporting === 'xlsx' ? 'Экспорт…' : 'XLSX'}
              </Button>
              <Button
                variant="primary"
                iconLeft={FileDown}
                onClick={() => handleExport('docx')}
                disabled={!!exporting || (project.status !== 'finalized' && !isAdmin)}
              >
                {exporting === 'docx' ? 'Экспорт…' : 'DOCX бренд-книга'}
              </Button>
            </div>
          </div>
          {/* Предупреждение, если экспорт заблокирован — вместо тихого disabled. */}
          {project.status !== 'finalized' && !isAdmin && (
            <p className="text-[#A8A29E] text-xs mt-3">
              Экспорт бренд-книги откроется, когда все семь артефактов утверждены и собственник подписал финальный документ.
            </p>
          )}
        </Card.Body>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGE_CARDS.map((s) => {
          const status = stageStatus(s.n as 1 | 2 | 3 | 4);
          const rowsInStage = rows.filter((r) => r.sheet === s.n || r.sheet === (s.n + 1) as any);
          const isActive = status === 'active';
          const isLocked = status === 'locked';
          return (
            <div
              key={s.n}
              className={[
                'rounded-[20px] p-5 flex flex-col gap-3 min-w-0',
                'transition-[border-color,box-shadow] duration-200 ease-out',
                isActive
                  ? 'bg-white border border-[#A5B4FC] shadow-[0_4px_12px_0_rgba(79,70,229,0.06)]'
                  : isLocked
                  ? 'bg-[#FAFAF9] border border-[#E7E5E4]'
                  : 'bg-white border border-[#E7E5E4]',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0" />}
                {status === 'active' && <Sparkles className="w-5 h-5 text-[#4F46E5] flex-shrink-0" />}
                {status === 'locked' && <Lock className="w-5 h-5 text-[#A8A29E] flex-shrink-0" />}
                <p className={[
                  'font-semibold text-sm min-w-0 leading-tight',
                  isLocked ? 'text-[#78716C]' : 'text-[#1A1A1A]',
                ].join(' ')}>
                  {s.title}
                </p>
              </div>
              <p className={[
                'text-xs leading-relaxed',
                isLocked ? 'text-[#A8A29E]' : 'text-[#78716C]',
              ].join(' ')}>
                {s.description}
              </p>
              <p className="uppercase-mono mt-auto">{rowsInStage.length} артефактов</p>
              {!isLocked ? (
                <Link
                  to={`/projects/${id}/stage-${s.n}`}
                  className={[
                    'w-full h-9 flex items-center justify-center gap-2 rounded-[10px]',
                    'text-[13px] font-medium',
                    'transition-[background-color,border-color,color] duration-200',
                    isActive
                      ? 'bg-[#4F46E5] hover:bg-[#4338CA] text-white'
                      : 'bg-white border border-[#E7E5E4] hover:bg-[#F5F5F4] text-[#1A1A1A]',
                  ].join(' ')}
                >
                  {isActive
                    ? (isOwner ? 'Посмотреть черновики' : 'Продолжить')
                    : 'Посмотреть'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full h-9 rounded-[10px] text-[13px] font-medium bg-[#F5F5F4] text-[#A8A29E] cursor-not-allowed"
                >
                  Откроется позже
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Карточка утверждений показывается ТОЛЬКО когда уже есть что показывать.
          На первой стадии нового проекта утверждений физически быть не может
          (маркетолог ещё даже черновик не подал), а пустая плашка «Пока нет
          утверждений» визуально шумит и создаёт ложное ощущение пропущенного
          действия. Когда появится первое утверждение — карточка всплывёт сама. */}
      {approvals.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Утверждения собственника</Card.Title>
            <Link
              to={`/projects/${id}/approvals`}
              className="text-[#4F46E5] text-sm font-medium hover:text-[#4338CA]
                flex items-center gap-1 flex-shrink-0"
            >
              Все записи <ArrowRight className="w-4 h-4" />
            </Link>
          </Card.Header>
          <ul className="divide-y divide-[#E7E5E4] mt-3">
            {approvals.slice(0, 5).map((a) => (
              <li key={a.id} className="px-6 py-3 flex items-center justify-between text-sm gap-3">
                <span className="font-medium text-[#1A1A1A] truncate">{ARTIFACT_LABEL[a.artifact] ?? a.artifact}</span>
                <span className="text-[#A8A29E] text-xs font-mono tabular-nums flex-shrink-0">
                  {new Date(a.approvedAt).toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
