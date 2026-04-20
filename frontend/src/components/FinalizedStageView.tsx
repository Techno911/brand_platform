import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CheckCircle2, MessageSquareQuote, Users, Building2, Sparkles, Target, Flag, Compass, Award, ArrowRight } from 'lucide-react';
import { http } from '../api/http';
import type { Project, Row, ApprovalRecord } from '../types/api';
import Card from './ui/Card';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';

// FinalizedStageView — архивный просмотр стадии для завершённого проекта.
//
// Причина: маркетолог/админ кликает в любую стадию завершённого проекта и
// видит пустую форму ввода (Textarea + кнопка «Генерировать»). Контекст уже
// утрачен, вся работа по проекту сделана — нужна ретроспектива, а не рабочая
// форма. Этот компонент рендерится вместо writer-UI, когда `project.status ==
// 'finalized'`, и показывает что было собрано на данной стадии.
//
// Архитектурно это «чтение данных проекта как архива»: rows + approvals с
// бэкенда, группировка по семантике стадии. Никаких POST'ов, никакой генерации.

interface Props {
  projectId: string;
  stage: 1 | 2 | 3 | 4;
}

export default function FinalizedStageView({ projectId, stage }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, r, a] = await Promise.all([
          http.get<Project>(`/projects/${projectId}`),
          http.get<Row[]>(`/wizard/projects/${projectId}/rows`),
          http.get<ApprovalRecord[]>(`/wizard/projects/${projectId}/approvals`),
        ]);
        if (cancelled) return;
        setProject(p.data);
        setRows(r.data);
        setApprovals(a.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-[#F5F5F4] animate-pulse" />
        ))}
      </div>
    );
  }

  const finalizedAt = project?.finalizedAt
    ? new Date(project.finalizedAt).toLocaleDateString('ru-RU')
    : null;

  return (
    <div className="space-y-5">
      {/* Архивный баннер — отличный от ReadOnlyBanner, который для owner_viewer'а
          (там «режим просмотра»). Здесь — «проект завершён, смотрите что было». */}
      <div
        role="status"
        className="rounded-2xl bg-[#ECFDF5] border border-[#A7F3D0] p-4 flex gap-3 text-sm
          text-[#065F46] leading-relaxed"
      >
        <Archive className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1 min-w-0 flex-1">
          <p className="font-semibold text-[#064E3B]">Архивный просмотр</p>
          <p>
            Бренд-платформа завершена{finalizedAt ? ` ${finalizedAt}` : ''}. Редактирование
            недоступно — ниже то, что было собрано на этой стадии.
          </p>
        </div>
        <Link
          to={`/projects/${projectId}`}
          className="flex-shrink-0 text-[#065F46] hover:text-[#064E3B] font-medium
            inline-flex items-center gap-1 self-center"
        >
          К проекту <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {stage === 1 && <Stage1Archive rows={rows} />}
      {stage === 2 && <Stage2Archive rows={rows} approvals={approvals} />}
      {stage === 3 && <Stage3Archive rows={rows} approvals={approvals} />}
      {stage === 4 && <Stage4Archive rows={rows} approvals={approvals} projectId={projectId} />}
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Stage 1: портрет клиента
// ———————————————————————————————————————————————————————————————

function Stage1Archive({ rows }: { rows: Row[] }) {
  const interviews = rows.filter((r) => r.sheet === 1 && r.type === 'interview');
  const reviews = rows.filter((r) => r.sheet === 2 && r.type === 'review');
  const competitors = rows.filter((r) => r.sheet === 3 && r.type === 'competitor');

  if (interviews.length + reviews.length + competitors.length === 0) {
    return (
      <Card>
        <Card.Body>
          <EmptyState
            icon={MessageSquareQuote}
            title="Архив стадии 1 пуст"
            description="В этой стадии не сохранилось собранных данных. Возможно, проект завершён по упрощённому флоу."
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {interviews.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <MessageSquareQuote className="w-4 h-4 text-[#4F46E5]" />
              <Card.Title>Интервью с клиентами ({interviews.length})</Card.Title>
            </div>
          </Card.Header>
          <Card.Body>
            <ul className="space-y-3">
              {interviews.map((r) => {
                const respondent = typeof r.payload?.respondent === 'string' ? r.payload.respondent : 'Клиент';
                const quote = typeof r.payload?.quote === 'string' ? r.payload.quote : '';
                const themes: string[] = Array.isArray(r.payload?.themes)
                  ? r.payload.themes.filter((t: unknown): t is string => typeof t === 'string')
                  : [];
                return (
                  <li key={r.id} className="rounded-xl border border-[#E7E5E4] p-4 bg-white">
                    <p className="text-sm font-medium text-[#1A1A1A]">{respondent}</p>
                    {quote && (
                      <p className="mt-2 text-sm text-[#44403C] leading-relaxed italic">«{quote}»</p>
                    )}
                    {themes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {themes.map((t) => (
                          <Badge key={t} variant="soft" color="primary">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card.Body>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4F46E5]" />
              <Card.Title>Отзывы ({reviews.length})</Card.Title>
            </div>
          </Card.Header>
          <Card.Body>
            <ul className="space-y-3">
              {reviews.map((r) => {
                const source = typeof r.payload?.source === 'string' ? r.payload.source : 'Источник не указан';
                const text = typeof r.payload?.text === 'string' ? r.payload.text : '';
                return (
                  <li key={r.id} className="rounded-xl border border-[#E7E5E4] p-4 bg-white">
                    <p className="uppercase-mono mb-2">{source}</p>
                    <p className="text-sm text-[#44403C] leading-relaxed">{text}</p>
                  </li>
                );
              })}
            </ul>
          </Card.Body>
        </Card>
      )}

      {competitors.length > 0 && (
        <Card>
          <Card.Header>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#4F46E5]" />
              <Card.Title>Конкуренты ({competitors.length})</Card.Title>
            </div>
          </Card.Header>
          <Card.Body>
            <ul className="space-y-3">
              {competitors.map((r) => {
                const name = typeof r.payload?.name === 'string' ? r.payload.name : '—';
                const strength = typeof r.payload?.strength === 'string' ? r.payload.strength : '';
                const weakness = typeof r.payload?.weakness === 'string' ? r.payload.weakness : '';
                const differentiation = typeof r.payload?.differentiation === 'string'
                  ? r.payload.differentiation
                  : (typeof r.finalized?.differentiation === 'string' ? r.finalized.differentiation : '');
                return (
                  <li key={r.id} className="rounded-xl border border-[#E7E5E4] p-4 bg-white">
                    <p className="font-medium text-sm text-[#1A1A1A]">{name}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      {strength && (
                        <div>
                          <p className="uppercase-mono text-[#22C55E]">Сила</p>
                          <p className="text-xs text-[#44403C] leading-relaxed mt-0.5">{strength}</p>
                        </div>
                      )}
                      {weakness && (
                        <div>
                          <p className="uppercase-mono text-[#EF4444]">Слабость</p>
                          <p className="text-xs text-[#44403C] leading-relaxed mt-0.5">{weakness}</p>
                        </div>
                      )}
                    </div>
                    {differentiation && (
                      <p className="text-xs text-[#44403C] leading-relaxed mt-2 pt-2 border-t border-[#F5F5F4]">
                        <span className="font-medium text-[#1A1A1A]">Как отличаемся:</span> {differentiation}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Stage 2: сессия с собственником (легенда, ценности, миссия, видение)
// ———————————————————————————————————————————————————————————————

function Stage2Archive({ rows, approvals }: { rows: Row[]; approvals: ApprovalRecord[] }) {
  const legendFacts = rows.filter((r) => r.sheet === 4 && r.type === 'legend_fact');
  const values = rows.filter((r) => r.sheet === 4 && r.type === 'value');
  const missionVariants = rows.filter((r) => r.sheet === 4 && r.type === 'mission_variant');
  const vision = rows.filter((r) => r.sheet === 4 && r.type === 'vision');

  const legendApproval = approvals.find((a) => a.artifact === 'legend');
  const valuesApproval = approvals.find((a) => a.artifact === 'values');
  const missionApproval = approvals.find((a) => a.artifact === 'mission');
  const visionApproval = approvals.find((a) => a.artifact === 'vision');

  return (
    <div className="space-y-5">
      <ApprovedArtifactCard
        icon={Flag}
        title="Легенда бренда"
        approval={legendApproval}
        rawFallback={legendFacts.map((r) => (r.finalized?.text as string) ?? (r.payload?.fact as string)).filter(Boolean).join('\n\n')}
      />
      <ApprovedArtifactCard
        icon={Sparkles}
        title="Ценности"
        approval={valuesApproval}
        render={(content) => {
          const items: string[] = Array.isArray(content?.items)
            ? content.items.filter((v: unknown): v is string => typeof v === 'string')
            : [];
          if (items.length === 0) {
            // Fallback: собираем из rows если approval.snapshotContent пустой.
            const fromRows = values
              .map((v) => (v.finalized?.value as string) ?? (v.payload?.value as string))
              .filter((x): x is string => typeof x === 'string' && x.length > 0);
            if (fromRows.length === 0) return null;
            return <ValueList items={fromRows} rows={values} />;
          }
          return <ValueList items={items} rows={values} />;
        }}
      />
      <ApprovedArtifactCard
        icon={Target}
        title="Миссия"
        approval={missionApproval}
        rawFallback={(missionVariants[0]?.finalized?.text as string) ?? (missionVariants[0]?.payload?.variant as string) ?? ''}
      />
      <ApprovedArtifactCard
        icon={Compass}
        title="Видение"
        approval={visionApproval}
        rawFallback={(vision[0]?.finalized?.text as string) ?? (vision[0]?.payload?.text as string) ?? ''}
      />
    </div>
  );
}

function ValueList({ items, rows }: { items: string[]; rows: Row[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((v, i) => {
        // Ищем объяснение в rows — если есть, выведем под заголовком.
        const explanation = rows
          .map((r) => r.finalized)
          .find((f) => typeof f?.value === 'string' && f.value.startsWith(v.slice(0, 20)))
          ?.explanation;
        return (
          <li key={i} className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-[#1A1A1A]">{v}</p>
              {typeof explanation === 'string' && (
                <p className="text-xs text-[#78716C] mt-0.5 leading-relaxed">{explanation}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ———————————————————————————————————————————————————————————————
// Stage 3: архетип и позиционирование
// ———————————————————————————————————————————————————————————————

function Stage3Archive({ rows, approvals }: { rows: Row[]; approvals: ApprovalRecord[] }) {
  const archetype = rows.find((r) => r.sheet === 5 && r.type === 'archetype');
  const positioning = rows.find((r) => r.sheet === 5 && r.type === 'positioning');
  const approval = approvals.find((a) => a.artifact === 'archetype_and_positioning');

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#4F46E5]" />
          <Card.Title>Архетип и позиционирование</Card.Title>
        </div>
      </Card.Header>
      <Card.Body>
        {approval ? (
          <div className="space-y-4">
            <div>
              <p className="uppercase-mono mb-1">Архетип</p>
              <p className="text-sm text-[#1A1A1A] font-medium">
                {typeof approval.snapshotContent?.archetype === 'string' ? approval.snapshotContent.archetype : '—'}
              </p>
              {typeof archetype?.finalized?.rationale === 'string' && (
                <p className="text-xs text-[#78716C] mt-1 leading-relaxed">{archetype.finalized.rationale}</p>
              )}
            </div>
            <div className="pt-3 border-t border-[#F5F5F4]">
              <p className="uppercase-mono mb-1">Позиционирование</p>
              <p className="text-sm text-[#1A1A1A] leading-relaxed">
                {typeof approval.snapshotContent?.positioning === 'string' ? approval.snapshotContent.positioning : '—'}
              </p>
              {typeof positioning?.finalized?.proof === 'string' && (
                <p className="text-xs text-[#78716C] mt-1.5 leading-relaxed">
                  <span className="font-medium text-[#1A1A1A]">Доказательство: </span>
                  {positioning.finalized.proof}
                </p>
              )}
            </div>
            <p className="uppercase-mono pt-2">
              Утверждено {new Date(approval.approvedAt).toLocaleDateString('ru-RU')}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Award}
            title="Архетип и позиционирование не утверждены"
            description="Возможно, проект завершён до формального подписания этой стадии."
          />
        )}
      </Card.Body>
    </Card>
  );
}

// ———————————————————————————————————————————————————————————————
// Stage 4: бренд-месседж + финальный документ
// ———————————————————————————————————————————————————————————————

function Stage4Archive({
  rows, approvals, projectId,
}: { rows: Row[]; approvals: ApprovalRecord[]; projectId: string }) {
  const messageApproval = approvals.find((a) => a.artifact === 'brand_message');
  const finalDoc = approvals.find((a) => a.artifact === 'final_document');
  const messageRow = rows.find((r) => r.sheet === 6 && r.type === 'message_variant');

  return (
    <div className="space-y-5">
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-[#4F46E5]" />
            <Card.Title>Бренд-месседж</Card.Title>
          </div>
        </Card.Header>
        <Card.Body>
          {messageApproval ? (
            <div className="space-y-3">
              <p className="text-xl font-display leading-snug text-[#1A1A1A] tracking-[-0.01em]">
                «{typeof messageApproval.snapshotContent?.slogan === 'string' ? messageApproval.snapshotContent.slogan : '—'}»
              </p>
              {typeof messageApproval.snapshotContent?.tone === 'string' && (
                <p className="text-sm text-[#44403C]">
                  <span className="font-medium">Tone of voice: </span>
                  {messageApproval.snapshotContent.tone}
                </p>
              )}
              {Array.isArray(messageApproval.snapshotContent?.stopWords) && messageApproval.snapshotContent.stopWords.length > 0 && (
                <div>
                  <p className="uppercase-mono mb-1.5">Стоп-слова</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(messageApproval.snapshotContent.stopWords as unknown[])
                      .filter((w): w is string => typeof w === 'string')
                      .map((w) => (
                        <Badge key={w} variant="soft" color="danger">{w}</Badge>
                      ))}
                  </div>
                </div>
              )}
              <p className="uppercase-mono pt-2">
                Утверждено {new Date(messageApproval.approvedAt).toLocaleDateString('ru-RU')}
              </p>
            </div>
          ) : messageRow?.finalized?.slogan ? (
            <p className="text-xl font-display leading-snug text-[#1A1A1A]">
              «{String(messageRow.finalized.slogan)}»
            </p>
          ) : (
            <EmptyState
              icon={MessageSquareQuote}
              title="Бренд-месседж не утверждён"
              description="В архиве нет подписанного месседжа."
            />
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#4F46E5]" />
            <Card.Title>Финальный документ</Card.Title>
          </div>
        </Card.Header>
        <Card.Body>
          {finalDoc ? (
            <div className="space-y-2">
              <p className="text-sm text-[#1A1A1A]">
                Бренд-книга утверждена {new Date(finalDoc.approvedAt).toLocaleDateString('ru-RU')}.
              </p>
              {typeof finalDoc.snapshotContent?.pageCount === 'number' && (
                <p className="text-xs text-[#78716C]">
                  Объём: {finalDoc.snapshotContent.pageCount} стр.
                </p>
              )}
              <Link
                to={`/projects/${projectId}`}
                className="inline-flex items-center gap-1.5 text-[#4F46E5] text-sm font-medium
                  hover:text-[#4338CA] mt-2"
              >
                Скачать DOCX/XLSX на странице проекта <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <EmptyState
              icon={Award}
              title="Финальный документ не подписан"
              description="Проект помечен завершённым, но подписи собственника на final_document нет."
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Shared card: одна подписанная запись approvals
// ———————————————————————————————————————————————————————————————

interface ApprovedArtifactCardProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  approval?: ApprovalRecord;
  /** Если content пустой / неформатный — fallback-строка из rows. */
  rawFallback?: string;
  /** Кастомный рендер payload'а (например, список ценностей). */
  render?: (content: Record<string, unknown> | undefined) => React.ReactNode;
}

function ApprovedArtifactCard({ icon: Icon, title, approval, rawFallback, render }: ApprovedArtifactCardProps) {
  const hasApproval = !!approval;
  const text = typeof approval?.snapshotContent?.text === 'string' ? approval.snapshotContent.text : null;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#4F46E5]" />
          <Card.Title>{title}</Card.Title>
        </div>
        {hasApproval && (
          <Badge variant="soft" color="success">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Подписано
          </Badge>
        )}
      </Card.Header>
      <Card.Body>
        {render ? (
          render(approval?.snapshotContent as Record<string, unknown> | undefined) ?? (
            <p className="text-sm text-[#78716C]">Данных нет.</p>
          )
        ) : text ? (
          <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : rawFallback ? (
          <p className="text-sm text-[#44403C] leading-relaxed whitespace-pre-wrap">{rawFallback}</p>
        ) : (
          <p className="text-sm text-[#78716C]">Не утверждено.</p>
        )}
        {hasApproval && (
          <p className="uppercase-mono mt-3">
            Утверждено {new Date(approval!.approvedAt).toLocaleDateString('ru-RU')}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
