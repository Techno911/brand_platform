import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Plus, Building2, UserRound, Mail, Inbox, AlertCircle, ChevronRight,
} from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import AdminPageIntro from '../../components/AdminPageIntro';
import CreateClientWizard from '../../components/admin/CreateClientWizard';

interface User {
  id: string;
  email: string;
  fullName: string;
  globalRole: string | null;
  projectRoles?: Array<{
    projectId: string;
    projectName: string | null;
    role: string;
    isPrimary: boolean;
  }>;
  createdAt: string;
}

// legalForm — техническое поле для биллинга. В UI мы его не спрашиваем у админа, шлём
// дефолт 'ooo'; сменить форму можно потом в БД или через edit API. Так админ заводит
// клиента за 3 секунды, а не заполняет анкету.
interface Client {
  id: string;
  name: string;
  legalForm: 'ooo' | 'ip' | 'self_employed' | 'individual';
}

// 4 роли RBAC:
//   · chip_admin (Чирков, global) — тарифы, биллинг, клиенты-юрлица, CRUD-админ.
//   · tracker (global, 1-3 шт) — operational ops: все проекты + наблюдаемость, без биллинга.
//   · marketer (per-project) — ведёт сессии и пишет черновики.
//   · owner_viewer (per-project) — читает и подписывает.
// Регистрация — через chip_admin или tracker (tracker не может создать chip_admin/tracker).
export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientQuery, setClientQuery] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const [clientWizardOpen, setClientWizardOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  const loadClients = useCallback(async () => {
    const res = await http.get<Client[]>('/clients').catch(() => ({ data: [] as Client[] }));
    setClients(Array.isArray(res.data) ? res.data : []);
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await http.get<User[]>('/users').catch(() => ({ data: [] as User[] }));
    setUsers(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadClients(), loadUsers()]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadClients, loadUsers]);

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => (c.name ?? '').toLowerCase().includes(q));
  }, [clients, clientQuery]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.fullName ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  }, [users, userQuery]);

  // Мастер или отдельная модалка закрылись — перезагружаем оба списка. Wizard может
  // создать и клиента, и 1–2 юзеров за один поток, так что дёргаем оба эндпоинта
  // независимо от того, что именно создавали.
  const handleWizardClose = useCallback(() => {
    setClientWizardOpen(false);
    loadClients();
    loadUsers();
  }, [loadClients, loadUsers]);

  const handleUserCreated = useCallback(() => {
    setUserModalOpen(false);
    loadUsers();
  }, [loadUsers]);

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={Users}
        title="Клиенты и команда"
        whatIs="Справочник клиентских бизнесов и людей в системе — администраторов и трекеров ЧиП, а также маркетологов и собственников со стороны клиентов."
        whyForYou="Завести нового клиента перед стартом проекта, выдать логин и пароль его собственнику и маркетологу, проверить кто у кого в команде."
        whenToOpen="В самом начале работы с новым клиентом. Сразу после подписания договора — до старта Стадии 1."
      />

      {/* Two columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Clients */}
        <Card>
          <Card.Header>
            <Card.Title>Клиенты ({clients.length})</Card.Title>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={() => setClientWizardOpen(true)}
            >
              Новый
            </Button>
          </Card.Header>
          <div className="px-6 pt-4 pb-4">
            <Input
              placeholder="Поиск по названию…"
              value={clientQuery}
              onChange={(e) => setClientQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="px-6 pb-6 text-[#78716C] text-sm">Загружаем…</div>
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={clientQuery ? Inbox : Building2}
              title={clientQuery ? 'По запросу ничего не найдено' : 'Клиентов пока нет'}
              description={
                clientQuery
                  ? 'Попробуйте другое название или очистите фильтр.'
                  : 'Заведите первого клиента — это займёт 3 секунды.'
              }
              action={
                !clientQuery ? (
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setClientWizardOpen(true)}
                  >
                    Добавить клиента
                  </Button>
                ) : undefined
              }
              compact
            />
          ) : (
            <ul className="divide-y divide-[#F5F5F4] max-h-[480px] overflow-auto">
              {filteredClients.map((c) => (
                <li key={c.id}>
                  <Link
                    to={`/admin/clients/${c.id}`}
                    className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-[#FAFAF9] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-[#1A1A1A] truncate">{c.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" color="neutral">
                        {legalFormShort(c.legalForm)}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-[#A8A29E]" aria-hidden />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Users */}
        <Card>
          <Card.Header>
            <Card.Title>Пользователи ({users.length})</Card.Title>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Plus}
              onClick={() => setUserModalOpen(true)}
            >
              Новый
            </Button>
          </Card.Header>
          <div className="px-6 pt-4 pb-4">
            <Input
              placeholder="Поиск по имени или email…"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="px-6 pb-6 text-[#78716C] text-sm">Загружаем…</div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={userQuery ? Inbox : UserRound}
              title={userQuery ? 'Пользователь не найден' : 'Пользователей пока нет'}
              description={
                userQuery
                  ? 'Попробуйте другой запрос.'
                  : 'Создайте логины собственнику клиента и его маркетологу — чтобы они могли работать в системе.'
              }
              action={
                !userQuery ? (
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={Plus}
                    onClick={() => setUserModalOpen(true)}
                  >
                    Добавить пользователя
                  </Button>
                ) : undefined
              }
              compact
            />
          ) : (
            <ul className="divide-y divide-[#F5F5F4] max-h-[480px] overflow-auto">
              {filteredUsers.map((u) => (
                <li key={u.id}>
                  <Link
                    to={`/admin/users/${u.id}`}
                    className="block px-6 py-3 hover:bg-[#FAFAF9] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-[#1A1A1A] truncate">{u.fullName}</p>
                        <p className="text-[#78716C] text-xs flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 flex-shrink-0" aria-hidden />
                          <span className="truncate">{u.email}</span>
                        </p>
                        {/* Проекты — одной чистой строкой через запятую, без пилюль.
                            Причина: пилюли на каждый проект визуально перегружали список
                            и «наезжали» на роль справа на узких экранах. Роль тоже теперь
                            единая справа (см. effectiveUserRole) — зеркалит паттерн
                            трекера/админа, а не дублирует её в каждой плашке. */}
                        {u.projectRoles && u.projectRoles.length > 0 && (
                          <p className="text-[#78716C] text-xs mt-1 truncate">
                            <span className="text-[#A8A29E]">
                              {u.projectRoles.length === 1 ? 'Проект: ' : 'Проекты: '}
                            </span>
                            {u.projectRoles
                              .map((r) => r.projectName ?? '—')
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {effectiveUserRole(u) && <RoleBadge role={effectiveUserRole(u)!} />}
                        <ChevronRight className="w-4 h-4 text-[#A8A29E]" aria-hidden />
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <CreateClientWizard
        open={clientWizardOpen}
        onClose={handleWizardClose}
      />
      <CreateUserModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        onCreated={handleUserCreated}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// CreateUserModal — собственник клиента / маркетолог клиента
// ----------------------------------------------------------------------------
//
// Роль здесь не выбираем: globalRole всегда null (chip_admin/tracker заводятся
// только через seed или миграцию — самопроизвольное повышение привилегий запрещено),
// а marketer/owner_viewer — это project-level роль, назначается на странице проекта.
// Поэтому в форме только логин-пароль-имя. Явная подпись объясняет почему роли тут нет.

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setFullName('');
      setEmail('');
      setPassword('');
      setSaving(false);
      setError('');
    }
  }, [open]);

  const generatePassword = () => {
    // 12 символов, a-zA-Z0-9 — без спецсимволов (меньше шансов накосячить при копировании).
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    const values = new Uint32Array(12);
    crypto.getRandomValues(values);
    for (const v of values) p += alphabet[v % alphabet.length];
    setPassword(p);
  };

  const submit = async () => {
    if (fullName.trim().length < 2) {
      setError('ФИО — минимум 2 символа.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email выглядит некорректно.');
      return;
    }
    if (password.length < 8) {
      setError('Пароль — минимум 8 символов. Можно сгенерировать автоматически.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await http.post('/users', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось создать пользователя.');
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Новый пользователь"
      description="Создайте логин и пароль для собственника клиента или его маркетолога. Роль (собственник / маркетолог) назначите позже на странице конкретного проекта."
      width={480}
    >
      <div className="space-y-4">
        <Input
          label="ФИО"
          placeholder="Анна Маркетолог"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoFocus
        />
        <Input
          label="Email (логин)"
          type="email"
          placeholder="anna@kholst.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-[#1A1A1A]">Пароль</label>
            <button
              type="button"
              onClick={generatePassword}
              className="text-xs font-medium text-[#4F46E5] hover:text-[#3730A3] transition-colors"
            >
              Сгенерировать
            </button>
          </div>
          <Input
            placeholder="Минимум 8 символов"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !saving) submit();
            }}
            hint="После создания передайте пароль человеку лично или через защищённый канал."
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button variant="primary" fullWidth onClick={submit} loading={saving}>
            Создать логин
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function RoleBadge({ role }: { role: string }) {
  const color = roleColor(role);
  return (
    <Badge variant="soft" color={color}>
      {roleLabel(role)}
    </Badge>
  );
}

function roleColor(role: string): 'primary' | 'neutral' | 'success' | 'info' {
  if (role === 'chip_admin') return 'primary';
  if (role === 'tracker') return 'info';
  if (role === 'marketer') return 'success';
  return 'neutral';
}

function roleLabel(role: string): string {
  if (role === 'chip_admin') return 'Администратор';
  if (role === 'tracker') return 'Трекер';
  if (role === 'marketer') return 'Маркетолог';
  if (role === 'owner_viewer') return 'Собственник';
  return role;
}

function legalFormShort(lf: Client['legalForm']): string {
  switch (lf) {
    case 'ooo': return 'ООО';
    case 'ip': return 'ИП';
    case 'self_employed': return 'Самозанятый';
    case 'individual': return 'Физ.лицо';
    default: return '—';
  }
}

// Роль для бейджа справа: global (chip_admin / tracker) выигрывает, иначе
// берём первую из per-project ролей. У пользователей BP обычно одна и та же
// project-роль во всех своих проектах (маркетолог всегда маркетолог, собственник
// всегда собственник), так что [0] достаточно. Если юзер ни в одном проекте не
// состоит и не имеет global-роли — значит он «висячий» (создан, но ещё не назначен)
// и бейдж просто не рисуется.
function effectiveUserRole(u: User): string | null {
  if (u.globalRole) return u.globalRole;
  return u.projectRoles?.[0]?.role ?? null;
}
