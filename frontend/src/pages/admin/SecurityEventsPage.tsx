import { useEffect, useMemo, useState } from 'react';
import { Shield, ListChecks, ShieldCheck, AlertCircle, AlertTriangle, User as UserIcon, Target, CheckCircle2 } from 'lucide-react';
import { http } from '../../api/http';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Tabs from '../../components/ui/Tabs';
import EmptyState from '../../components/ui/EmptyState';
import AdminPageIntro from '../../components/AdminPageIntro';

// Соответствует backend SecurityEvent entity: type (а не kind), detectedAt (а не createdAt),
// severity = 'low' | 'medium' | 'high' | 'critical'.
// humanScenario — read-friendly описание: кто / что / чем опасно / чем закончилось.
// Живёт в meta.humanScenario, backend заполняет при seed'е или реальной детекции.
interface HumanScenario {
  actorName?: string;
  actorRole?: string;
  whatHappened?: string;
  whyDangerous?: string;
  outcome?: string;
}
interface SecurityEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string | null;
  projectId: string | null;
  matchedPattern: string | null;
  meta: Record<string, any> & { humanScenario?: HumanScenario };
  detectedAt: string;
}

interface ToolWhitelistEntry {
  name: string;
  allowed: boolean;
}

// Backend /security/tool-whitelist возвращает { tools: string[] } — сами whitelist-имена.
// Всё вне списка блокируется автоматически, поэтому каждый entry = allowed:true.
interface ToolWhitelistResponse {
  tools: string[];
}

type Filter = 'all' | 'critical' | 'high' | 'medium' | 'low';

// BriefSanitizer: prompt injection, PII, секреты. Отклонённые tool-calls. Jailbreak detection.
// Critical → Telegram chip_admin немедленно.
export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [tools, setTools] = useState<ToolWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    (async () => {
      try {
        const [eventsRes, toolsRes] = await Promise.all([
          http.get<SecurityEvent[]>('/security/events').catch(() => ({ data: [] as SecurityEvent[] })),
          http
            .get<ToolWhitelistResponse>('/security/tool-whitelist')
            .catch(() => ({ data: { tools: [] } as ToolWhitelistResponse })),
        ]);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
        // Backend отдаёт { tools: string[] }. Каждое имя в списке — allowed; всё вне списка
        // блокируется ToolCallSandboxService. Поэтому allowed:true для каждого.
        const toolNames = Array.isArray(toolsRes.data?.tools) ? toolsRes.data.tools : [];
        setTools(toolNames.map((name) => ({ name, allowed: true })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredEvents = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.severity === filter)),
    [events, filter],
  );

  const counts = useMemo(
    () => ({
      all: events.length,
      critical: events.filter((e) => e.severity === 'critical').length,
      high: events.filter((e) => e.severity === 'high').length,
      medium: events.filter((e) => e.severity === 'medium').length,
      low: events.filter((e) => e.severity === 'low').length,
    }),
    [events],
  );

  return (
    <div className="space-y-6">
      <AdminPageIntro
        icon={Shield}
        title="События безопасности"
        whatIs="Журнал опасных сигналов: попытки внедрить команды в промпт, утечки личных данных, попытки обойти ограничения. Обычная работа сюда не попадает."
        whyForYou="Понять, кто и как пробует сломать систему. Если одно и то же срабатывает 3+ раза от одного юзера — повод отключить доступ или разобраться лично."
        whenToOpen="Сразу после Telegram-алерта на событии Critical. Раз в неделю — просмотр всех уровней для профилактики."
      />

      {/* Events */}
      <Card>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <Tabs.List className="px-4">
            <Tabs.Tab value="all">Все ({counts.all})</Tabs.Tab>
            <Tabs.Tab value="critical">Критичные ({counts.critical})</Tabs.Tab>
            <Tabs.Tab value="high">Высокие ({counts.high})</Tabs.Tab>
            <Tabs.Tab value="medium">Средние ({counts.medium})</Tabs.Tab>
            <Tabs.Tab value="low">Низкие ({counts.low})</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={filter}>
            {loading ? (
              <div className="p-10 text-center text-[#78716C] text-sm">Загружаем…</div>
            ) : filteredEvents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={
                  filter === 'all'
                    ? 'За 30 дней — ни одного тревожного сигнала'
                    : `События уровня «${severityLabel(filter)}» — нет`
                }
                description="Фильтр безопасности работает. Если событие появится — увидите Telegram-алерт."
              />
            ) : (
              <ul className="divide-y divide-[#F5F5F4]">
                {filteredEvents.map((e) => (
                  <IncidentRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Tool whitelist */}
      <Card>
        <Card.Header>
          <div className="flex items-start gap-3">
            <ListChecks className="w-5 h-5 text-[#4F46E5] mt-0.5" aria-hidden />
            <div>
              <Card.Title>Разрешённые инструменты Claude</Card.Title>
              <Card.Description>
                Список команд, которые Claude может вызывать (draft_value, generate_mission и др.).
                Всё, что не в списке — блокируется автоматически, независимо от вендора.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        {tools.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Список пуст"
            description="Добавьте разрешённые инструменты в backend — без этого Claude вообще ничего не сможет вызвать, а с пустым списком — наоборот, любые попытки пройдут. Проверьте backend/src/security/."
            compact
          />
        ) : (
          <ul className="divide-y divide-[#F5F5F4]">
            {tools.map((t) => (
              <li key={t.name} className="px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className="font-mono text-sm text-[#1A1A1A]"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {t.name}
                  </p>
                </div>
                {t.allowed ? (
                  <Badge variant="soft" color="success" icon={ShieldCheck}>
                    Разрешён
                  </Badge>
                ) : (
                  <Badge variant="soft" color="danger" icon={AlertCircle}>
                    Заблокирован
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: SecurityEvent['severity'] }) {
  if (severity === 'critical') {
    return (
      <Badge variant="solid" color="danger" icon={AlertTriangle}>
        Критично
      </Badge>
    );
  }
  if (severity === 'high') {
    return (
      <Badge variant="soft" color="danger" icon={AlertCircle}>
        Высокий
      </Badge>
    );
  }
  if (severity === 'medium') {
    return (
      <Badge variant="soft" color="warning" icon={AlertCircle}>
        Средний
      </Badge>
    );
  }
  return (
    <Badge variant="soft" color="neutral">
      Низкий
    </Badge>
  );
}

// Русские названия severity — для EmptyState-заголовков.
function severityLabel(sev: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (sev) {
    case 'critical': return 'Критично';
    case 'high': return 'Высокий';
    case 'medium': return 'Средний';
    case 'low': return 'Низкий';
  }
}

// Карточка одного инцидента. Если backend пришёл с meta.humanScenario —
// рендерим человеческий сценарий (кто, что, чем опасно, чем закончилось).
// Иначе fallback: JSON meta (чтобы не терять информацию при новом типе события).
function IncidentRow({ event }: { event: SecurityEvent }) {
  const scenario = event.meta?.humanScenario;
  const hasScenario = Boolean(
    scenario && (scenario.actorName || scenario.whatHappened || scenario.whyDangerous || scenario.outcome),
  );
  return (
    <li className="px-6 py-5 hover:bg-[#FAFAF9] transition-colors">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" color="primary">{eventTypeLabel(event.type)}</Badge>
          <SeverityBadge severity={event.severity} />
        </div>
        <span className="text-[#78716C] text-xs">
          {event.detectedAt ? new Date(event.detectedAt).toLocaleString('ru-RU') : '—'}
        </span>
      </div>

      {hasScenario ? (
        <div className="space-y-2.5 text-[13px] leading-relaxed">
          <div className="flex items-start gap-2">
            <UserIcon className="w-4 h-4 text-[#1A1A1A] mt-0.5 flex-shrink-0" aria-hidden />
            <p className="text-[#1A1A1A]">
              <strong>{scenario?.actorName ?? 'Неизвестный'}</strong>
              {scenario?.actorRole ? <span className="text-[#78716C]"> ({scenario.actorRole})</span> : null}
            </p>
          </div>
          {scenario?.whatHappened && (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#A16207] mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-[#1A1A1A]">{scenario.whatHappened}</p>
            </div>
          )}
          {scenario?.whyDangerous && (
            <div className="flex items-start gap-2">
              <Target className="w-4 h-4 text-[#B91C1C] mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-[#B91C1C]">
                <strong>Чем опасно.</strong> {scenario.whyDangerous}
              </p>
            </div>
          )}
          {scenario?.outcome && (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#15803D] mt-0.5 flex-shrink-0" aria-hidden />
              <p className="text-[#15803D]">
                <strong>Чем закончилось.</strong> {scenario.outcome}
              </p>
            </div>
          )}
        </div>
      ) : (
        <pre
          className="text-xs text-[#78716C] bg-[#FAFAF9] rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {JSON.stringify(event.meta ?? {}, null, 2)}
        </pre>
      )}
    </li>
  );
}

// Человеческие подписи для типов событий. Неизвестные — возвращаем как есть,
// чтобы при появлении нового типа было видно, что пришло.
function eventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    prompt_injection_detected: 'Попытка инъекции промпта',
    pii_detected: 'Персональные данные в промпте',
    tool_call_rejected: 'Отклонён вызов инструмента',
    token_bomb_blocked: 'Перегруз токенами',
    jailbreak_marker: 'Попытка джейлбрейка',
    roundtrip_limit_hit: 'Достигнут лимит roundtrip',
    docx_export_denied: 'Экспорт DOCX отклонён',
    budget_exceeded: 'Превышение бюджета',
    gitleaks_triggered: 'Секрет в репозитории',
    semgrep_violation: 'Нарушение статанализа',
    zap_alert: 'Алерт DAST-сканера',
    vendor_fallback_triggered: 'Переключение на резервного вендора',
    project_busy_contention: 'Параллельный вызов проекта',
  };
  return labels[type] ?? type;
}
