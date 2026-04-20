import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Building2, User, Briefcase, CheckCircle2, ArrowRight, ArrowLeft, Sparkles,
  FileText, Link as LinkIcon, Upload, Info,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { http } from '../../api/http';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

// Мастер заведения нового клиента в пять шагов:
// 0. договор (Google Docs URL или «пропустить») → автозаполнение
// 1. название клиента (+ реквизиты из договора, если были)
// 2. собственник
// 3. маркетолог
// 4. готово
//
// Шаги «договор», «собственник», «маркетолог» — опциональные.
//
// Почему мастер, а не три отдельные модалки: раньше было «Новый клиент» → модалка → закрылась →
// зелёный баннер с CTA «создай логин» → ещё одна модалка → закрылась. Пользователь не понимал,
// это конец или только начало. Мастер слепляет всё в один явный поток с прогресс-индикатором.
//
// Почему договор первым: у Чиркова всё хранится в Google Docs, копировать реквизиты руками —
// медленно и с опечатками. Парсер вытаскивает ИНН/ОГРН/адрес/email/телефон + ФИО подписанта одним
// запросом. Пустые поля подсвечиваются warnings[], пользователь дозаполняет на шаге «Клиент».
//
// Rollback-логика: транзакции между endpoint'ами нет. Если упал шаг «собственник» после создания
// клиента — клиент остаётся, юзер нет; мастер показывает ошибку, дальнейшие шаги можно пропустить.
// Это сознательный trade-off: добавлять cross-endpoint транзакцию ради edge-case'а —
// overengineering.

interface CreateClientWizardProps {
  open: boolean;
  onClose: () => void;
  onCompleted?: (clientId: string) => void;
}

interface UserForm {
  fullName: string;
  email: string;
  password: string;
}

// Форма распарсенного договора — зеркало ParsedContract в backend.
interface ParsedContract {
  client: {
    name: string | null;
    legalForm: 'ooo' | 'ip' | 'self_employed' | 'individual' | null;
    inn: string | null;
    ogrn: string | null;
    legalAddress: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
  };
  owner: { fullName: string | null; email: string | null } | null;
  contract: {
    number: string | null;
    signedAt: string | null;
    city: string | null;
    priceRub: number | null;
    termMonths: number | null;
  };
  warnings: string[];
}

// Реквизиты клиента, которые мы отправляем при создании.
// В UI показываются только если пришли из парсера — ручного ввода реквизитов на шаге «Клиент» нет.
interface ClientExtras {
  legalForm: 'ooo' | 'ip' | 'self_employed' | 'individual';
  inn: string | null;
  ogrn: string | null;
  legalAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

type StepKey = 'contract' | 'client' | 'owner' | 'marketer' | 'done';

const STEP_ORDER: StepKey[] = ['contract', 'client', 'owner', 'marketer', 'done'];

const STEP_LABELS: Record<StepKey, string> = {
  contract: 'Договор',
  client: 'Клиент',
  owner: 'Собственник',
  marketer: 'Маркетолог',
  done: 'Готово',
};

const STEP_ICONS: Record<StepKey, LucideIcon> = {
  contract: FileText,
  client: Building2,
  owner: User,
  marketer: Briefcase,
  done: CheckCircle2,
};

export default function CreateClientWizard({
  open,
  onClose,
  onCompleted,
}: CreateClientWizardProps) {
  const navigate = useNavigate();

  const [step, setStep] = useState<StepKey>('contract');
  const [clientName, setClientName] = useState('');
  const [clientExtras, setClientExtras] = useState<ClientExtras>({
    legalForm: 'ooo',
    inn: null,
    ogrn: null,
    legalAddress: null,
    contactEmail: null,
    contactPhone: null,
  });
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [owner, setOwner] = useState<UserForm>({ fullName: '', email: '', password: '' });
  const [ownerCreated, setOwnerCreated] = useState<{ fullName: string; email: string } | null>(null);
  const [marketer, setMarketer] = useState<UserForm>({ fullName: '', email: '', password: '' });
  const [marketerCreated, setMarketerCreated] = useState<{ fullName: string; email: string } | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Сбрасываем весь мастер при закрытии. Если пользователь нажал крестик посередине —
  // следующий раз начнём с чистого листа.
  useEffect(() => {
    if (open) return;
    setStep('contract');
    setClientName('');
    setClientExtras({
      legalForm: 'ooo',
      inn: null,
      ogrn: null,
      legalAddress: null,
      contactEmail: null,
      contactPhone: null,
    });
    setParseWarnings([]);
    setClientId(null);
    setProjectId(null);
    setOwner({ fullName: '', email: '', password: '' });
    setOwnerCreated(null);
    setMarketer({ fullName: '', email: '', password: '' });
    setMarketerCreated(null);
    setSubmitting(false);
    setError('');
  }, [open]);

  // --- actions ---

  /**
   * Применяет распарсенный договор к state: клиентское имя, реквизиты, ФИО/email собственника,
   * warnings[]. Затем переходит на шаг «Клиент», чтобы admin проверил автозаполнение.
   */
  const applyParsedContract = (parsed: ParsedContract) => {
    setClientName(parsed.client.name ?? '');
    setClientExtras({
      legalForm: parsed.client.legalForm ?? 'ooo',
      inn: parsed.client.inn,
      ogrn: parsed.client.ogrn,
      legalAddress: parsed.client.legalAddress,
      contactEmail: parsed.client.contactEmail,
      contactPhone: parsed.client.contactPhone,
    });
    if (parsed.owner) {
      setOwner((prev) => ({
        fullName: parsed.owner?.fullName ?? prev.fullName,
        email: parsed.owner?.email ?? prev.email,
        password: prev.password,
      }));
    }
    setParseWarnings(parsed.warnings ?? []);
  };

  const parseContract = async (gdocUrl: string) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await http.post<ParsedContract>('/clients/parse-contract', { gdocUrl });
      applyParsedContract(res.data);
      setStep('client');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось разобрать договор.');
    } finally {
      setSubmitting(false);
    }
  };

  const skipContract = () => {
    setError('');
    setParseWarnings([]);
    setStep('client');
  };

  const submitClient = async () => {
    const trimmed = clientName.trim();
    if (trimmed.length < 2) {
      setError('Название клиента — минимум 2 символа.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // Отправляем реквизиты, если они пришли из парсера. Пустые поля остаются null.
      const payload: Record<string, unknown> = {
        name: trimmed,
        legalForm: clientExtras.legalForm,
      };
      if (clientExtras.inn) payload.inn = clientExtras.inn;
      if (clientExtras.ogrn) payload.ogrn = clientExtras.ogrn;
      if (clientExtras.legalAddress) payload.legalAddress = clientExtras.legalAddress;
      if (clientExtras.contactEmail) payload.contactEmail = clientExtras.contactEmail;
      if (clientExtras.contactPhone) payload.contactPhone = clientExtras.contactPhone;
      const res = await http.post<{ id: string }>('/clients', payload);
      setClientId(res.data.id);
      setStep('owner');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось создать клиента.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Создаёт user + (при необходимости) дефолтный проект и привязывает user к проекту
   * через ProjectRole. Это критично: раньше wizard'а создавал юзеров через `POST /users`
   * без связи с проектом — потом админ открывал карточку клиента и не видел команду,
   * потому что `ProjectRole` — единственный источник истины по членству (per-project,
   * не per-client). Теперь шаг 3 сразу создаёт проект с рабочим именем = названию
   * клиента, а кнопка «Открыть проект» в финале ведёт на него. Админ переименует,
   * когда согласует окончательное имя с клиентом.
   */
  const submitUser = async (form: UserForm, role: 'owner' | 'marketer') => {
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    if (fullName.length < 2) {
      setError('ФИО — минимум 2 символа.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Email выглядит некорректно.');
      return;
    }
    if (form.password.length < 8) {
      setError('Пароль — минимум 8 символов. Можно сгенерировать автоматически.');
      return;
    }
    if (!clientId) {
      setError('Клиент не создан — вернитесь на предыдущий шаг.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // 1. Создаём пользователя.
      const userRes = await http.post<{ id: string }>('/users', {
        fullName,
        email,
        password: form.password,
      });
      const createdUserId = userRes.data.id;

      // 2. Если проекта ещё нет — создаём дефолтный. Имя = клиент; industry/tariff
      // — разумные дефолты, tracker/chip_admin переименуют и уточнят позже.
      let pid = projectId;
      if (!pid) {
        const projectRes = await http.post<{ id: string }>('/projects', {
          clientId,
          name: clientName.trim(),
          industry: 'other',
          tariff: 'standard',
        });
        pid = projectRes.data.id;
        setProjectId(pid);
      }

      // 3. Привязываем user к проекту. Маркетолог primary по умолчанию; собственник —
      // нет (у owner_viewer флага primary нет в привычном смысле).
      await http.post(`/projects/${pid}/roles`, {
        userId: createdUserId,
        role: role === 'owner' ? 'owner_viewer' : 'marketer',
        isPrimary: role === 'marketer',
      });

      if (role === 'owner') {
        setOwnerCreated({ fullName, email });
        setStep('marketer');
      } else {
        setMarketerCreated({ fullName, email });
        setStep('done');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось создать пользователя.');
    } finally {
      setSubmitting(false);
    }
  };

  const skipOwner = () => {
    setError('');
    setStep('marketer');
  };

  const skipMarketer = () => {
    setError('');
    setStep('done');
  };

  const openClient = () => {
    if (clientId) {
      onCompleted?.(clientId);
      onClose();
      navigate(`/admin/clients/${clientId}`);
    }
  };

  const openProject = () => {
    if (projectId) {
      onCompleted?.(clientId ?? '');
      onClose();
      navigate(`/projects/${projectId}`);
    }
  };

  const finish = () => {
    if (clientId) onCompleted?.(clientId);
    onClose();
  };

  // --- render ---

  const descriptionByStep: Record<StepKey, string> = {
    contract:
      'Киньте ссылку на договор в Google Docs — вытащим название, ИНН, телефон и собственника. Или пропустите, заполним руками.',
    client:
      'Как называется бизнес. Юридическая форма и ИНН заполнятся позже, когда будут документы.',
    owner:
      'Логин для собственника клиента — он утверждает ценности, миссию, месседж. Шаг можно пропустить, если собственник подключится позже.',
    marketer:
      'Логин для маркетолога клиента — он ведёт проект по четырём стадиям. Шаг можно пропустить.',
    done: 'Клиент заведён. Вот что дальше.',
  };

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title={`Шаг ${STEP_ORDER.indexOf(step) + 1} из ${STEP_ORDER.length} — ${STEP_LABELS[step]}`}
      description={descriptionByStep[step]}
      width={680}
      closeOnOverlay={false}
    >
      <StepIndicator step={step} />

      {step === 'contract' && (
        <ContractStep
          onParse={parseContract}
          onSkip={skipContract}
          submitting={submitting}
          error={error}
        />
      )}

      {step === 'client' && (
        <ClientStep
          value={clientName}
          onChange={setClientName}
          extras={clientExtras}
          warnings={parseWarnings}
          onSubmit={submitClient}
          onBack={() => {
            // Возврат на шаг «Договор». Клиент ещё не создан в БД — безопасно.
            // Распарсенные реквизиты оставляем: если пользователь просто захочет
            // перепарсить другую ссылку, applyParsedContract перезапишет state.
            setError('');
            setStep('contract');
          }}
          submitting={submitting}
          error={error}
        />
      )}

      {step === 'owner' && (
        <UserStep
          intro={
            <p className="text-sm text-[#78716C]">
              Собственник видит финальные черновики и утверждает их — без этого у маркетолога не
              появится кнопка «Опубликовать».
            </p>
          }
          form={owner}
          onChange={setOwner}
          onSubmit={() => submitUser(owner, 'owner')}
          onSkip={skipOwner}
          submitting={submitting}
          error={error}
          primaryLabel="Далее — маркетолог"
          skipLabel="Пропустить — добавим потом"
        />
      )}

      {step === 'marketer' && (
        <UserStep
          intro={
            <p className="text-sm text-[#78716C]">
              Маркетолог со стороны клиента — проходит четыре стадии сборки и формулирует
              черновики на основе шаблонов.
            </p>
          }
          form={marketer}
          onChange={setMarketer}
          onSubmit={() => submitUser(marketer, 'marketer')}
          onSkip={skipMarketer}
          submitting={submitting}
          error={error}
          primaryLabel="Готово"
          skipLabel="Пропустить — добавим потом"
        />
      )}

      {step === 'done' && (
        <DoneStep
          clientName={clientName}
          owner={ownerCreated}
          marketer={marketerCreated}
          hasProject={!!projectId}
          onOpenClient={openClient}
          onOpenProject={openProject}
          onFinish={finish}
        />
      )}
    </Modal>
  );
}

// --------------------------------------------------------------------------
// Step indicator (5 dots + connectors)
// --------------------------------------------------------------------------

function StepIndicator({ step }: { step: StepKey }) {
  const currentIdx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-center gap-2 mb-5">
      {STEP_ORDER.map((s, i) => {
        const Icon = STEP_ICONS[s];
        const active = i === currentIdx;
        const passed = i < currentIdx;
        return (
          <div key={s} className="flex items-center gap-2 flex-1 last:flex-none">
            <div
              className={[
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                active
                  ? 'bg-[#4F46E5] text-white'
                  : passed
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : 'bg-[#F5F5F4] text-[#A8A29E]',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
              aria-label={STEP_LABELS[s]}
            >
              <Icon className="w-4 h-4" />
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 rounded-full transition-colors',
                  passed ? 'bg-[#86EFAC]' : 'bg-[#F5F5F4]',
                ].join(' ')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 0 — договор (Google Docs URL либо пропустить)
// --------------------------------------------------------------------------

function ContractStep({
  onParse,
  onSkip,
  submitting,
  error,
}: {
  onParse: (url: string) => void;
  onSkip: () => void;
  submitting: boolean;
  error: string;
}) {
  const [url, setUrl] = useState('');
  const [tab, setTab] = useState<'gdoc' | 'file'>('gdoc');

  const urlLooksValid = /https?:\/\/docs\.google\.com\/document\/d\//.test(url.trim());

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-[#1D4ED8] flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-sm text-[#1E3A8A]">
          Договор откроется только если доступ открыт по ссылке
          <span className="font-medium"> (Share → «Anyone with the link» → Viewer)</span>.
          Парсер вытащит название, реквизиты и ФИО подписанта за 5–10 секунд.
        </p>
      </div>

      {/* Таб-переключатель Google Docs / файл. Файл пока placeholder «скоро» —
          сам endpoint multipart ещё не готов. */}
      <div className="flex gap-2 p-1 bg-[#F5F5F4] rounded-xl">
        <button
          type="button"
          onClick={() => setTab('gdoc')}
          className={[
            'flex-1 h-9 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5',
            tab === 'gdoc'
              ? 'bg-white text-[#1A1A1A] shadow-sm'
              : 'text-[#78716C] hover:text-[#1A1A1A]',
          ].join(' ')}
        >
          <LinkIcon className="w-4 h-4" />
          Google Docs
        </button>
        <button
          type="button"
          onClick={() => setTab('file')}
          className={[
            'flex-1 h-9 rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5',
            tab === 'file'
              ? 'bg-white text-[#1A1A1A] shadow-sm'
              : 'text-[#78716C] hover:text-[#1A1A1A]',
          ].join(' ')}
        >
          <Upload className="w-4 h-4" />
          Файл
        </button>
      </div>

      {tab === 'gdoc' ? (
        <div>
          <Input
            label="Ссылка на договор в Google Docs"
            placeholder="https://docs.google.com/document/d/1WVc_Uiti7..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !submitting && urlLooksValid) onParse(url.trim());
            }}
            hint="Полная ссылка, которую вы копируете из адресной строки после открытия документа."
          />
        </div>
      ) : (
        <div className="rounded-xl bg-[#FAFAF9] border border-dashed border-[#D6D3D1] p-6 text-center">
          <Upload className="w-6 h-6 text-[#A8A29E] mx-auto mb-2" aria-hidden />
          <p className="text-sm font-medium text-[#44403C]">Загрузка файла скоро</p>
          <p className="text-xs text-[#78716C] mt-1">
            Пока поддерживается только ссылка на Google Docs. DOCX/PDF появятся
            в следующем апдейте — пока самый быстрый путь это Docs.
          </p>
        </div>
      )}

      {error && <ErrorBlock message={error} />}

      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onSkip} disabled={submitting}>
          Пропустить — заполню руками
        </Button>
        <Button
          variant="primary"
          onClick={() => onParse(url.trim())}
          loading={submitting}
          disabled={tab !== 'gdoc' || !urlLooksValid}
          iconLeft={Sparkles}
        >
          {submitting ? 'Разбираю договор…' : 'Извлечь данные'}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 1 — client name (+ auto-filled extras + warnings)
// --------------------------------------------------------------------------

function ClientStep({
  value,
  onChange,
  extras,
  warnings,
  onSubmit,
  onBack,
  submitting,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  extras: ClientExtras;
  warnings: string[];
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  error: string;
}) {
  const hasExtras =
    !!extras.inn || !!extras.ogrn || !!extras.legalAddress || !!extras.contactEmail || !!extras.contactPhone;

  return (
    <div className="space-y-4">
      <Input
        label="Название клиента"
        placeholder="Холст"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !submitting) onSubmit();
        }}
        hint="Короткое рабочее название. Полное юрлицо — «ООО Холст» — добавится из документов позже."
      />

      {hasExtras && (
        <div className="rounded-xl bg-[#F0FDF4] border border-[#86EFAC] p-3 space-y-1">
          <p className="text-xs font-semibold text-[#15803D] uppercase tracking-wide">
            Вытащено из договора
          </p>
          <ul className="text-sm text-[#166534] space-y-0.5">
            {extras.inn && <li>ИНН: <span className="font-mono">{extras.inn}</span></li>}
            {extras.ogrn && <li>ОГРН: <span className="font-mono">{extras.ogrn}</span></li>}
            {extras.legalAddress && <li>Адрес: {extras.legalAddress}</li>}
            {extras.contactEmail && <li>Email: {extras.contactEmail}</li>}
            {extras.contactPhone && <li>Телефон: {extras.contactPhone}</li>}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl bg-[#FFFBEB] border border-[#FCD34D] p-3 space-y-1">
          <p className="text-xs font-semibold text-[#92400E] uppercase tracking-wide">
            Что не удалось найти
          </p>
          <ul className="text-sm text-[#78350F] space-y-0.5 list-disc list-inside">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          <p className="text-xs text-[#92400E] mt-1">
            Это можно дозаполнить на карточке клиента после создания.
          </p>
        </div>
      )}

      {error && <ErrorBlock message={error} />}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onBack} disabled={submitting} iconLeft={ArrowLeft}>
          Назад к договору
        </Button>
        <Button
          variant="primary"
          onClick={onSubmit}
          loading={submitting}
          iconRight={ArrowRight}
        >
          Создать клиента
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 2/3 — user (owner or marketer)
// --------------------------------------------------------------------------

function UserStep({
  intro,
  form,
  onChange,
  onSubmit,
  onSkip,
  submitting,
  error,
  primaryLabel,
  skipLabel,
}: {
  intro: ReactNode;
  form: UserForm;
  onChange: (form: UserForm) => void;
  onSubmit: () => void;
  onSkip: () => void;
  submitting: boolean;
  error: string;
  primaryLabel: string;
  skipLabel: string;
}) {
  const generatePassword = () => {
    // 12 символов a-zA-Z0-9, без 0/O/1/l/I — чтобы пароль не путали при переносе голосом.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let p = '';
    const values = new Uint32Array(12);
    crypto.getRandomValues(values);
    for (const v of values) p += alphabet[v % alphabet.length];
    onChange({ ...form, password: p });
  };

  return (
    <div className="space-y-4">
      {intro}
      <Input
        label="ФИО"
        placeholder="Анна Петрова"
        value={form.fullName}
        onChange={(e) => onChange({ ...form, fullName: e.target.value })}
        autoFocus
      />
      <Input
        label="Email (логин)"
        type="email"
        placeholder="anna@kholst.ru"
        value={form.email}
        onChange={(e) => onChange({ ...form, email: e.target.value })}
      />
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-[#1A1A1A]">Пароль</label>
          <button
            type="button"
            onClick={generatePassword}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5] hover:text-[#3730A3] transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Сгенерировать
          </button>
        </div>
        <Input
          placeholder="Минимум 8 символов"
          value={form.password}
          onChange={(e) => onChange({ ...form, password: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !submitting) onSubmit();
          }}
          hint="После создания отправьте логин и пароль в личный Telegram человеку — этого достаточно."
        />
      </div>
      {error && <ErrorBlock message={error} />}
      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={onSkip} disabled={submitting}>
          {skipLabel}
        </Button>
        <Button variant="primary" onClick={onSubmit} loading={submitting} iconRight={ArrowRight}>
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Step 4 — summary + next actions
// --------------------------------------------------------------------------

function DoneStep({
  clientName,
  owner,
  marketer,
  hasProject,
  onOpenClient,
  onOpenProject,
  onFinish,
}: {
  clientName: string;
  owner: { fullName: string; email: string } | null;
  marketer: { fullName: string; email: string } | null;
  hasProject: boolean;
  onOpenClient: () => void;
  onOpenProject: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#F0FDF4] border border-[#86EFAC] p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2
            className="w-5 h-5 text-[#15803D] flex-shrink-0 mt-0.5"
            aria-hidden
          />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium text-[#14532D]">
              Клиент «{clientName}» заведён{hasProject ? ' вместе с первым проектом' : ''}.
            </p>
            {owner && (
              <p className="text-sm text-[#15803D]">
                Собственник: <strong>{owner.fullName}</strong> · {owner.email}
              </p>
            )}
            {marketer && (
              <p className="text-sm text-[#15803D]">
                Маркетолог: <strong>{marketer.fullName}</strong> · {marketer.email}
              </p>
            )}
            {!owner && !marketer && (
              <p className="text-sm text-[#15803D]">
                Собственника и маркетолога добавите позже — прямо с карточки клиента.
              </p>
            )}
          </div>
        </div>
      </div>

      {hasProject && (
        <div className="rounded-xl bg-[#FEF3C7] border border-[#FCD34D] p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#92400E] flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-[#78350F]">
            Проект назван по имени клиента — <strong>«{clientName}»</strong>. Когда согласуете
            окончательное название бренда, переименуйте его на странице проекта.
            Отрасль и тариф тоже стоят дефолтные — поправьте там же.
          </p>
        </div>
      )}

      <div className="rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] p-4 space-y-2">
        <p className="text-sm font-medium text-[#1A1A1A]">Что дальше</p>
        <ul className="text-sm text-[#44403C] space-y-1 list-disc list-inside">
          {hasProject ? (
            <>
              <li>Откройте проект и проверьте название, отрасль, тариф.</li>
              <li>Когда будете готовы — стартуйте Стадию 1.</li>
            </>
          ) : (
            <>
              <li>Откройте карточку клиента — проверьте реквизиты.</li>
              <li>На странице «Проекты» создайте первый проект и стартуйте Стадию 1.</li>
            </>
          )}
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <Button variant="secondary" fullWidth onClick={onFinish}>
          Закрыть
        </Button>
        <Button variant="secondary" fullWidth onClick={onOpenClient}>
          Карточка клиента
        </Button>
        {hasProject && (
          <Button variant="primary" fullWidth onClick={onOpenProject} iconRight={ArrowRight}>
            Открыть проект
          </Button>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Shared error block
// --------------------------------------------------------------------------

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
