import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronRight, TrendingDown, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import AdminPageIntro from '../../components/AdminPageIntro';

interface MarketerRow {
  marketerUserId: string;
  fullName: string;
  email: string;
  avgScore: number | null;
  totalValidations: number;
  regexViolations: number;
  llmJudgeFlags: number;
  methodologyViolations: number;
  humanOverrideCount: number;
}

// INSIGHTS C-delta-13 (Коробовцев): средний балл валидатора за 30 дней.
// Low score → консультация Чиркова или доп-тренинг по industry_gotchas.
export default function MarketerQualityPage() {
  const [rows, setRows] = useState<MarketerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketerRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<MarketerRow[]>('/observability/marketer-quality');
        setRows(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Сводные метрики для хедера
  const summary = useMemo(() => {
    const scores = rows.map((r) => r.avgScore).filter((s): s is number => s != null);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const lowCount = scores.filter((s) => s < 0.6).length;
    const totalValidations = rows.reduce((sum, r) => sum + r.totalValidations, 0);
    return { avg, lowCount, totalValidations, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={BarChart3}
        title="Качество маркетологов"
        whatIs="Средний балл от валидатора по каждому маркетологу за последние 30 дней. 1.0 — идеально, 0.6 — тревожно, ниже — плохо."
        whyForYou="Увидеть, кто часто нарушает канон методологии. Кликните строку — покажет разбор по типам нарушений и подскажет: провести консультацию или дать дополнительный тренинг."
        whenToOpen="Раз в месяц, перед платёжным днём — чтобы знать, кого можно рекомендовать новым клиентам, а кого не стоит."
      />

      {/* Разбор легенды колонок — без этого 4 heatmap-столбца выглядят как абракадабра. */}
      <div className="rounded-2xl border border-[#E7E5E4] bg-white p-4 text-[13px] leading-relaxed">
        <p className="text-[#57534E] mb-2">
          <span className="font-semibold text-[#1A1A1A]">Как читать таблицу.</span>
          {' '}
          В каждой клетке — число нарушений. Чем темнее фон — тем чаще маркетолог попадает
          в эту проблему относительно коллег.
        </p>
        <ul className="space-y-1 text-[#57534E]">
          <li><span className="inline-block w-2 h-2 rounded-full bg-[#EF4444] align-middle mr-2" /><strong>Стоп-слова</strong> — маркетолог использует запрещённые формулировки («лучший», «инновационный», отраслевые штампы).</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-[#EAB308] align-middle mr-2" /><strong>Claude-критик против</strong> — второй Claude проверил текст и сказал «слабо».</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-[#4F46E5] align-middle mr-2" /><strong>Не по методологии</strong> — нарушен канон Чиркова (формула позиционирования, миссия без клиента и т.п.).</li>
          <li><span className="inline-block w-2 h-2 rounded-full bg-[#78716C] align-middle mr-2" /><strong>Проигнорировал валидатор</strong> — маркетолог увидел красный сигнал и всё равно отправил. Не всегда плохо, но требует внимания.</li>
        </ul>
      </div>

      {/* Summary tiles */}
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryTile
            label="Маркетологов"
            value={summary.count}
            icon={Users}
          />
          <SummaryTile
            label="Средний балл"
            value={summary.avg != null ? summary.avg.toFixed(2) : '—'}
            tone={summary.avg != null && summary.avg >= 0.8 ? 'success' : summary.avg != null && summary.avg < 0.6 ? 'danger' : 'warning'}
            icon={summary.avg != null && summary.avg >= 0.8 ? TrendingUp : TrendingDown}
          />
          <SummaryTile
            label="Всего проверок"
            value={summary.totalValidations}
          />
          <SummaryTile
            label="В тревожной зоне (ниже 0.6)"
            value={summary.lowCount}
            tone={summary.lowCount > 0 ? 'danger' : 'success'}
          />
        </div>
      )}

      {/* Heatmap table */}
      <Card>
        {loading ? (
          <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Пока не по чему судить"
            description="Ни один маркетолог ещё не отправил артефакт через валидатор. После первых Claude-вызовов на Стадиях 1–3 здесь появится таблица — по строке на маркетолога."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF9] text-left border-b border-[#E7E5E4]">
                <tr>
                  <Th>Маркетолог</Th>
                  <Th className="tabular-nums">Балл</Th>
                  <Th className="tabular-nums">Проверок</Th>
                  <HeatTh label="Стоп-слова" tone="danger" />
                  <HeatTh label="Claude-критик против" tone="warning" />
                  <HeatTh label="Не по методологии" tone="primary" />
                  <HeatTh label="Игнор валидатора" tone="neutral" />
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F4]">
                {rows.map((r) => (
                  <tr
                    key={r.marketerUserId}
                    onClick={() => setSelected(r)}
                    className="hover:bg-[#EEF2FF] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1A1A1A]">{r.fullName || '—'}</p>
                      <p className="text-[#A8A29E] text-xs">{r.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={r.avgScore} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-[#44403C]">
                      {r.totalValidations}
                    </td>
                    <HeatCell value={r.regexViolations} max={maxOf(rows, 'regexViolations')} tone="danger" />
                    <HeatCell value={r.llmJudgeFlags} max={maxOf(rows, 'llmJudgeFlags')} tone="warning" />
                    <HeatCell
                      value={r.methodologyViolations}
                      max={maxOf(rows, 'methodologyViolations')}
                      tone="primary"
                    />
                    <HeatCell
                      value={r.humanOverrideCount}
                      max={maxOf(rows, 'humanOverrideCount')}
                      tone="neutral"
                    />
                    <td className="px-4 py-3">
                      <ChevronRight className="w-4 h-4 text-[#A8A29E]" aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Drill-down modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.fullName || 'Детализация'}
        description={selected?.email}
        width={560}
      >
        {selected && <DrillDownBody row={selected} />}
      </Modal>
    </div>
  );
}

// ---- Drill-down ----

function DrillDownBody({ row }: { row: MarketerRow }) {
  const recommendation = useMemo(() => {
    if (row.avgScore == null) return null;
    if (row.avgScore >= 0.8) {
      return { tone: 'success' as const, text: 'Отличная работа. Поддерживать текущий уровень.' };
    }
    if (row.avgScore >= 0.6) {
      return {
        tone: 'warning' as const,
        text: 'Средний уровень. Стоит прогнать ревизию industry_gotchas и пересмотреть топ-3 нарушений.',
      };
    }
    return {
      tone: 'danger' as const,
      text: 'Низкий балл. Нужна консультация Чиркова и доп-тренинг по типу самых частых нарушений.',
    };
  }, [row.avgScore]);

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="flex items-center gap-4">
        <ScoreBadge score={row.avgScore} size="lg" />
        <div>
          <p className="text-xs text-[#78716C]">За 30 дней</p>
          <p className="text-lg font-semibold text-[#1A1A1A]">
            {row.totalValidations} {pluralRu(row.totalValidations, ['валидация', 'валидации', 'валидаций'])}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <p className="uppercase text-[10px] font-semibold text-[#78716C] tracking-[0.08em]">
          Разбор нарушений
        </p>
        <BreakdownRow
          label="Стоп-слова"
          value={row.regexViolations}
          hint="Запрещённые слова из стоп-листа отрасли («лучший», «инновационный» и т.п.)"
          tone="danger"
        />
        <BreakdownRow
          label="Claude-критик против"
          value={row.llmJudgeFlags}
          hint="Второй Claude проверил артефакт и нашёл проблему с качеством"
          tone="warning"
        />
        <BreakdownRow
          label="Не по методологии"
          value={row.methodologyViolations}
          hint="Нарушен канон методологии Чиркова (миссия без клиента, неправильная формула и т.п.)"
          tone="primary"
        />
        <BreakdownRow
          label="Проигнорировал валидатор"
          value={row.humanOverrideCount}
          hint="Маркетолог увидел красный сигнал и всё равно отправил"
          tone="neutral"
        />
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div
          className={[
            'p-4 rounded-xl border text-sm',
            recommendation.tone === 'success' && 'bg-[#F0FDF4] border-[#86EFAC] text-[#15803D]',
            recommendation.tone === 'warning' && 'bg-[#FEFCE8] border-[#FDE047] text-[#A16207]',
            recommendation.tone === 'danger' && 'bg-[#FEF2F2] border-[#FCA5A5] text-[#B91C1C]',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <p className="font-semibold mb-1">Рекомендация</p>
          <p>{recommendation.text}</p>
        </div>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'danger' | 'warning' | 'primary' | 'neutral';
}) {
  const toneColor = {
    danger: 'text-[#B91C1C]',
    warning: 'text-[#A16207]',
    primary: 'text-[#3730A3]',
    neutral: 'text-[#44403C]',
  }[tone];

  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-xl bg-[#FAFAF9] border border-[#F5F5F4]">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1A1A1A]">{label}</p>
        <p className="text-xs text-[#78716C] mt-0.5">{hint}</p>
      </div>
      <span className={['text-2xl font-semibold tabular-nums', toneColor].join(' ')} style={{ fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}

// ---- Cells & badges ----

function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'md' | 'lg' }) {
  if (score == null) {
    return (
      <Badge variant="soft" color="neutral">
        н/д
      </Badge>
    );
  }
  const color: 'success' | 'warning' | 'danger' = score >= 0.8 ? 'success' : score >= 0.6 ? 'warning' : 'danger';
  if (size === 'lg') {
    return (
      <div
        className={[
          'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
          color === 'success' && 'bg-[#F0FDF4] text-[#15803D]',
          color === 'warning' && 'bg-[#FEFCE8] text-[#A16207]',
          color === 'danger' && 'bg-[#FEF2F2] text-[#B91C1C]',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span className="text-xl font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
          {score.toFixed(2)}
        </span>
      </div>
    );
  }
  return (
    <Badge variant="soft" color={color}>
      <span className="tabular-nums font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
        {score.toFixed(2)}
      </span>
    </Badge>
  );
}

function HeatTh({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'primary' | 'neutral' }) {
  const dot = {
    danger: 'bg-[#EF4444]',
    warning: 'bg-[#EAB308]',
    primary: 'bg-[#4F46E5]',
    neutral: 'bg-[#78716C]',
  }[tone];
  return (
    <th className="px-4 py-3 uppercase-mono text-[#78716C] text-left">
      <span className="inline-flex items-center gap-2">
        <span className={['w-1.5 h-1.5 rounded-full', dot].join(' ')} aria-hidden />
        {label}
      </span>
    </th>
  );
}

function HeatCell({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: 'danger' | 'warning' | 'primary' | 'neutral';
}) {
  const ratio = max > 0 ? value / max : 0;
  // Базовый оттенок цвета + уровень насыщенности
  const bg =
    value === 0
      ? 'bg-[#FAFAF9] text-[#A8A29E]'
      : tone === 'danger'
        ? ratio >= 0.66
          ? 'bg-[#FEF2F2] text-[#B91C1C]'
          : ratio >= 0.33
            ? 'bg-[#FEF2F2]/60 text-[#DC2626]'
            : 'bg-[#FEF2F2]/30 text-[#EF4444]'
        : tone === 'warning'
          ? ratio >= 0.66
            ? 'bg-[#FEFCE8] text-[#A16207]'
            : ratio >= 0.33
              ? 'bg-[#FEFCE8]/60 text-[#CA8A04]'
              : 'bg-[#FEFCE8]/30 text-[#EAB308]'
          : tone === 'primary'
            ? ratio >= 0.66
              ? 'bg-[#EEF2FF] text-[#3730A3]'
              : ratio >= 0.33
                ? 'bg-[#EEF2FF]/60 text-[#4338CA]'
                : 'bg-[#EEF2FF]/30 text-[#4F46E5]'
            : ratio >= 0.66
              ? 'bg-[#F5F5F4] text-[#1A1A1A]'
              : 'bg-[#FAFAF9] text-[#44403C]';

  return (
    <td className="px-4 py-3">
      <div
        className={['inline-flex items-center justify-center min-w-[40px] h-8 px-2 rounded-md text-xs font-mono font-semibold tabular-nums', bg].join(' ')}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value}
      </div>
    </td>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={['px-4 py-3 uppercase-mono text-[#78716C] text-left', className].join(' ')}>
      {children}
    </th>
  );
}

// ---- Summary ----

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const toneColor = {
    neutral: 'text-[#1A1A1A]',
    success: 'text-[#15803D]',
    warning: 'text-[#A16207]',
    danger: 'text-[#B91C1C]',
  }[tone];

  return (
    <Card>
      <Card.Body className="py-4">
        <div className="flex items-center justify-between mb-1">
          <p className="uppercase-mono text-[#78716C]">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-[#A8A29E]" aria-hidden />}
        </div>
        <p
          className={['text-3xl font-semibold tabular-nums', toneColor].join(' ')}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {value}
        </p>
      </Card.Body>
    </Card>
  );
}

// ---- utils ----

function maxOf<K extends keyof MarketerRow>(rows: MarketerRow[], key: K): number {
  let m = 0;
  for (const r of rows) {
    const v = r[key];
    if (typeof v === 'number' && v > m) m = v;
  }
  return m;
}

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
