import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, Calendar, Users, Briefcase, Crown, Plus, UserPlus, X, Trash2, AlertTriangle, Pencil } from 'lucide-react';
import Input from '../../components/ui/Input';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

// Detail-страница клиента (/admin/clients/:id). Подтягивает обогащённый payload
// от GET /clients/:id — с nested projects → roles → user. Ни одного N+1 запроса
// не делает: все имена/ФИО собственников и маркетологов inline из API.
interface ClientDetail {
  id: string;
  name: string;
  legalForm: 'ooo' | 'ip' | 'self_employed' | 'individual';
  inn: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  withVat: boolean;
  createdAt: string;
  projects: Array<{
    id: string;
    name: string;
    industry: string;
    tariff: 'economy' | 'standard' | 'premium';
    status: string;
    currentStage: 1 | 2 | 3 | 4;
    budgetUsd: string;
    spentUsd: string;
    startedAt: string | null;
    finalizedAt: string | null;
    members: Array<{
      userId: string;
      fullName: string | null;
      email: string | null;
      role: 'marketer' | 'owner_viewer';
      isPrimary: boolean;
    }>;
  }>;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Какой проект сейчас переименовываем. null = модалка закрыта. Один state
  // вместо {open, project} — меньше рассинхронизации.
  const [renamingProject, setRenamingProject] = useState<{ id: string; name: string } | null>(null);

  // Выделен в функцию, чтобы после добавления/удаления сотрудника можно было
  // перечитать клиента одной строкой и обновить рендер. Раньше была единоразовая
  // загрузка в useEffect — после мутации приходилось делать F5.
  const reload = async () => {
    if (!id) return;
    try {
      const res = await http.get<ClientDetail>(`/clients/${id}`);
      setClient(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Не удалось загрузить клиента');
    }
  };

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>;
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/admin/users">Клиенты и пользователи</Breadcrumbs.Item>
          <Breadcrumbs.Current>Клиент не найден</Breadcrumbs.Current>
        </Breadcrumbs>
        <Card>
          <EmptyState
            icon={Building2}
            title="Клиент не найден"
            description={error ?? 'Возможно, клиент был удалён или ID набран с ошибкой.'}
          />
        </Card>
      </div>
    );
  }

  // Собираем уникальных членов команды через все проекты, но показываем по-проектно.
  const allMembers = client.projects.flatMap((p) =>
    p.members.map((m) => ({ ...m, projectId: p.id, projectName: p.name })),
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/admin/users">Клиенты и пользователи</Breadcrumbs.Item>
        <Breadcrumbs.Current>{client.name}</Breadcrumbs.Current>
      </Breadcrumbs>

      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#F97316]" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#1A1A1A]">{client.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" color="neutral">{legalFormLabel(client.legalForm)}</Badge>
                  {client.inn && (
                    <span className="text-xs text-[#78716C] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      ИНН {client.inn}
                    </span>
                  )}
                  <Badge variant="soft" color={client.withVat ? 'primary' : 'neutral'}>
                    {client.withVat ? 'С НДС' : 'Без НДС'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex items-center gap-2 text-[#78716C]">
                <Calendar className="w-4 h-4" aria-hidden />
                <span>Создан {new Date(client.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Trash2}
                onClick={() => setDeleteOpen(true)}
                className="!text-[#B91C1C] hover:!bg-[#FEE2E2]"
              >
                Удалить клиента
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {client.contactEmail && (
              <div className="flex items-center gap-2 text-sm text-[#1A1A1A]">
                <Mail className="w-4 h-4 text-[#78716C]" aria-hidden />
                <a href={`mailto:${client.contactEmail}`} className="hover:underline">{client.contactEmail}</a>
              </div>
            )}
            {client.contactPhone && (
              <div className="flex items-center gap-2 text-sm text-[#1A1A1A]">
                <Phone className="w-4 h-4 text-[#78716C]" aria-hidden />
                <a href={`tel:${client.contactPhone}`} className="hover:underline">{client.contactPhone}</a>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>

      {/* Projects */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Briefcase className="w-5 h-5 text-[#F97316] flex-shrink-0" aria-hidden />
            <div className="min-w-0">
              <Card.Title>Проекты ({client.projects.length})</Card.Title>
              <Card.Description>
                Бренд-платформы клиента. Один клиент = одна платформа; новый проект — следующий пересбор.
              </Card.Description>
            </div>
          </div>
          {/* CTA создания — всегда в header, даже когда проекты есть: админу может
              потребоваться зафиксировать новый квартальный пересбор. В пустом состоянии
              тот же CTA дублируется внутри EmptyState для явности. */}
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => navigate(`/projects?newForClient=${client.id}`)}
          >
            Создать проект
          </Button>
        </Card.Header>
        {client.projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Проектов пока нет"
            description="У этого клиента ещё не создан ни один проект. Нажмите кнопку ниже — откроется форма создания проекта, клиент будет подставлен автоматически."
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => navigate(`/projects?newForClient=${client.id}`)}
              >
                Создать первый проект
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-[#F5F5F4]">
            {client.projects.map((p) => (
              <li
                key={p.id}
                className="px-6 py-4 hover:bg-[#FAFAF9] transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${p.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/projects/${p.id}`);
                }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    <p className="font-medium text-[#1A1A1A]">{p.name}</p>
                    {/* Переименование проекта. Use case из CJM: мастер создал проект
                        под именем клиента-юрлица («Самодюк Д.В.»), а бренд у него
                        другой («КДМ — Камчатский дом мебели»). stopPropagation —
                        чтобы клик на карандаш не дёргал navigate на /projects/:id. */}
                    <button
                      type="button"
                      aria-label={`Переименовать проект «${p.name}»`}
                      title="Переименовать проект"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingProject({ id: p.id, name: p.name });
                      }}
                      className="w-6 h-6 rounded-md text-[#A8A29E] hover:text-[#1A1A1A] hover:bg-[#F5F5F4] flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="soft" color="primary">Стадия {p.currentStage}/4</Badge>
                    <Badge variant="outline" color={p.status === 'finalized' ? 'success' : 'neutral'}>
                      {statusLabel(p.status)}
                    </Badge>
                  </div>
                </div>
                {/* Подсказка под названием: показываем только когда имя совпадает с
                    названием клиента — это явный маркер «имя не тронули после мастера,
                    скорее всего стоит переименовать под бренд». */}
                {p.name.trim() === client.name.trim() && (
                  <p className="text-[11px] text-[#A16207] bg-[#FEF3C7] rounded-md px-2 py-0.5 inline-flex items-center gap-1 mb-1.5">
                    <Pencil className="w-3 h-3" aria-hidden />
                    Имя проекта совпадает с названием клиента — возможно стоит задать название бренда.
                  </p>
                )}

                {/* Budget / spent */}
                <div className="text-xs text-[#78716C] mb-2">
                  <span className="font-mono tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${Number(p.spentUsd).toFixed(2)}
                  </span>
                  {' '}из{' '}
                  <span className="font-mono tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                    ${Number(p.budgetUsd).toFixed(2)}
                  </span>
                  {' '}бюджета AI-вызовов
                </div>

                {/* Members */}
                {p.members.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.members.map((m) => (
                      <MemberPill key={m.userId} member={m} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Team. Показываем, даже когда пусто — иначе админ не видит, куда жать «добавить».
          Функционал открыт и chip_admin, и tracker'у (operational-роль восстановлена
          2026-04-19): оба могут приглашать маркетологов и собственников в команду
          клиента. Сам клиент-юрлицо заводит только chip_admin. */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Users className="w-5 h-5 text-[#F97316] flex-shrink-0" aria-hidden />
            <div className="min-w-0">
              <Card.Title>Команда клиента</Card.Title>
              <Card.Description>
                Кто имеет доступ к проектам и в какой роли. Собственника и маркетологов назначаете вы.
              </Card.Description>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            iconLeft={UserPlus}
            disabled={client.projects.length === 0}
            onClick={() => setAddOpen(true)}
            title={client.projects.length === 0 ? 'Сначала создайте проект — роли назначаются на проект' : undefined}
          >
            Добавить сотрудника
          </Button>
        </Card.Header>
        {client.projects.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Пока некого добавлять"
            description="Роль (маркетолог / собственник) назначается на проект, а не на клиента в целом. Создайте первый проект — дальше можно будет пригласить людей в команду."
          />
        ) : allMembers.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Команда ещё не собрана"
            description="Нажмите «Добавить сотрудника», чтобы назначить собственника или маркетолога на один из проектов клиента."
          />
        ) : (
          <ul className="divide-y divide-[#F5F5F4]">
            {deduplicate(allMembers).map((m) => (
              <li
                key={`${m.userId}::${m.role}::${m.projectId}`}
                className="px-6 py-3 hover:bg-[#FAFAF9] transition-colors flex items-center justify-between gap-3 flex-wrap"
              >
                <Link to={`/admin/users/${m.userId}`} className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-[#1A1A1A]">{m.fullName ?? '—'}</p>
                  <p className="text-xs text-[#78716C]">{m.email ?? '—'}</p>
                </Link>
                <div className="flex items-center gap-2 flex-wrap">
                  {m.isPrimary && (
                    <Badge variant="soft" color="warning" icon={Crown}>
                      Primary
                    </Badge>
                  )}
                  <Badge variant="outline" color="primary">{roleLabel(m.role)}</Badge>
                  <Badge variant="outline" color="neutral">{m.projectName}</Badge>
                  <RemoveMemberButton
                    projectId={m.projectId}
                    projectName={m.projectName}
                    userId={m.userId}
                    userName={m.fullName ?? m.email ?? 'сотрудника'}
                    role={m.role}
                    onRemoved={reload}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        projects={client.projects.map((p) => ({ id: p.id, name: p.name }))}
        onAdded={async () => {
          setAddOpen(false);
          await reload();
        }}
      />

      <DeleteClientModal
        open={deleteOpen}
        client={client}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          navigate('/admin/users');
        }}
      />

      <RenameProjectModal
        project={renamingProject}
        onClose={() => setRenamingProject(null)}
        onRenamed={async () => {
          setRenamingProject(null);
          await reload();
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// RenameProjectModal — переименование проекта под бренд клиента.
// Валидация: 1..255 символов (матчит backend DTO). По Enter — submit.
// ────────────────────────────────────────────────────────────
function RenameProjectModal({
  project,
  onClose,
  onRenamed,
}: {
  project: { id: string; name: string } | null;
  onClose: () => void;
  onRenamed: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(project?.name ?? '');
    setErr(null);
    setSubmitting(false);
  }, [project]);

  if (!project) {
    return (
      <Modal open={false} onClose={onClose} title="" width={480}>
        <div />
      </Modal>
    );
  }

  const trimmed = name.trim();
  const unchanged = trimmed === project.name.trim();
  const canSubmit = !submitting && trimmed.length >= 1 && trimmed.length <= 255 && !unchanged;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErr(null);
    try {
      await http.patch(`/projects/${project.id}`, { name: trimmed });
      await onRenamed();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Не удалось переименовать проект');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={!!project}
      onClose={() => !submitting && onClose()}
      title="Переименовать проект"
      description="Задайте фактическое имя бренда. Чаще всего это нужно, когда мастер создал проект под названием клиента-юрлица, а бренд у клиента другой."
      width={480}
    >
      <div className="space-y-4">
        <Input
          label="Название проекта"
          placeholder="Например: КДМ — Камчатский дом мебели"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) submit();
          }}
          autoFocus
          hint="1–255 символов. Изменение попадёт в audit log."
        />

        {err && <div className="text-sm text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-3 py-2">{err}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={submitting}>
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────
// DeleteClientModal — подтверждение с вводом имени клиента.
// Пользователь должен напечатать точное название клиента — это намеренное
// тормозящее препятствие против случайного нажатия. На каскад заранее предупреждаем
// текстом: сколько проектов снесётся, что prompt_run/invoices останутся (для
// финансовой истории), что собственник/маркетолог останутся в системе (их
// отвязывает от проекта, но user-запись не трогаем).
// ────────────────────────────────────────────────────────────
function DeleteClientModal({
  open,
  client,
  onClose,
  onDeleted,
}: {
  open: boolean;
  client: ClientDetail;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmName('');
      setErr(null);
      setSubmitting(false);
    }
  }, [open]);

  const projectCount = client.projects.length;
  const nameMatches = confirmName.trim() === client.name.trim();

  const submit = async () => {
    if (!nameMatches) return;
    setSubmitting(true);
    setErr(null);
    try {
      await http.delete(`/clients/${client.id}`);
      onDeleted();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Не удалось удалить клиента');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="Удалить клиента"
      description="Действие необратимое. Прочитайте что снесётся, прежде чем подтверждать."
      width={520}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B91C1C] flex-shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-[#7F1D1D] space-y-1">
            <p><strong>Будет удалено:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Сам клиент «{client.name}»</li>
              {projectCount > 0 && (
                <>
                  <li>
                    {projectCount}{' '}
                    {pluralRu(projectCount, ['проект', 'проекта', 'проектов'])}{' '}
                    целиком со всеми черновиками, утверждениями и событиями wizard'а
                  </li>
                  <li>
                    Учётки собственника и маркетолога этого клиента — если они нигде больше
                    не используются (на проектах других клиентов их никто не трогает; сотрудники
                    ЧиП — админ/трекер — тоже остаются на месте)
                  </li>
                </>
              )}
            </ul>
            <p className="pt-1"><strong>Останется:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Сотрудники ЧиП (админ, трекеры) и любые юзеры, привязанные к другим клиентам</li>
              <li>История AI-вызовов, аудит, инвойсы — сохраняются без привязки к проекту (UUID юзеров остаются для расследований)</li>
            </ul>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1.5">
            Напишите название клиента чтобы подтвердить:{' '}
            <span className="font-mono text-[#1A1A1A]" style={{ fontFamily: 'var(--font-mono)' }}>
              {client.name}
            </span>
          </label>
          <input
            type="text"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nameMatches && !submitting) submit();
            }}
            autoFocus
            className={[
              'w-full h-10 px-3 rounded-[10px] border text-sm transition-[border-color,box-shadow] duration-200',
              'focus:outline-none',
              nameMatches
                ? 'border-[#16A34A] bg-[#F0FDF4] text-[#14532D] focus:shadow-[0_0_0_1px_#16A34A]'
                : 'border-[#E7E5E4] bg-white text-[#1A1A1A] focus:border-[#4F46E5] focus:shadow-[0_0_0_1px_#4F46E5]',
            ].join(' ')}
          />
        </div>

        {err && <div className="text-sm text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-3 py-2">{err}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            variant="danger"
            iconLeft={Trash2}
            disabled={!nameMatches}
            loading={submitting}
            onClick={submit}
          >
            Удалить клиента
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

// ────────────────────────────────────────────────────────────
// AddMemberModal — назначение marketer/owner_viewer на проект клиента.
// UI: выбор проекта → выбор существующего пользователя → выбор роли → submit.
// Backend: POST /projects/:projectId/roles. Создание нового пользователя на лету
// тут сознательно не добавлено — для этого есть отдельный CreateClientWizard
// (собственник) и UsersPage (ручное заведение). Модалка — только link existing.
// ────────────────────────────────────────────────────────────
interface UserListItem {
  id: string;
  email: string;
  fullName: string;
  globalRole: 'chip_admin' | 'tracker' | null;
}
function AddMemberModal({
  open,
  onClose,
  projects,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  projects: Array<{ id: string; name: string }>;
  onAdded: () => void | Promise<void>;
}) {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'marketer' | 'owner_viewer'>('marketer');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setProjectId(projects[0]?.id ?? '');
    setUserId('');
    setRole('marketer');
    setUsersLoading(true);
    http
      .get<UserListItem[]>('/users')
      .then((r) => setUsers(r.data ?? []))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [open, projects]);

  // Убираем из выбора chip_admin'ов и tracker'ов — они видят всё глобально, им
  // не нужна ProjectRole. И не нужно их «назначать маркетологом» по ошибке.
  const candidates = useMemo(
    () => users.filter((u) => u.globalRole !== 'chip_admin' && u.globalRole !== 'tracker'),
    [users],
  );

  const submit = async () => {
    if (!projectId || !userId) {
      setErr('Выберите проект и пользователя');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await http.post(`/projects/${projectId}/roles`, {
        userId,
        role,
        isPrimary: role === 'marketer', // маркетолог по умолчанию primary (снимет primary с предыдущего).
      });
      await onAdded();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'Не удалось назначить роль');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить сотрудника в команду"
      description="Назначьте роль (маркетолог или собственник) на конкретный проект клиента."
      width={520}
    >
      <div className="space-y-4">
        {/* Project */}
        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1.5">Проект</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={selectCls}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* User */}
        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1.5">Пользователь</label>
          {usersLoading ? (
            <div className="text-sm text-[#78716C]">Загружаем список…</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-[#78716C]">
              В системе пока нет пользователей, которых можно назначить. Заведите нового в разделе «Клиенты и команда».
            </div>
          ) : (
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className={selectCls}
            >
              <option value="">— выберите —</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} · {u.email}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-[#78716C] mt-1.5">
            Нет подходящего пользователя? Сначала создайте его на странице «Клиенты и команда» → «Новый пользователь».
          </p>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1.5">Роль</label>
          <div className="flex gap-2">
            <RolePickerChip
              active={role === 'marketer'}
              onClick={() => setRole('marketer')}
              label="Маркетолог"
              hint="Ведёт сессии, вызывает Claude, редактирует черновики. Primary по умолчанию."
            />
            <RolePickerChip
              active={role === 'owner_viewer'}
              onClick={() => setRole('owner_viewer')}
              label="Собственник"
              hint="Читает и подписывает. Не редактирует артефакты."
            />
          </div>
        </div>

        {err && (
          <div className="text-sm text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-3 py-2">{err}</div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={submitting}
            disabled={!projectId || !userId || candidates.length === 0}
          >
            Назначить
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const selectCls = [
  'w-full h-10 px-3 rounded-[10px]',
  'border border-[#E7E5E4] bg-white',
  'text-sm text-[#1A1A1A]',
  'transition-[border-color,box-shadow] duration-200',
  'focus:outline-none focus:border-[#4F46E5] focus:shadow-[0_0_0_1px_#4F46E5]',
].join(' ');

function RolePickerChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 text-left px-3 py-2 rounded-[10px] border transition-all',
        active
          ? 'border-[#4F46E5] bg-[#EEF2FF] shadow-[0_0_0_1px_#4F46E5]'
          : 'border-[#E7E5E4] bg-white hover:border-[#A8A29E]',
      ].join(' ')}
    >
      <div className="font-medium text-sm text-[#1A1A1A]">{label}</div>
      <div className="text-xs text-[#78716C] mt-0.5">{hint}</div>
    </button>
  );
}

// Маленькая X-кнопка рядом с участником команды. Подтверждение через window.confirm —
// модалка поверх модалки (двухэтажный диалог) излишняя для такого редкого действия.
function RemoveMemberButton({
  projectId,
  projectName,
  userId,
  userName,
  role,
  onRemoved,
}: {
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  role: 'marketer' | 'owner_viewer';
  onRemoved: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    const ok = window.confirm(
      `Убрать ${userName} из проекта «${projectName}» (роль: ${roleLabel(role)})?\n\nДоступ к проекту будет снят немедленно.`,
    );
    if (!ok) return;
    setLoading(true);
    try {
      await http.delete(`/projects/${projectId}/roles/${userId}/${role}`);
      await onRemoved();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Не удалось снять роль');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      aria-label={`Убрать ${userName} из команды`}
      className="w-7 h-7 rounded-md text-[#A8A29E] hover:text-[#B91C1C] hover:bg-[#FEE2E2] flex items-center justify-center transition-colors disabled:opacity-50"
      title="Снять роль"
    >
      <X className="w-4 h-4" />
    </button>
  );
}

function MemberPill({ member }: { member: { userId: string; fullName: string | null; role: string; isPrimary: boolean } }) {
  return (
    <Link
      to={`/admin/users/${member.userId}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-[#F5F5F4] hover:bg-[#E7E5E4] px-2.5 py-1 text-xs text-[#1A1A1A] transition-colors"
    >
      {member.isPrimary && <Crown className="w-3 h-3 text-[#F59E0B]" aria-hidden />}
      <span>{member.fullName ?? '—'}</span>
      <span className="text-[#78716C]">· {roleLabel(member.role)}</span>
    </Link>
  );
}

// Первое вхождение userId оставляем, дубликаты отбрасываем.
function deduplicate<T extends { userId: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (seen.has(item.userId)) continue;
    seen.add(item.userId);
    out.push(item);
  }
  return out;
}

function legalFormLabel(form: string): string {
  return (
    { ooo: 'ООО', ip: 'ИП', self_employed: 'Самозанятый', individual: 'Физ. лицо' } as Record<string, string>
  )[form] ?? form;
}

function industryLabel(ind: string): string {
  return (
    {
      stomatology: 'Стоматология',
      furniture: 'Мебель',
      restaurant: 'Ресторан',
      salon: 'Салон красоты',
      kids_center: 'Детский центр',
      auto_service: 'Автосервис',
      other: 'Другое',
    } as Record<string, string>
  )[ind] ?? ind;
}

function tariffLabel(t: string): string {
  return ({ economy: 'Эконом', standard: 'Стандарт', premium: 'Премиум' } as Record<string, string>)[t] ?? t;
}

function statusLabel(s: string): string {
  return (
    {
      draft: 'Черновик',
      stage_1: 'Стадия 1',
      stage_2: 'Стадия 2',
      stage_3: 'Стадия 3',
      stage_4: 'Стадия 4',
      finalized: 'Завершён',
      archived: 'Архив',
      abandoned: 'Брошен',
    } as Record<string, string>
  )[s] ?? s;
}

function roleLabel(r: string): string {
  return ({ marketer: 'Маркетолог', owner_viewer: 'Собственник' } as Record<string, string>)[r] ?? r;
}
