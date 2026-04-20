import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { User as UserIcon, Mail, Calendar, Shield, Briefcase, Crown, Trash2, AlertTriangle, Key, Copy, Check } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Breadcrumbs from '../../components/ui/Breadcrumbs';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuthStore } from '../../store/auth';

// Detail-страница пользователя (/admin/users/:id). Тянет обогащённый payload
// от GET /users/:id — с nested projectRoles → project (имена проектов inline).
// Никаких отдельных запросов на resolve projectId → name.
interface UserDetail {
  id: string;
  email: string;
  fullName: string;
  globalRole: 'chip_admin' | 'tracker' | null;
  isActive: boolean;
  createdAt: string;
  projectRoles: Array<{
    projectId: string;
    projectName: string | null;
    role: 'marketer' | 'owner_viewer';
    isPrimary: boolean;
  }>;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await http.get<UserDetail>(`/users/${id}`);
        setUser(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.message ?? 'Не удалось загрузить пользователя');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Кого нельзя удалять руками:
  //   - самого себя (иначе chip_admin заблокирует себя из системы);
  //   - chip_admin (подъём только через seed/миграцию — защита от случайного
  //     сноса учётки Чирковой).
  const canDelete = useMemo(() => {
    if (!user) return false;
    if (user.globalRole === 'chip_admin') return false;
    if (currentUser?.id === user.id) return false;
    return true;
  }, [user, currentUser]);

  // Сброс пароля может только chip_admin: tracker-у доступ к эскалациям
  // («клиент забыл пароль») не даётся — это идёт через Чиркову. Нельзя
  // сбрасывать пароль другому chip_admin'у и себе — backend тоже защищает,
  // но в UI скрываем кнопку чтобы не показывать нерабочий CTA.
  const canResetPassword = useMemo(() => {
    if (!user || !currentUser) return false;
    if (currentUser.globalRole !== 'chip_admin') return false;
    if (user.globalRole === 'chip_admin') return false;
    if (currentUser.id === user.id) return false;
    return true;
  }, [user, currentUser]);

  if (loading) {
    return <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>;
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/admin/users">Клиенты и пользователи</Breadcrumbs.Item>
          <Breadcrumbs.Current>Пользователь не найден</Breadcrumbs.Current>
        </Breadcrumbs>
        <Card>
          <EmptyState
            icon={UserIcon}
            title="Пользователь не найден"
            description={error ?? 'Возможно, пользователь был удалён или ID набран с ошибкой.'}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs>
        <Breadcrumbs.Item href="/admin/users">Клиенты и пользователи</Breadcrumbs.Item>
        <Breadcrumbs.Current>{user.fullName}</Breadcrumbs.Current>
      </Breadcrumbs>

      {/* Header */}
      <Card>
        <Card.Body>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#F97316]/10 flex items-center justify-center flex-shrink-0">
                <UserIcon className="w-6 h-6 text-[#F97316]" aria-hidden />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-[#1A1A1A]">{user.fullName}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm text-[#78716C]">
                    <Mail className="w-4 h-4" aria-hidden />
                    <a href={`mailto:${user.email}`} className="hover:underline text-[#1A1A1A]">{user.email}</a>
                  </div>
                  {user.globalRole === 'chip_admin' && (
                    <Badge variant="solid" color="primary" icon={Shield}>
                      Админ ЧиП
                    </Badge>
                  )}
                  {user.globalRole === 'tracker' && (
                    <Badge variant="soft" color="info" icon={Shield}>
                      Трекер ЧиП
                    </Badge>
                  )}
                  <Badge variant="soft" color={user.isActive ? 'success' : 'neutral'}>
                    {user.isActive ? 'Активен' : 'Отключён'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-sm">
              <div className="flex items-center gap-2 text-[#78716C]">
                <Calendar className="w-4 h-4" aria-hidden />
                <span>Создан {new Date(user.createdAt).toLocaleDateString('ru-RU')}</span>
              </div>
              {canResetPassword && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Key}
                  onClick={() => setResetOpen(true)}
                >
                  Сбросить пароль
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={Trash2}
                  onClick={() => setDeleteOpen(true)}
                  className="!text-[#B91C1C] hover:!bg-[#FEE2E2]"
                >
                  Удалить пользователя
                </Button>
              )}
              {user.globalRole === 'chip_admin' && (
                <span className="text-xs text-[#A8A29E]">Администратора можно снести только через миграцию</span>
              )}
              {currentUser?.id === user.id && user.globalRole !== 'chip_admin' && (
                <span className="text-xs text-[#A8A29E]">Это ваша учётка — удалить можно только из-под другого админа</span>
              )}
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Project memberships */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#F97316]" aria-hidden />
            <div>
              <Card.Title>Участие в проектах ({user.projectRoles.length})</Card.Title>
              <Card.Description>
                В каких проектах пользователь задействован и с какой ролью. Primary-маркетолог —
                ответственный за результат.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        {user.projectRoles.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Пользователь не в проектах"
            description={
              user.globalRole === 'chip_admin'
                ? 'Это админ ЧиП — у него глобальная роль, он видит все проекты, но не привязан к конкретному.'
                : user.globalRole === 'tracker'
                ? 'Это трекер ЧиП — ведёт все проекты платформы глобально, отдельные назначения не нужны.'
                : 'Назначьте пользователю роль при создании проекта, чтобы он мог участвовать в сборке.'
            }
          />
        ) : (
          <ul className="divide-y divide-[#F5F5F4]">
            {user.projectRoles.map((r) => (
              <li key={r.projectId} className="px-6 py-3 hover:bg-[#FAFAF9] transition-colors">
                <Link
                  to={`/projects/${r.projectId}`}
                  className="flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-[#1A1A1A]">{r.projectName ?? '—'}</p>
                    <p className="text-xs text-[#78716C] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                      {r.projectId.slice(0, 8)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.isPrimary && (
                      <Badge variant="soft" color="warning" icon={Crown}>
                        Primary
                      </Badge>
                    )}
                    <Badge variant="outline" color="primary">{roleLabel(r.role)}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <DeleteUserModal
        open={deleteOpen}
        user={user}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          setDeleteOpen(false);
          navigate('/admin/users');
        }}
      />

      <ResetPasswordModal
        open={resetOpen}
        user={user}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ResetPasswordModal — двухэтапная модалка:
//   1) Confirm: «точно сбросить? прошлый пароль перестанет работать, сессии выйдут»
//   2) Result: показываем новый пароль один раз + copy-кнопка + warning
//              «показывается только сейчас, сохраните перед закрытием».
// Пароль в БД хранится как bcrypt-хэш — посмотреть существующий пароль нельзя
// никаким правом (это криптографическое свойство). Только сброс.
// ────────────────────────────────────────────────────────────
interface ResetPasswordModalProps {
  open: boolean;
  user: UserDetail;
  onClose: () => void;
}

function ResetPasswordModal({ open, user, onClose }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setNewPassword(null);
      setSubmitting(false);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await http.post<{ password: string }>(`/users/${user.id}/reset-password`);
      setNewPassword(res.data.password);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Не удалось сбросить пароль. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API недоступен (старый браузер / insecure context) —
      // пароль всё равно виден на экране, admin скопирует вручную.
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title={newPassword ? 'Новый пароль' : 'Сбросить пароль'}
      description={
        newPassword
          ? 'Пароль показывается один раз. Сохраните его прямо сейчас — после закрытия окна посмотреть его будет нельзя.'
          : 'Существующий пароль посмотреть нельзя — пароли хранятся как односторонние хэши (это криптографическая защита, не ограничение интерфейса). Зато можно сгенерировать новый — передадите его человеку сами.'
      }
      width={520}
    >
      {newPassword ? (
        // STEP 2: success — показываем пароль с copy-кнопкой.
        <div className="space-y-4">
          <div className="rounded-xl bg-[#F0FDF4] border border-[#86EFAC] p-3 flex items-start gap-2">
            <Check className="w-4 h-4 text-[#16A34A] flex-shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-[#14532D] space-y-1">
              <p><strong>Пароль сброшен.</strong></p>
              <p>
                Все активные сессии «{user.fullName}» будут разлогинены в ближайшие 15 минут
                (после истечения access-токена). Передайте новый пароль лично или через защищённый канал.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#57534E] mb-1.5">
              Новый пароль для {user.fullName} ({user.email})
            </label>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 h-11 px-3 rounded-[10px] border border-[#E7E5E4] bg-[#FAFAF9] text-base font-mono text-[#1A1A1A] flex items-center select-all"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {newPassword}
              </div>
              <Button
                variant="secondary"
                size="md"
                iconLeft={copied ? Check : Copy}
                onClick={copy}
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-[#FEF3C7] border border-[#FCD34D] p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#A16207] flex-shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs text-[#78350F]">
              После закрытия окна пароль не восстановить. Если забудете — придётся
              сбрасывать ещё раз.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="primary" onClick={onClose}>
              Готово
            </Button>
          </div>
        </div>
      ) : (
        // STEP 1: confirm.
        <div className="space-y-4">
          <div className="rounded-xl bg-[#FEF3C7] border border-[#FCD34D] p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#A16207] flex-shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm text-[#78350F] space-y-1">
              <p><strong>Что произойдёт:</strong></p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Старый пароль «{user.fullName}» перестанет работать немедленно</li>
                <li>Активные сессии этого пользователя разорвутся в течение 15 минут</li>
                <li>Сгенерируется новый пароль — вы увидите его один раз на следующем шаге</li>
                <li>Факт сброса попадёт в audit log (сам пароль — нет)</li>
              </ul>
            </div>
          </div>

          {error && <div className="text-sm text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-3 py-2">{error}</div>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Отмена
            </Button>
            <Button variant="primary" iconLeft={Key} onClick={submit} loading={submitting}>
              Сбросить и показать новый
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// DeleteUserModal — type-name-to-confirm, как на ClientDetailPage.
// ----------------------------------------------------------------------------
interface DeleteUserModalProps {
  open: boolean;
  user: UserDetail;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteUserModal({ open, user, onClose, onDeleted }: DeleteUserModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmName('');
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const nameMatches = confirmName.trim() === user.fullName.trim();

  const submit = async () => {
    if (!nameMatches || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await http.delete(`/users/${user.id}`);
      onDeleted();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Не удалось удалить пользователя. Попробуйте ещё раз.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="Удалить пользователя"
      description="Действие необратимое. Прочитайте что снесётся, прежде чем подтверждать."
      width={520}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-[#B91C1C] flex-shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm text-[#7F1D1D] space-y-1">
            <p><strong>Будет удалено:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Учётка «{user.fullName}» ({user.email}) целиком</li>
              {user.projectRoles.length > 0 && (
                <li>
                  {user.projectRoles.length}{' '}
                  {pluralRu(user.projectRoles.length, ['привязка', 'привязки', 'привязок'])}{' '}
                  к проектам — сами проекты и их содержимое сохранятся, но этот человек туда больше не попадёт
                </li>
              )}
            </ul>
            <p className="pt-1"><strong>Останется:</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>История AI-вызовов и audit-лог с UUID этого пользователя — без ФИО (для расследований)</li>
              <li>Проекты, к которым был привязан — ведутся оставшейся командой</li>
            </ul>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#57534E] mb-1.5">
            Напишите ФИО пользователя чтобы подтвердить:{' '}
            <span className="text-[#1A1A1A] font-semibold">{user.fullName}</span>
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

        {error && <div className="text-sm text-[#B91C1C] bg-[#FEE2E2] rounded-lg px-3 py-2">{error}</div>}

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
            Удалить пользователя
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function roleLabel(r: string): string {
  return ({ marketer: 'Маркетолог', owner_viewer: 'Собственник' } as Record<string, string>)[r] ?? r;
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
