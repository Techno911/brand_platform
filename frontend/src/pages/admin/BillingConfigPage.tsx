import { useEffect, useMemo, useState } from 'react';
import { Wallet, Save, TrendingUp, Calculator } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import AdminPageIntro from '../../components/AdminPageIntro';

interface BillingConfig {
  id: string;
  key: string;
  anthropicCostFactor: string;
  markupPercent: string;
  currencyRateUsdRub: string;
  tokenPricing: Record<
    string,
    { inputPerMillion: number; outputPerMillion: number; cacheWritePerMillion?: number; cacheReadPerMillion?: number }
  >;
  tariffs: Record<
    string,
    {
      monthly_rub: number;
      included_projects: number;
      markup_percent: number;
      sla_hours: number;
      manual_review_hours: number;
      includes_offline_meeting?: boolean;
    }
  >;
}

// Reseller-engine config. Правка триггерит audit event + пересчёт маржи E/S/P.
// Квартальная ревизия anthropic_cost_factor — обязательна (курс USD + tier rebate).
export default function BillingConfigPage() {
  const [cfg, setCfg] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<BillingConfig>('/billing/config');
        setCfg(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveField = async (path: 'cost-factor' | 'markup' | 'rate', value: number, fieldLabel: string) => {
    setSaving(true);
    setMessage(null);
    try {
      // DTO'шки у backend'а разные: cost-factor ждёт {value, reason},
      // markup — {percent}, rate — {rate}. До фикса frontend всегда слал {value}
      // и получал 400 на markup/rate. reason для cost-factor пока захардкожен —
      // UI обоснования добавим отдельным проходом, когда будет заказ на audit-форму.
      const payload =
        path === 'cost-factor' ? { value, reason: 'Квартальная ревизия' }
      : path === 'markup'      ? { percent: value }
                               : { rate: value };
      await http.patch(`/billing/config/${path}`, payload);
      // "Сохранено" — нейтральный грамматический род, подходит и для "Наценка"
      // (ж.р.), и для "Множитель"/"Курс" (м.р.). Раньше было "обновлён",
      // что для наценки смотрелось как "Наценка обновлён".
      setMessage({ kind: 'ok', text: `${fieldLabel} — сохранено, запись в журнале сделана.` });
    } catch (err: any) {
      setMessage({ kind: 'err', text: err?.response?.data?.message || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  const saveTariff = async (key: string) => {
    if (!cfg) return;
    setSaving(true);
    setMessage(null);
    try {
      await http.patch(`/billing/config/tariff/${key}`, cfg.tariffs[key]);
      setMessage({ kind: 'ok', text: `Тариф ${key} обновлён.` });
    } catch (err: any) {
      setMessage({ kind: 'err', text: err?.response?.data?.message || 'Ошибка сохранения' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card variant="elevated">
          <Card.Body>
            <div className="h-4 w-48 bg-[#F5F5F4] rounded animate-pulse mb-3" />
            <div className="h-3 w-80 bg-[#F5F5F4] rounded animate-pulse" />
          </Card.Body>
        </Card>
      </div>
    );
  }

  if (!cfg) {
    return (
      <Card>
        <EmptyState
          icon={Wallet}
          title="Настройки биллинга не найдены"
          description="В базе нет строки с конфигом — обычно её создаёт seed-скрипт backend при первом запуске. Проверьте backend/scripts/seed и логи старта."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={Wallet}
        title="Цены, наценка и тарифы"
        whatIs="Три глобальных коэффициента (множитель стоимости, наценка сверху, курс USD→₽) и параметры 3 тарифов — Economy, Standard, Premium. Любая правка записывается в журнал и сразу же меняет видимую клиентам цену."
        whyForYou="Раз в квартал обязательно пересматривайте множитель стоимости Anthropic — меняется курс рубля и скидки вендора. Здесь же видно, какая у вас реальная маржа на среднем проекте."
        whenToOpen="Каждый квартал — ревизия множителя и курса. При смене тарифной сетки. Или если в отчёте Grafana упала маржа."
      />

      {/* Toast */}
      {message && (
        <div
          role="status"
          className={[
            'px-4 py-3 rounded-2xl border text-sm',
            message.kind === 'ok'
              ? 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C]',
          ].join(' ')}
        >
          {message.text}
        </div>
      )}

      {/* Global factors — 3 range-sliders.
          items-stretch + h-full на SliderField → все три карточки одной высоты,
          кнопка «Сохранить» прижата к низу независимо от длины hint'а. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <SliderField
          label="Множитель стоимости Anthropic"
          hint="Корректор курса USD и скидок вендора. 1.0 = без корректировки."
          value={Number(cfg.anthropicCostFactor)}
          min={0.5}
          max={5}
          step={0.05}
          onChange={(v) => setCfg({ ...cfg, anthropicCostFactor: String(v) })}
          onSave={() => saveField('cost-factor', Number(cfg.anthropicCostFactor), 'Множитель стоимости')}
          saving={saving}
          suffix="×"
        />
        <SliderField
          label="Наценка сверху"
          hint="Процент, который прибавляется к себестоимости токенов."
          value={Number(cfg.markupPercent)}
          min={0}
          max={200}
          step={0.5}
          onChange={(v) => setCfg({ ...cfg, markupPercent: String(v) })}
          onSave={() => saveField('markup', Number(cfg.markupPercent), 'Наценка')}
          saving={saving}
          suffix="%"
        />
        <SliderField
          label="Курс USD → ₽"
          hint="Используется при пересчёте стоимости токенов в рубли."
          value={Number(cfg.currencyRateUsdRub)}
          min={50}
          max={200}
          step={0.5}
          onChange={(v) => setCfg({ ...cfg, currencyRateUsdRub: String(v) })}
          onSave={() => saveField('rate', Number(cfg.currencyRateUsdRub), 'Курс USD → ₽')}
          saving={saving}
          suffix=" ₽"
        />
      </div>

      {/* BP-specific economics (10 клиентов/год × 3 обновления) */}
      <BPEconomicsCard cfg={cfg} />

      {/* Tariffs */}
      <Card>
        <Card.Header>
          <div>
            <Card.Title>Тарифы клиентов</Card.Title>
            <Card.Description>
              Economy — без ручного разбора · Standard — 2 ч разбора на проект · Premium — безлимит + оффлайн-встреча Чиркова.
            </Card.Description>
          </div>
        </Card.Header>
        <ul className="divide-y divide-[#F5F5F4]">
          {Object.entries(cfg.tariffs).map(([key, t]) => (
            <li key={key} className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h4 className="text-base font-semibold text-[#1A1A1A] capitalize">{key}</h4>
                  <Badge variant="soft" color={tariffColor(key)}>
                    {tariffHint(key)}
                  </Badge>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Save}
                  onClick={() => saveTariff(key)}
                  loading={saving}
                >
                  Сохранить
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <SmallField
                  label="Цена, ₽/мес"
                  value={t.monthly_rub}
                  onChange={(v) => setCfg({ ...cfg, tariffs: { ...cfg.tariffs, [key]: { ...t, monthly_rub: v } } })}
                />
                <SmallField
                  label="Проектов в месяц"
                  value={t.included_projects}
                  onChange={(v) =>
                    setCfg({ ...cfg, tariffs: { ...cfg.tariffs, [key]: { ...t, included_projects: v } } })
                  }
                />
                <SmallField
                  label="Наценка, %"
                  value={t.markup_percent}
                  onChange={(v) =>
                    setCfg({ ...cfg, tariffs: { ...cfg.tariffs, [key]: { ...t, markup_percent: v } } })
                  }
                />
                <SmallField
                  label="Ответ в течение, ч"
                  value={t.sla_hours}
                  onChange={(v) => setCfg({ ...cfg, tariffs: { ...cfg.tariffs, [key]: { ...t, sla_hours: v } } })}
                />
                <SmallField
                  label="Ручной разбор, ч (−1 — безлимит)"
                  value={t.manual_review_hours}
                  onChange={(v) =>
                    setCfg({ ...cfg, tariffs: { ...cfg.tariffs, [key]: { ...t, manual_review_hours: v } } })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {/* Token pricing — read-only */}
      <Card>
        <Card.Header>
          <div>
            <Card.Title>Прайс-лист вендоров (USD за 1 млн токенов)</Card.Title>
            <Card.Description>
              Изменяется только через API. Все прошлые цены сохраняются в журнале для аудита.
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Body>
          <pre
            className="font-mono text-xs bg-[#FAFAF9] border border-[#E7E5E4] rounded-xl p-4 overflow-auto leading-relaxed"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
{JSON.stringify(cfg.tokenPricing, null, 2)}
          </pre>
        </Card.Body>
      </Card>
    </div>
  );
}

// ---- BP economics preview (per-client annual cost vs abonentka) ----
//
// Бизнес-модель: 1 клиент = 1 бренд-платформа. Один полный сбор ≈ 180k input + 60k output
// токенов на claude-opus-4-7 (11 промптов × 4 стадии). Ежеквартальное обновление ≈ 30%
// от первоначального объёма (54k input + 18k output). За год: 1 full + N updates.
//
// Намеренно не показываем «маржу 99%» — это было бы враньём. Токены лишь одна статья
// себестоимости; ручной разбор Ани, оффлайн-встречи, SLA — отдельно и гораздо дороже.
// Задача этого блока — показать, что *API-бюджет* мал относительно абонентки, чтобы
// Артём понимал: оптимизация токенов дешевле не сделает BP, а оптимизация процесса —
// сделает.

function BPEconomicsCard({ cfg }: { cfg: BillingConfig }) {
  const [clientsPerYear, setClientsPerYear] = useState(10);
  const [updatesPerClient, setUpdatesPerClient] = useState(3);

  const costFactor = Number(cfg.anthropicCostFactor);
  const rate = Number(cfg.currencyRateUsdRub);
  const opus = cfg.tokenPricing['claude-opus-4-7'] ?? { inputPerMillion: 15, outputPerMillion: 75 };
  const standardMonthly = cfg.tariffs['standard']?.monthly_rub ?? 18_000;

  const econ = useMemo(() => {
    const FULL_INPUT = 180_000;
    const FULL_OUTPUT = 60_000;
    const UPDATE_INPUT = 54_000;
    const UPDATE_OUTPUT = 18_000;

    const inputPerClient = FULL_INPUT + updatesPerClient * UPDATE_INPUT;
    const outputPerClient = FULL_OUTPUT + updatesPerClient * UPDATE_OUTPUT;
    const totalInput = clientsPerYear * inputPerClient;
    const totalOutput = clientsPerYear * outputPerClient;

    const apiCostUsdRaw =
      (totalInput * opus.inputPerMillion + totalOutput * opus.outputPerMillion) / 1_000_000;
    const apiCostRub = apiCostUsdRaw * rate * costFactor;
    const apiPerClientRub = clientsPerYear > 0 ? apiCostRub / clientsPerYear : 0;

    const revenuePerClientRub = standardMonthly * 12;
    const totalRevenueRub = clientsPerYear * revenuePerClientRub;
    const apiShareOfRevenue = totalRevenueRub > 0 ? (apiCostRub / totalRevenueRub) * 100 : 0;

    return {
      inputPerClient,
      outputPerClient,
      apiCostUsdRaw,
      apiCostRub,
      apiPerClientRub,
      revenuePerClientRub,
      totalRevenueRub,
      apiShareOfRevenue,
    };
  }, [clientsPerYear, updatesPerClient, opus.inputPerMillion, opus.outputPerMillion, rate, costFactor, standardMonthly]);

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <Calculator className="w-5 h-5 text-[#4F46E5]" aria-hidden />
          <div>
            <Card.Title>Экономика BP — на одного клиента</Card.Title>
            <Card.Description>
              Один клиент = одна бренд-платформа. Пересобирается раз в квартал. Сравниваем годовые
              AI-расходы с абонентской платой тарифа Standard.
            </Card.Description>
          </div>
        </div>
      </Card.Header>
      <Card.Body className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NumberInputCell
            label="Клиентов в год"
            hint="Сколько новых платформ планируете продать."
            value={clientsPerYear}
            min={1}
            max={200}
            onChange={setClientsPerYear}
          />
          <NumberInputCell
            label="Обновлений на клиента"
            hint="Квартальные пересборки платформы (примерно 30% от первоначального объёма)."
            value={updatesPerClient}
            min={0}
            max={12}
            onChange={setUpdatesPerClient}
          />
        </div>

        {/* Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <EcoTile
            label="API-расход за год"
            value={`≈ ${formatRub(econ.apiCostRub)}`}
            subLabel={`$${econ.apiCostUsdRaw.toFixed(2)} базово × ${costFactor.toFixed(2)} × ${rate.toFixed(0)} ₽`}
            tone="neutral"
          />
          <EcoTile
            label="API на клиента в год"
            value={`≈ ${formatRub(econ.apiPerClientRub)}`}
            subLabel={`${econ.inputPerClient.toLocaleString('ru-RU')} in + ${econ.outputPerClient.toLocaleString('ru-RU')} out токенов`}
            tone="neutral"
          />
          <EcoTile
            label="Выручка с клиента (Standard)"
            value={`${formatRub(econ.revenuePerClientRub)}`}
            subLabel={`${formatRub(standardMonthly)}/мес × 12`}
            tone="primary"
          />
          <EcoTile
            label="Выручка с когорты"
            value={`${formatRub(econ.totalRevenueRub)}`}
            subLabel={`${clientsPerYear} клиентов × абонентка`}
            tone="success"
          />
        </div>

        {/* Honest note */}
        <div className="rounded-xl bg-[#FAFAF9] border border-[#E7E5E4] p-4">
          <p className="text-sm text-[#44403C] leading-relaxed">
            <strong className="text-[#1A1A1A]">
              API-себестоимость ≈ {formatRub(econ.apiPerClientRub)}
            </strong>{' '}
            на клиента в год —{' '}
            {econ.apiShareOfRevenue < 1
              ? 'меньше 1%'
              : `${econ.apiShareOfRevenue.toFixed(1)}%`}{' '}
            от абонентки. Узкое место не в токенах, а в человеческой работе: ручной разбор Ани,
            оффлайн-встречи, SLA. Эта часть себестоимости в расчёт не входит — она живёт в P&L отдельно,
            и оптимизировать BP имеет смысл именно там, а не экономией на моделях.
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}

function EcoTile({
  label,
  value,
  subLabel,
  tone,
}: {
  label: string;
  value: string;
  subLabel: string;
  tone: 'neutral' | 'primary' | 'success';
}) {
  const color =
    tone === 'primary'
      ? 'text-[#4F46E5]'
      : tone === 'success'
        ? 'text-[#15803D]'
        : 'text-[#1A1A1A]';
  return (
    <div className="p-4 rounded-xl bg-[#FAFAF9] border border-[#F5F5F4]">
      <p className="uppercase-mono text-[#78716C] mb-1">{label}</p>
      <p
        className={['text-2xl font-semibold tabular-nums', color].join(' ')}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </p>
      <p className="text-xs text-[#78716C] mt-1">{subLabel}</p>
    </div>
  );
}

function NumberInputCell({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1A1A1A] mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(min);
            return;
          }
          const n = Number(raw);
          if (Number.isFinite(n)) {
            onChange(Math.max(min, Math.min(max, Math.round(n))));
          }
        }}
        className="w-full h-10 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-xl text-sm font-mono tabular-nums
          focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-colors"
        style={{ fontFamily: 'var(--font-mono)' }}
      />
      <p className="text-xs text-[#78716C] mt-1">{hint}</p>
    </div>
  );
}

function formatRub(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace('.', ',')} млн ₽`;
  if (v >= 10_000) return `${Math.round(v / 1_000).toLocaleString('ru-RU')} тыс ₽`;
  return `${Math.round(v).toLocaleString('ru-RU')} ₽`;
}

// ---- Subcomponents ----

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  onSave,
  saving,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onSave: () => void;
  saving: boolean;
  suffix: string;
}) {
  return (
    <Card className="h-full flex flex-col">
      <Card.Body className="flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#1A1A1A] font-mono truncate" style={{ fontFamily: 'var(--font-mono)' }}>
              {label}
            </p>
            <p className="text-xs text-[#78716C] mt-0.5">{hint}</p>
          </div>
          <TrendingUp className="w-4 h-4 text-[#A8A29E]" aria-hidden />
        </div>

        <div className="flex items-baseline gap-1 mb-3">
          <span
            className="text-3xl font-semibold text-[#1A1A1A] tabular-nums"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value}
          </span>
          <span className="text-sm text-[#78716C]">{suffix}</span>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-full accent-[#4F46E5] mb-1"
        />
        <div className="flex justify-between text-xs font-mono text-[#A8A29E] tabular-nums mb-4">
          <span>{min}</span>
          <span>{max}</span>
        </div>

        {/* mt-auto прижимает кнопку к низу — когда hint короче в соседней
            карточке, лишнее пространство растёт сверху, все «Сохранить» на одной линии. */}
        <div className="mt-auto">
          <Button variant="primary" size="sm" iconLeft={Save} onClick={onSave} loading={saving} fullWidth>
            Сохранить
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block uppercase-mono text-[#78716C] mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 bg-[#F5F5F4] border border-[#E7E5E4] rounded-xl text-sm font-mono tabular-nums
          focus:outline-none focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition-colors"
        style={{ fontFamily: 'var(--font-mono)' }}
      />
    </div>
  );
}

function tariffColor(key: string): 'neutral' | 'primary' | 'success' {
  if (key.toLowerCase().includes('premium')) return 'primary';
  if (key.toLowerCase().includes('economy')) return 'neutral';
  return 'success';
}

function tariffHint(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('premium')) return 'Безлимитный разбор + оффлайн-встреча';
  if (k.includes('standard')) return '2 часа разбора на проект';
  if (k.includes('economy')) return 'Без ручного разбора';
  return 'Особый тариф';
}
