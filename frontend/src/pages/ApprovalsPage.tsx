import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle2, ShieldCheck, MessageSquare, Edit3, FileText, Clock,
  AlertCircle,
} from 'lucide-react';
import { http } from '../api/http';
import type { ApprovalRecord } from '../types/api';
import { useAuthStore } from '../store/auth';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import SuggestionMark from '../components/ui/SuggestionMark';

// Моковые suggestions для демонстрации паттерна (бекенд-эндпоинт comments в roadmap).
// В production — заменить на реальный GET /projects/:id/suggestions.
interface Suggestion {
  id: string;
  author: string;
  text: string;
  comment: string;
  status: 'open' | 'resolved' | 'rejected';
  createdAt: string;
}

export default function ApprovalsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.projectRoles?.some((r) => r.projectId === id && r.role === 'owner_viewer');
  const isAdmin = user?.globalRole === 'chip_admin';

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await http.get<ApprovalRecord[]>(`/wizard/projects/${id}/approvals`);
        setApprovals(res.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 7 артефактов канона 3.1, ключи = backend enum ApprovalArtifact.
  const artifactList = useMemo(() => [
    { key: 'legend', label: 'Легенда бренда', stage: 2 as const },
    { key: 'values', label: 'Ценности', stage: 2 as const },
    { key: 'mission', label: 'Миссия', stage: 2 as const },
    { key: 'vision', label: 'Видение', stage: 2 as const },
    { key: 'archetype_and_positioning', label: 'Архетип и позиционирование', stage: 3 as const },
    { key: 'brand_message', label: 'Бренд-месседж', stage: 4 as const },
    { key: 'final_document', label: 'Финальный документ', stage: 4 as const },
  ], []);

  const artifactLabel = useMemo(
    () => Object.fromEntries(artifactList.map((a) => [a.key, a.label])),
    [artifactList],
  );

  const approvedMap = useMemo(
    () => new Map(approvals.map((a) => [a.artifact, a])),
    [approvals],
  );

  // Mock suggestions for demo. В production — GET `/projects/:id/artifacts/:key/suggestions`.
  const suggestions: Suggestion[] = useMemo(() => {
    if (selectedArtifact !== 'brand_message') return [];
    return [
      {
        id: 's1', author: 'Маркетолог',
        text: 'техник', comment: 'Вместо «техник» хочу попробовать «мастер» — звучит менее безлико.',
        status: 'open', createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 's2', author: 'Артём (ЧиП)',
        text: 'до идеала', comment: 'Сильная формулировка, но проверил на онбординг-тесте — слово «идеал» прочитывают как клише.',
        status: 'open', createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      },
    ];
  }, [selectedArtifact]);

  const approveArtifact = async (artifact: string) => {
    if (!id) return;
    setApproving(true); setError('');
    try {
      const res = await http.post<ApprovalRecord>(`/wizard/approvals`, {
        projectId: id,
        artifact,
        responsibleUserId: user?.id,
      });
      setApprovals([res.data, ...approvals]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось зафиксировать утверждение');
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Info header */}
      <Card>
        <Card.Body>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A] mb-0.5">Утверждения собственника</p>
              <p className="text-[#78716C] text-sm leading-relaxed">
                Вы подписываете финальные формулировки бренда. Нажав «Одобряю», вы фиксируете
                текст как утверждённый: он уходит в бренд-книгу, от него отталкиваются миссия,
                позиционирование и месседж. Отменить решение нельзя — только выпустить новую версию.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <div role="alert"
          className="mt-4 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#B91C1C] flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {/* Layout: 280 / flex / 320 */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-6 mt-6 pb-24">
        {/* Left: artifacts list */}
        <aside>
          <Card>
            <Card.Header>
              <Card.Title>Артефакты</Card.Title>
            </Card.Header>
            <Card.Body className="!px-3 !py-2">
              <ul className="space-y-0.5">
                {artifactList.map((a) => {
                  const isApproved = approvedMap.has(a.key);
                  const isSelected = selectedArtifact === a.key;
                  return (
                    <li key={a.key}>
                      <button
                        onClick={() => setSelectedArtifact(a.key)}
                        className={`w-full text-left rounded-lg px-3 py-2 transition-colors
                          flex items-start gap-2 ${
                            isSelected
                              ? 'bg-[#EEF2FF]'
                              : 'hover:bg-[#F5F5F4]'
                          }`}
                        aria-pressed={isSelected}
                      >
                        {isApproved ? (
                          <CheckCircle2 className="w-4 h-4 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
                        ) : (
                          <Clock className="w-4 h-4 text-[#A8A29E] flex-shrink-0 mt-0.5" aria-hidden />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="uppercase-mono text-[#78716C]">
                            Стадия {a.stage} · {isApproved ? 'утверждено' : 'на ревью'}
                          </p>
                          <p className={`text-sm font-medium truncate mt-0.5 ${
                            isSelected ? 'text-[#3730A3]' : 'text-[#1A1A1A]'
                          }`}>
                            {a.label}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card.Body>
          </Card>

          {/* History */}
          <div className="mt-4">
            <Card>
              <Card.Header>
                <Card.Title>История подписей</Card.Title>
              </Card.Header>
              <Card.Body className="!px-3 !py-2">
                {loading ? (
                  <p className="px-3 py-2 text-xs text-[#78716C]">Загружаем…</p>
                ) : approvals.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-[#78716C]">Пока пусто.</p>
                ) : (
                  <ul className="space-y-2">
                    {approvals.slice(0, 5).map((a) => (
                      <li key={a.id} className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <CheckCircle2 className="w-3 h-3 text-[#22C55E]" aria-hidden />
                          <p className="text-xs font-medium truncate text-[#1A1A1A]">
                            {artifactLabel[a.artifact] ?? a.artifact}
                          </p>
                        </div>
                        {isAdmin && (
                          <p className="text-[10px] font-mono text-[#78716C] truncate" title="Подпись документа (SHA-256)">
                            {a.snapshotHash.slice(0, 16)}…
                          </p>
                        )}
                        <p className="text-[10px] text-[#A8A29E] mt-0.5">
                          {new Date(a.approvedAt).toLocaleString('ru-RU')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card.Body>
            </Card>
          </div>
        </aside>

        {/* Center: document view */}
        <div>
          {selectedArtifact ? (
            <DocumentView
              artifactKey={selectedArtifact}
              artifactLabel={artifactList.find((a) => a.key === selectedArtifact)?.label ?? ''}
              stage={artifactList.find((a) => a.key === selectedArtifact)?.stage ?? 2}
              approval={approvedMap.get(selectedArtifact) ?? null}
              suggestions={suggestions}
              activeSuggestion={activeSuggestion}
              onFocusSuggestion={setActiveSuggestion}
            />
          ) : (
            <Card>
              <Card.Body>
                <EmptyState
                  icon={FileText}
                  title="Выберите артефакт"
                  description="Слева — список артефактов, требующих или уже получивших утверждение. Кликните, чтобы открыть документ."
                />
              </Card.Body>
            </Card>
          )}
        </div>

        {/* Right: threads */}
        <aside>
          <Card>
            <Card.Header>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#4F46E5]" aria-hidden />
                <Card.Title>Обсуждение</Card.Title>
              </div>
            </Card.Header>
            <Card.Body>
              {suggestions.length === 0 ? (
                <EmptyState
                  compact
                  icon={MessageSquare}
                  title="Нет комментариев"
                  description="Выделите фрагмент в документе, чтобы оставить предложение."
                />
              ) : (
                <ul className="space-y-3">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setActiveSuggestion(s.id)}
                        className={`w-full text-left rounded-xl p-3 transition-colors border ${
                          activeSuggestion === s.id
                            ? 'bg-[#EEF2FF] border-[#4F46E5]'
                            : 'bg-white border-[#E7E5E4] hover:bg-[#FAFAF9]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-[#1A1A1A]">{s.author}</span>
                          <Badge variant="soft" color={
                            s.status === 'resolved' ? 'success'
                              : s.status === 'rejected' ? 'neutral'
                              : 'warning'
                          }>
                            {s.status === 'open' ? 'открыт' : s.status === 'resolved' ? 'решён' : 'отклонён'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-[#78716C] mb-1.5">
                          «{s.text}»
                        </p>
                        <p className="text-xs text-[#44403C] leading-relaxed">{s.comment}</p>
                        <p className="text-[10px] text-[#A8A29E] mt-2">
                          {new Date(s.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>

          {/* Быстрое утверждение — только для chip_admin (ручной режим).
              Собственник подписывает через StickyActionBar внизу. */}
          {isAdmin && (
            <div className="mt-4">
              <ManualApprove onApprove={approveArtifact} approving={approving} />
            </div>
          )}
        </aside>
      </div>

      {/* Sticky bottom action bar (owner/admin, на выбранном неподписанном артефакте) */}
      {selectedArtifact && (isOwner || isAdmin) && !approvedMap.has(selectedArtifact) && (
        <StickyActionBar
          artifactKey={selectedArtifact}
          onApprove={() => approveArtifact(selectedArtifact)}
          approving={approving}
        />
      )}
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// DocumentView — reader-mode документ с SuggestionMark
// ———————————————————————————————————————————————————————————————

function DocumentView({
  artifactKey,
  artifactLabel,
  stage,
  approval,
  suggestions,
  activeSuggestion,
  onFocusSuggestion,
}: {
  artifactKey: string;
  artifactLabel: string;
  stage: 2 | 3 | 4;
  approval: ApprovalRecord | null;
  suggestions: Suggestion[];
  activeSuggestion: string | null;
  onFocusSuggestion: (id: string | null) => void;
}) {
  const approved = !!approval;
  const content = renderSnapshot(approval?.snapshotContent);
  const suggestionMap = new Map(suggestions.map((s) => [s.text, s]));

  // Простой renderer — ищем text suggestions в контенте и заменяем на SuggestionMark.
  // Разбиваем по \n\n на абзацы, чтобы многострочный snapshot читался как документ.
  // В production — используем ProseMirror/Tiptap с inline-marks.
  const rendered = useMemo(() => {
    const paragraphs = content.split(/\n{2,}/);
    return paragraphs.map((para, pIdx) => {
      let remaining = para;
      const out: React.ReactNode[] = [];
      let key = 0;
      while (remaining.length > 0) {
        let nextIdx = -1;
        let nextText = '';
        let nextSuggestion: Suggestion | null = null;
        for (const [text, sugg] of suggestionMap.entries()) {
          const idx = remaining.indexOf(text);
          if (idx !== -1 && (nextIdx === -1 || idx < nextIdx)) {
            nextIdx = idx;
            nextText = text;
            nextSuggestion = sugg;
          }
        }
        if (nextIdx === -1 || !nextSuggestion) {
          out.push(<span key={key++}>{remaining}</span>);
          break;
        }
        if (nextIdx > 0) out.push(<span key={key++}>{remaining.slice(0, nextIdx)}</span>);
        out.push(
          <SuggestionMark
            key={key++}
            id={nextSuggestion.id}
            author={nextSuggestion.author}
            status={nextSuggestion.status}
            active={activeSuggestion === nextSuggestion.id}
            onFocus={onFocusSuggestion}
          >
            {nextText}
          </SuggestionMark>
        );
        remaining = remaining.slice(nextIdx + nextText.length);
      }
      return <p key={`p-${pIdx}`}>{out}</p>;
    });
  }, [content, suggestionMap, activeSuggestion, onFocusSuggestion]);

  const meta = approved
    ? `Утверждено · ${new Date(approval!.approvedAt).toLocaleString('ru-RU')}`
    : 'Черновик · ожидает вашей подписи';

  return (
    // Paper-on-surface: document ощущается как бумага на рабочем столе.
    <div className="bg-[#FAFAF9] rounded-[20px] border border-[#E7E5E4] p-6 sm:p-10">
      <article
        className="max-w-[720px] mx-auto bg-white border border-[#E7E5E4] rounded-[20px]
          px-8 sm:px-14 py-10 sm:py-12 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <header className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div className="min-w-0">
            <p className="uppercase-mono text-[#78716C]">Стадия {stage} · Артефакт бренда</p>
            <p className="text-[13px] text-[#78716C] mt-1">{meta}</p>
          </div>
          {approved ? (
            <Badge variant="soft" color="success" icon={CheckCircle2}>
              Утверждено
            </Badge>
          ) : (
            <Badge variant="soft" color="warning" icon={Clock}>
              На ревью
            </Badge>
          )}
        </header>

        <h2
          className="font-display text-[28px] sm:text-[30px] text-[#1A1A1A]
            tracking-[-0.02em] leading-tight mb-7"
        >
          {artifactLabel}
        </h2>

        {content ? (
          <div className="text-[16px] leading-[1.75] text-[#1A1A1A] space-y-4 mb-0">
            {rendered}
          </div>
        ) : (
          <p className="text-[15px] text-[#78716C] italic">
            Формулировка появится здесь, как только маркетолог доведёт черновик до зелёного статуса.
            Пока нечего утверждать — зайдите в мастер Стадии {stage}.
          </p>
        )}

        {!approved && content && (
          <div
            className="mt-7 px-4 py-3 rounded-lg bg-[#FEFCE8] border-l-[3px] border-[#EAB308]
              text-[13px] text-[#713F12] leading-relaxed"
            role="note"
          >
            <b>Подпись финальная.</b> Отменить нельзя — чтобы внести изменения потом, нужно выпустить
            новую версию и переподписать.
          </div>
        )}
      </article>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// renderSnapshot — превращает snapshotContent из approval в читаемый абзац.
// Бекенд может положить что угодно (строка, {text}, {legend, mission, ...}),
// поэтому нормализуем аккуратно, без падений.
// ———————————————————————————————————————————————————————————————

function renderSnapshot(snap: Record<string, any> | null | undefined): string {
  if (!snap) return '';
  if (typeof snap === 'string') return snap;

  // Приоритетные ключи в порядке «самое конкретное → самое общее».
  const priority = [
    'text', 'final', 'message', 'statement', 'summary',
    'mission', 'vision', 'legend', 'story',
    'positioning', 'archetype', 'value_proposition',
  ];
  for (const k of priority) {
    const v = (snap as any)[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  // Values / список — объединяем в абзац.
  if (Array.isArray((snap as any).values)) {
    return (snap as any).values
      .map((v: any) => (typeof v === 'string' ? v : v?.name ? `${v.name}${v.description ? ` — ${v.description}` : ''}` : ''))
      .filter(Boolean)
      .join('\n\n');
  }

  // Fallback: склеиваем все строковые поля.
  const chunks: string[] = [];
  for (const [k, v] of Object.entries(snap)) {
    if (typeof v === 'string' && v.trim() && !k.startsWith('_')) chunks.push(v.trim());
  }
  return chunks.join('\n\n');
}

// ———————————————————————————————————————————————————————————————
// Sticky bottom action bar — 3 CTAs (GitHub PR pattern)
// ———————————————————————————————————————————————————————————————

function StickyActionBar({
  onApprove,
  approving,
}: {
  artifactKey: string;
  onApprove: () => void;
  approving: boolean;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md
        border-t border-[#E7E5E4] py-3 px-6"
      style={{ paddingLeft: 'calc(var(--sidebar-w, 240px) + 24px)' }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-[#44403C]">
          Подпись финальная — отменить нельзя. Для правок попросите маркетолога выпустить новую версию.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="md" iconLeft={MessageSquare}>
            Оставить комментарий
          </Button>
          <Button variant="secondary" size="md" iconLeft={Edit3}>
            Запросить правки
          </Button>
          <Button
            variant="primary"
            size="md"
            iconLeft={CheckCircle2}
            onClick={onApprove}
            loading={approving}
          >
            Одобрить
          </Button>
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Manual approve (fallback — быстрое утверждение по ключу)
// ———————————————————————————————————————————————————————————————

function ManualApprove({
  onApprove,
  approving,
}: {
  onApprove: (artifact: string) => void;
  approving: boolean;
}) {
  const [artifact, setArtifact] = useState('brand_message');
  // Готовые ключи для быстрой вставки. Покрывают канонический набор артефактов
  // по методологии 3.1 — админ не гадает имена, а кликает вариант. Для
  // небольшого списка это эффективнее выпадающего списка: всё видно сразу.
  const presets: Array<{ key: string; label: string }> = [
    { key: 'legend', label: 'Легенда' },
    { key: 'values', label: 'Ценности' },
    { key: 'mission', label: 'Миссия' },
    { key: 'vision', label: 'Видение' },
    { key: 'archetype_and_positioning', label: 'Архетип/позиция' },
    { key: 'brand_message', label: 'Бренд-месседж' },
    { key: 'final_document', label: 'Финальный документ' },
  ];
  return (
    <Card>
      <Card.Header>
        <Card.Title>Быстрое утверждение</Card.Title>
        <Card.Description>
          Для админа — подписать артефакт от имени собственника (тестирование, пост-фактум).
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Input
          value={artifact}
          onChange={(e) => setArtifact(e.target.value)}
          placeholder="brand_message"
          label="Ключ артефакта"
          hint="Выберите один из семи артефактов канона 3.1: legend, values, mission, vision, archetype_and_positioning, brand_message, final_document."
        />
        {/* Быстрый выбор готовых ключей — клик копирует в Input. Visually лёгкие
            chip'ы, а не полноценные кнопки — акцент остаётся на «Подписать». */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setArtifact(p.key)}
              className={[
                'px-2 py-1 rounded-md text-[11px] font-medium transition-colors',
                artifact === p.key
                  ? 'bg-[#EEF2FF] text-[#4F46E5]'
                  : 'bg-[#F5F5F4] text-[#78716C] hover:bg-[#EEF2FF] hover:text-[#4F46E5]',
              ].join(' ')}
              aria-pressed={artifact === p.key}
              title={p.key}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <Button
            variant="primary"
            size="md"
            fullWidth
            iconLeft={CheckCircle2}
            onClick={() => onApprove(artifact)}
            loading={approving}
          >
            Подписать
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}
