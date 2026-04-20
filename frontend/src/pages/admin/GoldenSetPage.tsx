import { useEffect, useMemo, useState } from 'react';
import { Target, Play, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import Tooltip from '../../components/ui/Tooltip';
import AdminPageIntro from '../../components/AdminPageIntro';

interface GoldenCase {
  name: string;
  artifact: string;
  tags: string[];
}

interface GoldenRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  promptVersion: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  regressionDetected: boolean;
  thresholdPercent: number;
}

// Эталон «Белая Линия» + будущие successful projects.
// Walk-forward regression: nightly cron 03:00, порог 15% — CI блокирует merge prompt-изменений.
export default function GoldenSetPage() {
  const [cases, setCases] = useState<GoldenCase[]>([]);
  const [history, setHistory] = useState<GoldenRun[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [casesRes, historyRes] = await Promise.all([
        http.get<GoldenCase[]>('/golden-set/cases'),
        http.get<GoldenRun[]>('/golden-set/history'),
      ]);
      setCases(casesRes.data);
      setHistory(historyRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      await http.post('/golden-set/run', {});
      await load();
    } finally {
      setRunning(false);
    }
  };

  // Summary
  const summary = useMemo(() => {
    const last = history[0];
    const passRate = last && last.totalCases ? (last.passedCases / last.totalCases) * 100 : 0;
    const regressions = history.filter((h) => h.regressionDetected).length;
    return { last, passRate, regressions, totalRuns: history.length };
  }, [history]);

  // Уникальные теги для фильтра индустрии
  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cases) {
      for (const t of c.tags) map.set(t, (map.get(t) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [cases]);

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={Target}
        title="Эталоны — проверка качества платформы"
        whatIs="Проекты, которые прошли идеально — пока только «Белая Линия». Раз в сутки в 03:00 мы заново собираем бренд-платформу на этих эталонах и сравниваем результат с прошлым прогоном."
        whyForYou="Защита от того, что очередная правка промпта тихо ухудшит качество. Если совпадение падает больше чем на 15% — CI блокирует мердж в main."
        whenToOpen="Раз в неделю — убедиться, что прогоны зелёные. Или сразу, если кто-то менял файлы в backend/src/prompts/."
      />

      {/* Summary tiles + CTA */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-stretch">
        <SummaryTile label="Эталонных кейсов" value={cases.length} />
        <SummaryTile
          label="Совпало в последний раз"
          value={summary.last ? `${summary.passRate.toFixed(0)}%` : '—'}
          tone={summary.passRate >= 85 ? 'success' : summary.passRate >= 70 ? 'warning' : 'danger'}
        />
        <SummaryTile
          label="Падений качества"
          value={summary.regressions}
          tone={summary.regressions === 0 ? 'success' : 'danger'}
        />
        <div className="flex">
          <Tooltip
            text="Запустит проверку всех эталонных кейсов против текущих промптов. Обычно 2–5 минут; результат появится в истории ниже."
            position="left"
          >
            <Button
              variant="primary"
              size="lg"
              iconLeft={Play}
              onClick={runNow}
              loading={running}
              className="w-full lg:w-auto"
            >
              {running ? 'Прогон идёт…' : 'Прогнать сейчас'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Two columns: cases + history */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Cases */}
        <Card>
          <Card.Header>
            <div>
              <Card.Title>Эталонные кейсы ({cases.length})</Card.Title>
              <Card.Description>
                Артефакты, с которыми сравниваем: ценности, миссия, позиционирование, финальный месседж.
              </Card.Description>
            </div>
          </Card.Header>
          {tagStats.length > 0 && (
            <div className="px-6 pb-3 flex flex-wrap gap-1.5">
              {tagStats.map((t) => (
                <Badge key={t.tag} variant="soft" color="primary">
                  {tagLabel(t.tag)} · {t.count}
                </Badge>
              ))}
            </div>
          )}
          {loading ? (
            <div className="p-6 text-[#78716C] text-sm">Загружаем…</div>
          ) : cases.length === 0 ? (
            <EmptyState
              icon={Target}
              title="Эталонов пока нет"
              description="Нужно добавить эталонные проекты в backend/test/golden-set/. После этого ночной прогон начнёт сравнивать результаты."
            />
          ) : (
            <ul className="divide-y divide-[#F5F5F4] max-h-[480px] overflow-auto">
              {cases.map((c, i) => (
                // key = name + artifact + index: backend возвращает несколько кейсов
                // с одним именем, но разными artifact/tags (например review-classify
                // прогоняется на каждой стадии). Голый c.name давал React warning
                // «two children with same key».
                <li key={`${c.name}::${c.artifact}::${i}`} className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[#1A1A1A] truncate">{caseLabel(c.name)}</p>
                    <p
                      className="text-[#78716C] text-xs font-mono truncate"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {artifactLabel(c.artifact)}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {c.tags.map((t) => (
                      <Badge key={t} variant="outline" color="primary">
                        {tagLabel(t)}
                      </Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* History */}
        <Card>
          <Card.Header>
            <div>
              <Card.Title>История прогонов</Card.Title>
              <Card.Description>Последние 20 прогонов — процент совпадения и статус.</Card.Description>
            </div>
          </Card.Header>
          {loading ? (
            <div className="p-6 text-[#78716C] text-sm">Загружаем…</div>
          ) : history.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Ещё ни разу не запускали"
              description="Нажмите «Прогнать сейчас», чтобы зафиксировать первый эталонный результат."
              action={
                <Button variant="primary" iconLeft={Play} onClick={runNow} loading={running}>
                  Прогнать сейчас
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-[#F5F5F4] max-h-[480px] overflow-auto">
              {history.map((h) => {
                const percent = h.totalCases ? (h.passedCases / h.totalCases) * 100 : 0;
                const isOk = !h.regressionDetected;
                return (
                  <li key={h.id} className="px-6 py-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className="font-mono text-xs font-medium text-[#1A1A1A] truncate"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {h.promptVersion}
                        </p>
                        <p className="text-[#78716C] text-xs mt-0.5">
                          {new Date(h.startedAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                      {isOk ? (
                        <Badge variant="soft" color="success" icon={CheckCircle2}>
                          В пределах нормы
                        </Badge>
                      ) : (
                        <Badge variant="soft" color="danger" icon={AlertCircle}>
                          Качество упало
                        </Badge>
                      )}
                    </div>
                    <ProgressBar
                      value={percent}
                      color={percent >= 85 ? 'success' : percent >= 70 ? 'warning' : 'danger'}
                      showValue
                      valueSuffix="%"
                      ariaLabel={`Совпало ${percent.toFixed(0)}%`}
                    />
                    <p className="text-[#78716C] text-xs">
                      <span className="font-mono tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                        {h.passedCases}/{h.totalCases}
                      </span>{' '}
                      совпало · допустимое падение — {h.thresholdPercent}%
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- Summary tile ----

// Маппинг машинных ключей из golden-set fixtures → человеческих подписей.
// Покрывает теги, имена кейсов и артефакты. Неизвестное возвращаем как есть —
// чтобы при добавлении нового fixture было видно, что пришло новое.
const TAG_LABELS: Record<string, string> = {
  'stage-1': 'Стадия 1 · Портрет',
  'stage-2': 'Стадия 2 · Легенда и ценности',
  'stage-3': 'Стадия 3 · Позиционирование',
  'stage-4': 'Стадия 4 · Финальный месседж',
  stomatology: 'Стоматология',
  furniture: 'Мебель',
  restaurant: 'Ресторан',
  salon: 'Салон красоты',
  kids_center: 'Детский центр',
  auto_service: 'Автосервис',
  premium: 'Премиум-сегмент',
  economy: 'Эконом-сегмент',
  standard: 'Стандарт',
};

const CASE_LABELS: Record<string, string> = {
  'belaya-liniya.legend': 'Белая Линия — легенда',
  'belaya-liniya.values': 'Белая Линия — ценности',
  'belaya-liniya.mission': 'Белая Линия — миссия',
  'belaya-liniya.positioning': 'Белая Линия — позиционирование',
  'belaya-liniya.message': 'Белая Линия — месседж',
  'belaya-liniya.review-classify.values.cliche': 'Белая Линия — клише в ценностях',
  'belaya-liniya.review-classify.message.too-long': 'Белая Линия — месседж слишком длинный',
  'belaya-liniya.review-classify.mission.money-marker': 'Белая Линия — деньги в миссии',
  'belaya-liniya.review-classify.message.good': 'Белая Линия — эталонный месседж',
  'belaya-liniya.methodology.archetype-not-in-canon': 'Белая Линия — архетип вне канона',
};

const ARTIFACT_LABELS: Record<string, string> = {
  legend: 'Легенда',
  values: 'Ценности',
  mission: 'Миссия',
  positioning: 'Позиционирование',
  brand_message: 'Бренд-месседж',
  message: 'Месседж',
};

function tagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag;
}

function caseLabel(name: string): string {
  return CASE_LABELS[name] ?? name;
}

function artifactLabel(artifact: string): string {
  return ARTIFACT_LABELS[artifact] ?? artifact;
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
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
        <p className="uppercase-mono text-[#78716C] mb-1">{label}</p>
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
