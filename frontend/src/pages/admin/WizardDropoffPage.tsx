import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, Inbox } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import AdminPageIntro from '../../components/AdminPageIntro';

interface DropoffRow {
  stage: 1 | 2 | 3 | 4;
  stepKey: string;
  event: string;
  count: number;
  avgTimeOnStepSec: number | null;
}

// INSIGHTS B-12 (Горшков): где маркетолог застревает, жмёт «назад», зовёт поддержку.
// Если шаг — узкое место для ≥3 маркетологов → меняем UX или подсказки.
export default function WizardDropoffPage() {
  const [rows, setRows] = useState<DropoffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<DropoffRow[]>('/observability/wizard-dropoff');
        setRows(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Группировка по стадиям для воронки
  const byStage = useMemo(() => {
    const map = new Map<number, DropoffRow[]>();
    for (const r of rows) {
      const arr = map.get(r.stage) ?? [];
      arr.push(r);
      map.set(r.stage, arr);
    }
    return Array.from(map.entries())
      .map(([stage, items]) => ({
        stage,
        total: items.reduce((s, r) => s + r.count, 0),
        items: items.sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => a.stage - b.stage);
  }, [rows]);

  const maxStageTotal = Math.max(1, ...byStage.map((s) => s.total));

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={TrendingDown}
        title="Где застревают маркетологи"
        whatIs="Воронка по четырём стадиям сборки платформы: сколько раз маркетологи открывают шаг, жмут «назад», зовут поддержку, сколько секунд тратят в среднем."
        whyForYou="Понять, где именно мешает интерфейс. Если 3+ маркетолога застревают на одном и том же шаге — сигнал переделать подсказки или упростить экран."
        whenToOpen="Раз в 2 недели — после накопления 20-30 сессий. Или сразу, если маркетолог жалуется на конкретный шаг."
      />

      {loading ? (
        <Card>
          <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="Пока нет данных о маршруте"
            description="Маркетологи только начинают проходить стадии. После первых 20-30 сессий здесь появится воронка: где возвращаются назад, зовут поддержку или надолго зависают."
          />
        </Card>
      ) : (
        <>
          {/* Funnel per stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {byStage.map((s) => (
              <Card key={s.stage}>
                <Card.Body>
                  <div className="flex items-center justify-between mb-2">
                    <p className="uppercase-mono text-[#78716C]">Стадия {s.stage}</p>
                    <Badge variant="soft" color="primary">
                      {stageLabel(s.stage)}
                    </Badge>
                  </div>
                  <p
                    className="text-3xl font-semibold tabular-nums text-[#1A1A1A] mb-2"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {s.total}
                  </p>
                  <ProgressBar
                    value={(s.total / maxStageTotal) * 100}
                    color="primary"
                    ariaLabel={`Стадия ${s.stage} — ${s.total} событий`}
                  />
                </Card.Body>
              </Card>
            ))}
          </div>

          {/* Detailed table */}
          <Card>
            <Card.Header>
              <div>
                <Card.Title>Детализация по шагам</Card.Title>
                <Card.Description>
                  Сортировка — по убыванию числа событий. Красные строки — частые возвраты или застревания.
                </Card.Description>
              </div>
            </Card.Header>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#FAFAF9] text-left border-b border-[#E7E5E4]">
                  <tr>
                    <Th>Стадия</Th>
                    <Th>Ключ шага</Th>
                    <Th>Что делал</Th>
                    <Th className="tabular-nums">Сколько раз</Th>
                    <Th className="tabular-nums">Среднее, сек</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F5F4]">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="px-4 py-3">
                        <Badge variant="outline" color="primary">
                          {r.stage}
                        </Badge>
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs text-[#1A1A1A]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {r.stepKey || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <EventBadge event={r.event} />
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs tabular-nums text-[#1A1A1A]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {r.count}
                      </td>
                      <td
                        className="px-4 py-3 font-mono text-xs tabular-nums text-[#78716C]"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {r.avgTimeOnStepSec != null ? r.avgTimeOnStepSec.toFixed(0) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function EventBadge({ event }: { event: string }) {
  const label = eventLabel(event);
  // Красный — проблемные сигналы: застревание, поддержка, возврат, блокировка валидатором.
  if (
    event.includes('back') ||
    event.includes('stuck') ||
    event.includes('help') ||
    event.includes('support') ||
    event.includes('next_blocked') ||
    event.includes('rewritten_from_scratch')
  ) {
    return (
      <Badge variant="soft" color="danger">
        {label}
      </Badge>
    );
  }
  // Зелёный — завершение: закрыл стадию, принял черновик.
  if (
    event.includes('left') ||
    event.includes('complete') ||
    event.includes('accepted') ||
    event.includes('submitted')
  ) {
    return (
      <Badge variant="soft" color="success">
        {label}
      </Badge>
    );
  }
  // Синий — открытие/начало.
  if (event.includes('entered') || event.includes('open') || event.includes('start')) {
    return (
      <Badge variant="soft" color="primary">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="soft" color="neutral">
      {label}
    </Badge>
  );
}

// Коды событий из backend маппим в человеческие подписи.
// Реальные типы (см. wizard-step-event.entity.ts): stage_entered, stage_left,
// back_clicked, next_blocked_by_validator, feedback_submitted, ai_draft_accepted,
// ai_draft_rewritten_from_scratch, support_requested, stuck_15min, stuck_60min.
// Неизвестные — показываем с префиксом, чтобы было видно, что пришло новое.
function eventLabel(event: string): string {
  const labels: Record<string, string> = {
    stage_entered: 'Открыл стадию',
    stage_left: 'Завершил стадию',
    back_clicked: 'Нажал «назад»',
    next_blocked_by_validator: 'Валидатор не пустил дальше',
    feedback_submitted: 'Оставил фидбек',
    ai_draft_accepted: 'Принял черновик AI',
    ai_draft_rewritten_from_scratch: 'Переписал черновик с нуля',
    support_requested: 'Позвал поддержку',
    stuck_15min: 'Застрял на 15 минут',
    stuck_60min: 'Застрял на час',
    // Старые/альтернативные коды на всякий случай:
    step_open: 'Открыл шаг',
    step_start: 'Начал шаг',
    step_complete: 'Завершил шаг',
    step_back: 'Нажал «назад»',
    step_stuck: 'Застрял',
    help_request: 'Позвал поддержку',
    skip: 'Пропустил',
    retry: 'Повторил',
    cancel: 'Отменил',
  };
  return labels[event] ?? `Неизвестное событие (${event})`;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={['px-4 py-3 uppercase-mono text-[#78716C] text-left', className].join(' ')}>
      {children}
    </th>
  );
}

function stageLabel(stage: number): string {
  return ({ 1: 'Портрет', 2: 'Легенда', 3: 'Позиционирование', 4: 'Финал' } as Record<number, string>)[stage] ?? '—';
}
