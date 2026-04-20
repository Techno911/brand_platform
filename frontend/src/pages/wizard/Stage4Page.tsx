import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Sparkles, FlaskConical, CheckCircle2, XCircle, Download, FileText,
  AlertCircle, GitCompare, Lightbulb, ArrowRight,
} from 'lucide-react';
import WizardShell from './WizardShell';
import SufflerPanel, { type SufflerHint } from '../../components/SufflerPanel';
import TimeSavedChip from '../../components/TimeSavedChip';
import OnboardingBanner from '../../components/OnboardingBanner';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import FinalizedStageView from '../../components/FinalizedStageView';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import DiffBlock from '../../components/ui/DiffBlock';
import EmptyState from '../../components/ui/EmptyState';
import { http } from '../../api/http';
import { useProjectRole } from '../../hooks/useProjectRole';
import type { AIInvokeResult, Project } from '../../types/api';

type View = 'tests' | 'compare' | 'document';

interface TestResult {
  name: string;
  passed: boolean;
  reasoning: string;
}

// Backend POST /wizard/stage-4/tests возвращает массив из 4 вызовов `ai.invoke`
// (Promise.all) — по одному на каждый тест: memorability / differentiation /
// claim_backing / emotional_hook. Shape — `{test, result: AIInvokeResult}[]`,
// НЕ единый AIResult с `json.tests`. Предыдущая версия фронта ждала `result.json.tests`
// и тихо падала в empty-state, когда все 4 вызова возвращались успешно.
// См. CLAUDE.md §«silent-failures»: HTTP 200 + пустой рендер = худший UX.
type Stage4TestEnvelope = { test: string; result: AIInvokeResult<ReviewClassifyJson> }[];

// review-classify.md v1.0.0 — shape LLM-judge'а (см. `backend/prompts/review-classify.md`).
interface ReviewClassifyJson {
  passed?: boolean;
  score?: number;
  traffic_light?: 'green' | 'yellow' | 'red';
  reasons?: string[];
  suggestions?: string[];
  issues?: Array<{ severity: string; category: string; text: string }>;
}

// Русские метки для 4 тестов + fallback на технический ключ.
const TEST_LABELS: Record<string, string> = {
  memorability_test: 'Тест семейного стола (запомнил бы школьник)',
  differentiation_test: 'Тест отличия от конкурентов',
  claim_backing_test: 'Тест обоснования обещания',
  emotional_hook_test: 'Тест эмоционального крюка',
};

// Стадия 4: 4 теста месседжа + финальный документ.
export default function Stage4Page() {
  const { id } = useParams<{ id: string }>();
  const { isOwnerViewer } = useProjectRole(id);
  const [projectMeta, setProjectMeta] = useState<Project | null>(null);
  useEffect(() => {
    if (!id) return;
    http.get<Project>(`/projects/${id}`).then((res) => setProjectMeta(res.data)).catch(() => {});
  }, [id]);
  const isFinalized = projectMeta?.status === 'finalized' || projectMeta?.status === 'archived';
  const [view, setView] = useState<View>('tests');
  const [messageText, setMessageText] = useState('');
  const [originalDraft, setOriginalDraft] = useState('');
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  // Translate `rejectReason` код из backend/ai.service.ts в русский текст.
  // Та же логика что в Stage1Page (см. CLAUDE.md §«silent-failures»).
  const translateRejectReason = (reason?: string): string => {
    if (!reason) return 'Тесты сорвались — см. audit log';
    if (reason === 'roundtrip_limit_hit') return 'Claude упёрся в лимит итераций (5 roundtrip). Сбросьте месседж и попробуйте проще.';
    if (reason === 'BUDGET_EXCEEDED') return 'Исчерпан бюджет проекта на AI. Обратитесь к админу.';
    if (reason === 'DAILY_CAP_EXCEEDED') return 'Дневной лимит AI-запросов исчерпан. Попробуйте завтра.';
    if (reason === 'no_vendor_available') return 'Все LLM-вендоры сейчас недоступны. Повторите через 1-2 минуты.';
    if (reason === 'tool_not_whitelisted') return 'LLM вернул неизвестный tool-call — заблокировано санитайзером.';
    if (reason.startsWith('llm_failed:rate_limited')) return 'Rate-limit у вендора. Повторите через 30 секунд.';
    if (reason.startsWith('llm_failed:auth')) return 'Ошибка авторизации у вендора. Сообщите админу.';
    if (reason.startsWith('llm_failed:context_too_long')) return 'Месседж слишком длинный для модели.';
    if (reason.startsWith('llm_failed:')) return `Вендор вернул ошибку: ${reason.replace('llm_failed:', '')}`;
    return `Тесты не выполнены: ${reason}`;
  };

  const run = async () => {
    if (!id || messageText.trim().length < 4) {
      setError('Введите утверждённый месседж для прогона 4 тестов');
      return;
    }
    setLoading(true); setError(''); setTestResults(null);
    const t0 = Date.now();
    try {
      const res = await http.post<Stage4TestEnvelope>('/wizard/stage-4/tests', {
        projectId: id,
        text: messageText,
      });
      const rawTests = Array.isArray(res.data) ? res.data : [];
      // Silent-failure guard: если ВСЕ 4 вызова rejected (ai.ok=false) — это
      // не «все тесты failed», это «вызовы не состоялись». Нужно показать
      // причину первого rejectReason, а не рендерить 4 красных карточки.
      const allRejected = rawTests.length > 0 && rawTests.every((t) => !t.result.ok);
      if (allRejected) {
        const first = rawTests[0]?.result?.rejectReason;
        setError(translateRejectReason(first));
        setLoading(false);
        return;
      }
      const mapped: TestResult[] = rawTests.map(({ test, result: r }) => ({
        name: TEST_LABELS[test] ?? test,
        // «passed» по LLM-judge: ok=true И traffic_light=green.
        passed: r.ok && r.json?.traffic_light === 'green',
        reasoning:
          r.json?.reasons?.join('; ') ||
          r.json?.suggestions?.join('; ') ||
          r.text ||
          (r.ok ? 'Обоснование не возвращено' : translateRejectReason(r.rejectReason)),
      }));
      setTestResults(mapped);
      setElapsed((Date.now() - t0) / 1000);
      if (!originalDraft) setOriginalDraft(messageText); // фиксируем первую версию
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Тесты сорвались — см. audit log');
    } finally {
      setLoading(false);
    }
  };

  const approveFinal = async () => {
    if (!id || !testResults) return;
    setApproving(true);
    try {
      await http.post('/wizard/approvals', {
        projectId: id,
        artifact: 'brand_message',
        snapshot: { text: messageText, tests: testResults },
      });
      setApproved(true);
      setView('document');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось утвердить (может, нет прав owner_viewer)');
    } finally {
      setApproving(false);
    }
  };

  const hints: SufflerHint[] = [
    { id: '1', title: '4 теста параллельно', body: '1) тест семейного стола — поймёт ли школьник; 2) тест эмоций — вызывает ли; 3) тест краткости; 4) тест универсальности по 3 ЦА.' },
    { id: '2', title: 'Все 4 должны быть green', body: 'Если хотя бы один yellow — возвращаемся на Стадию 3, пере-сформулируем. Red — точно возврат.', severity: 'warning' },
    { id: '3', title: 'Утверждает только собственник', body: 'Маркетолог может прогнать тесты, но подпись на brand_message ставит только owner_viewer.', severity: 'danger' },
  ];

  const allPassed = testResults?.every((t) => t.passed) ?? false;

  // Архивный режим для finalized/archived проектов.
  if (isFinalized && id) {
    return (
      <WizardShell
        stage={4}
        title="Бренд-месседж и финал — архив"
        subtitle="Утверждённый месседж, стоп-слова и финальный документ."
      >
        <FinalizedStageView projectId={id} stage={4} />
      </WizardShell>
    );
  }

  // owner_viewer: POST /wizard/stage-4/tests и /finalize — marketer-only. Подпись
  // собственника идёт через /approvals, а не отсюда. Показываем read-only экран
  // с явной ссылкой на утверждения, чтобы клиент не кликнул «Прогнать тесты» и
  // не получил 403.
  if (isOwnerViewer) {
    return (
      <WizardShell
        stage={4}
        title="Четыре теста месседжа"
        subtitle="На этой стадии маркетолог прогоняет месседж через 4 теста и собирает бренд-книгу. Ваша подпись ставит точку — без неё DOCX не выгружается."
      >
        <ReadOnlyBanner>
          Стадия 4 — финальные тесты. Когда все 4 дадут зелёный, маркетолог пришлёт
          вам месседж на подпись на странице{' '}
          <Link to={`/projects/${id}/approvals`} className="underline font-medium">
            Утверждения
          </Link>
          . После вашей подписи система соберёт бренд-книгу (DOCX) автоматически.
        </ReadOnlyBanner>
        <Card className="mt-6">
          <Card.Body>
            <EmptyState
              icon={FileText}
              title="Месседж ещё на тестах"
              description="Как только маркетолог получит все 4 green — увидите финал на утверждении. До этого момента жать некуда."
              action={
                <Link
                  to={`/projects/${id}/approvals`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA] transition-colors"
                >
                  К утверждениям
                  <ArrowRight className="w-4 h-4" />
                </Link>
              }
            />
          </Card.Body>
        </Card>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      stage={4}
      title="Четыре теста месседжа"
      subtitle="Финальный прогон. Месседж проходит 4 теста параллельно. Только все 4 green → утверждение → экспорт бренд-книги."
    >
      <OnboardingBanner
        storageKey="bp.onboarding.stage-4"
        title="Тесты — не формальность"
        body="Это последняя возможность поймать косяк до того, как бренд-книга уйдёт клиенту. Прочитайте обоснование каждого теста — там Claude объясняет, что именно прошло и почему."
      />

      <div className="mt-6">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <Tabs.List>
            <Tabs.Tab value="tests">
              <span className="inline-flex items-center gap-2">
                <FlaskConical className="w-3.5 h-3.5" aria-hidden />
                Тесты
                {testResults && (
                  <Badge variant="soft" color={allPassed ? 'success' : 'warning'}>
                    {testResults.filter((t) => t.passed).length}/{testResults.length}
                  </Badge>
                )}
              </span>
            </Tabs.Tab>
            <Tabs.Tab value="compare">
              <span className="inline-flex items-center gap-2">
                <GitCompare className="w-3.5 h-3.5" aria-hidden />
                Сравнить
              </span>
            </Tabs.Tab>
            <Tabs.Tab value="document" disabled={!approved}>
              <span className="inline-flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" aria-hidden />
                Документ
                {approved && <Badge variant="soft" color="success">Готов</Badge>}
              </span>
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 mt-6">
        <div>
          {view === 'tests' && (
            <TestsView
              messageText={messageText}
              setMessageText={setMessageText}
              run={run}
              loading={loading}
              error={error}
              testResults={testResults}
              allPassed={allPassed}
              elapsed={elapsed}
              approved={approved}
              approveFinal={approveFinal}
              approving={approving}
            />
          )}

          {view === 'compare' && (
            <CompareView original={originalDraft} final={messageText} />
          )}

          {view === 'document' && (
            <DocumentView projectId={id} approved={approved} />
          )}
        </div>

        <aside className="hidden xl:block">
          <SufflerPanel hints={hints} />
        </aside>
      </div>
    </WizardShell>
  );
}

// ———————————————————————————————————————————————————————————————
// Tests view
// ———————————————————————————————————————————————————————————————

function TestsView({
  messageText,
  setMessageText,
  run,
  loading,
  error,
  testResults,
  allPassed,
  elapsed,
  approved,
  approveFinal,
  approving,
}: {
  messageText: string;
  setMessageText: (v: string) => void;
  run: () => void;
  loading: boolean;
  error: string;
  testResults: TestResult[] | null;
  allPassed: boolean;
  elapsed: number;
  approved: boolean;
  approveFinal: () => void;
  approving: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <Card.Header>
          <div className="flex items-start gap-2">
            <FlaskConical className="w-4 h-4 text-[#4F46E5] mt-0.5" aria-hidden />
            <div>
              <Card.Title>Финальный месседж бренда</Card.Title>
              <Card.Description>
                4-7 слов. Прогон по 4 тестам: семейного стола, эмоций, краткости, универсальности по ЦА.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Например: Одежда, которая переживёт ваш развод"
            sizeField="lg"
            label="Месседж"
            hint="Вставьте тот вариант, который утвердили на Стадии 3 после критики и светофора валидатора."
          />
          <div className="flex justify-between items-center mt-4 flex-wrap gap-3">
            {/* «Показать пример» — живой 5-словный месседж для демонстрации формата.
                Маркетолог видит, как выглядит валидный вход, не пытается угадать. */}
            <button
              type="button"
              onClick={() => {
                const has = messageText.trim().length > 0;
                if (has) {
                  const ok = window.confirm('Заменить введённый месседж примером?');
                  if (!ok) return;
                }
                setMessageText('Одежда, которая переживёт ваш развод');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F46E5]
                hover:text-[#3730A3] transition-colors rounded-md px-2 py-1 -my-1 -mx-1
                hover:bg-[#EEF2FF]"
            >
              <Lightbulb className="w-3.5 h-3.5" aria-hidden />
              Показать пример
            </button>
            <Button
              variant="primary"
              size="md"
              iconLeft={Sparkles}
              onClick={run}
              loading={loading}
            >
              {loading ? 'Claude запускает 4 теста…' : 'Прогнать 4 теста'}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <div role="alert"
          className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#B91C1C] flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {testResults && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <TimeSavedChip generationSeconds={elapsed} manualMinutesEquivalent={240} />
          </div>

          {testResults && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testResults.map((t, i) => (
                <TestCard key={i} test={t} />
              ))}
            </div>
          )}

          {testResults && allPassed && !approved && (
            <Card>
              <Card.Body className="bg-[#F0FDF4] rounded-2xl">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#1A1A1A] mb-1">
                      Все 4 теста green
                    </p>
                    <p className="text-xs text-[#44403C] mb-4 leading-relaxed">
                      Все проверки пройдены — можно утверждать финал бренда. Подпись будет
                      финальной: отменить нельзя, только выпустить новую версию.
                    </p>
                    <Button
                      variant="primary"
                      size="md"
                      iconLeft={CheckCircle2}
                      onClick={approveFinal}
                      loading={approving}
                    >
                      Утвердить финальный месседж
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {approved && (
            <div className="p-4 bg-[#F0FDF4] border border-[#86EFAC] rounded-2xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#22C55E] flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-[#15803D]">Месседж утверждён</p>
                <p className="text-xs text-[#44403C] mt-0.5">
                  Документ сгенерирован. Откройте вкладку «Документ», чтобы посмотреть и скачать.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TestCard({ test }: { test: TestResult }) {
  return (
    <div
      className={`border rounded-2xl p-4 ${
        test.passed ? 'bg-[#F0FDF4] border-[#86EFAC]' : 'bg-[#FEF2F2] border-[#FCA5A5]'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {test.passed ? (
          <CheckCircle2 className="w-4 h-4 text-[#22C55E]" aria-hidden />
        ) : (
          <XCircle className="w-4 h-4 text-[#EF4444]" aria-hidden />
        )}
        <p className="font-semibold text-sm text-[#1A1A1A]">{test.name}</p>
      </div>
      <p className="text-xs text-[#44403C] leading-relaxed">{test.reasoning}</p>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Compare view — DiffBlock
// ———————————————————————————————————————————————————————————————

function CompareView({ original, final }: { original: string; final: string }) {
  if (!original) {
    return (
      <Card>
        <Card.Body>
          <EmptyState
            icon={GitCompare}
            title="Нечего сравнивать"
            description="Запустите 4 теста хотя бы раз — здесь появится сравнение черновой и финальной формулировки."
          />
        </Card.Body>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <Card.Header>
          <div>
            <Card.Title>Сравнение версий</Card.Title>
            <Card.Description>
              Слева — первая формулировка, с которой запускали тесты. Справа — текущая.
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Body>
          <DiffBlock
            before={original}
            after={final}
            label="Месседж бренда"
            view="split"
            author="Маркетолог · итеративно"
          />
        </Card.Body>
      </Card>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// Document view — DOCX preview + download
// ———————————————————————————————————————————————————————————————

function DocumentView({ projectId, approved }: { projectId: string | undefined; approved: boolean }) {
  const [downloading, setDownloading] = useState<'docx' | 'xlsx' | null>(null);

  // Backend: `@Controller('export')`, POST `/export/projects/:id/{docx|xlsx}`,
  // ответ — бинарь через `res.send(bytes)` + `Content-Disposition: attachment`.
  // Старый код использовал GET `/api/exporter/...?projectId=...` (3 ошибки:
  // wrong path `exporter` вместо `export`, wrong method GET вместо POST, wrong
  // query vs path param). iframe-preview тоже убран: GET с auth-заголовком
  // через iframe невозможен (JWT в httpOnly-cookie нет — он в Zustand-памяти).
  const download = async (format: 'docx' | 'xlsx') => {
    if (!projectId || !approved) return;
    setDownloading(format);
    try {
      const res = await http.post(`/export/projects/${projectId}/${format}`, {}, { responseType: 'blob' });
      const blob = new Blob([res.data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bp-brand-book-${projectId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      let message = 'Экспорт недоступен';
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const txt = await data.text();
          const parsed = JSON.parse(txt);
          message = parsed.message || message;
        } catch {
          /* non-JSON blob — дефолт */
        }
      } else if (typeof data?.message === 'string') {
        message = data.message;
      }
      alert(message);
    } finally {
      setDownloading(null);
    }
  };

  if (!approved) {
    return (
      <Card>
        <Card.Body>
          <EmptyState
            icon={FileText}
            title="Документ ещё не готов"
            description="Утвердите финальный месседж во вкладке «Тесты» — после этого здесь появится бренд-книга."
          />
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <Card.Header>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-[#4F46E5] mt-0.5" aria-hidden />
            <div>
              <Card.Title>Бренд-книга (финал)</Card.Title>
              <Card.Description>
                Финальный документ утверждён и сохранён. Отменить нельзя — для правок нужна новая версия бренд-платформы.
              </Card.Description>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {/* Без iframe-preview: бинарь отдаётся как attachment, preview потребовал
              бы отдельного HTML-рендер-endpoint'а (нет в MVP). Вместо этого —
              чёткий CTA «Скачать» + список содержимого, чтобы пользователь знал
              что получит. */}
          <div className="border border-[#E7E5E4] rounded-xl bg-[#FAFAF9] p-5 space-y-3">
            <p className="text-sm font-medium text-[#1A1A1A]">В бренд-книгу входят:</p>
            <ul className="text-sm text-[#44403C] space-y-1.5 list-disc list-inside">
              <li>Легенда бренда и история собственника</li>
              <li>Ценности (4–6 штук) с поведенческими правилами</li>
              <li>Миссия и видение компании</li>
              <li>Архетип бренда и позиционирование</li>
              <li>Финальный бренд-месседж + 3 альтернативы</li>
              <li>Четыре теста месседжа с обоснованиями</li>
              <li>Матрица стоп-слов и tone of voice</li>
            </ul>
          </div>
        </Card.Body>
        <Card.Footer>
          <Button
            variant="primary"
            size="md"
            iconLeft={Download}
            onClick={() => download('docx')}
            disabled={!!downloading}
          >
            {downloading === 'docx' ? 'Готовим…' : 'Скачать DOCX'}
          </Button>
          <Button
            variant="secondary"
            size="md"
            iconLeft={Download}
            onClick={() => download('xlsx')}
            disabled={!!downloading}
          >
            {downloading === 'xlsx' ? 'Готовим…' : 'Скачать XLSX (матрица)'}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
