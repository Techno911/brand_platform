import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, AlertCircle, Check, Plus, Trash2, Flame, ThumbsUp, ThumbsDown, Target, MessageSquareQuote, Heart, Users, ArrowRight, Lightbulb, FileText } from 'lucide-react';
import WizardShell from './WizardShell';
import SufflerPanel, { type SufflerHint } from '../../components/SufflerPanel';
import TimeSavedChip from '../../components/TimeSavedChip';
import OnboardingBanner from '../../components/OnboardingBanner';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import FinalizedStageView from '../../components/FinalizedStageView';
import FeedbackForm from '../../components/FeedbackForm';
import Stepper, { type StepperItem } from '../../components/ui/Stepper';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { Textarea } from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { http } from '../../api/http';
import { useProjectRole } from '../../hooks/useProjectRole';
import type {
  InterviewPatternEntry,
  InterviewPatterns,
  JobToBeDone,
  Project,
  SegmentSignalsBuckets,
  Stage1InterviewPatternsResponse,
  TopFormulation,
} from '../../types/api';

// Стадия 1: voice of customer. Маркетолог загружает 3-5 интервью через отдельные слоты.
// Каждый слот = отдельная карточка, чтобы маркетолог физически не мог «проскочить» с одним интервью
// и чтобы склейка `### ИНТЕРВЬЮ N` формировалась автоматически.
const MIN_INTERVIEWS = 3;
const MAX_INTERVIEWS = 5;
const MIN_CHARS_PER_INTERVIEW = 200; // 10-15 минут транскрипта = ~200+ символов на минимум

// Живые примеры транскриптов — для кнопки «Показать пример». Снижают транзакционный
// энергоналог на старте: маркетолог видит реальный формат и объём, не «плюс-минус 3 строки».
// Взяты с второго клиента (бренд одежды «Холст»), разные сегменты: lifetime / critical / gift.
// Назначение — обучающее: после первого прочтения маркетолог перезаписывает своими данными.
const EXAMPLE_TRANSCRIPTS: string[] = [
  // Интервью 1 — Мария, 38, дизайнер интерьеров. Lifetime-клиент, положительный паттерн.
  `— Расскажите, как вы впервые узнали о Холсте. Что тогда происходило?
— Это была зима 2023, я развелась с мужем через 10 лет брака. Психолог сказала: «перестаньте носить чужой гардероб». А я реально носила то, что муж любил — серое, неяркое, «чтобы не выделяться». Я пошла в ТЦ и поняла, что всё то же самое — только другими бирками. В примерочной Zara я стояла и плакала — всё плохо сидит, всё дешёвое на ощупь. Подруга кинула инстаграм Холста: «Посмотри, может зайдёт». Я увидела пальто из шерсти верблюда — в описании было «базовое пальто, которое не устареет через 5 лет». Записалась на примерку на Подсосенский.

— Что вы ощутили на первой примерке?
— Меня встретила Анна — основательница. Она спросила не «что хотите купить», а «чем занимаетесь, как живёте». Я рассказала про дизайн интерьеров, про встречи с клиентами, про то что мне 38 и я устала от подростковых силуэтов. Мы полтора часа говорили, она показывала ткани, давала трогать. Когда я надела пальто — оно село идеально. На ощупь — как будто обнимает. Я заплакала в примерочной, извинилась. Анна сказала: «нормально, так многие реагируют на шерсть верблюда».

— Почему выбрали Холст, а не ателье или премиум-бренд?
— Ателье — это 80 тысяч минимум, три примерки, ждать месяц, плюс страх что не угадают силуэт. Премиум — Max Mara, Akris — это 200+ тысяч и ощущение «платишь за бирку». У Холста пальто 68 тысяч, ткань итальянская шерсть верблюда, крой продуман под русские пропорции. Я не чувствую что «купила бренд» — я чувствую что купила вещь.

— Что пытались решить, когда искали?
— Пересобрать себя после развода. Чтобы одежда не напоминала прошлую жизнь. Чтобы я могла надеть в офис клиента и меня увидели как профессионала, а не как «женщину в серой толпе». Холст дал мне это ощущение.

— Что было самым важным в момент покупки?
— Что меня не торопили. Анна сказала: «подумайте 2 недели, примерьте дома на разные ситуации, не решайте сейчас». Это было как глоток воздуха. В ТЦ прессуют через скидку, здесь — наоборот. Ещё важно что пальто подшивали под мой рост — 162 см, стандартные размеры висят. Их швея Галина работает 30 лет, подогнала идеально за 3 дня.

— Что изменилось после покупки?
— За полгода купила ещё два платья и брюки. Муж одной клиентки сказал «вы как будто стали старше на 10 лет — в смысле увереннее». Я теперь не покупаю в масс-маркете ничего. За год сэкономила около 200 тысяч на импульсивных покупках.

— Кому бы рекомендовали?
— Женщинам 35+ после жизненного перелома. Развод, смерть родителя, смена карьеры. Тем, кто устал быть «в массе». Не 20-летним — им не нужна вещь на 10 лет.`,

  // Интервью 2 — Елена, 45, владелица кафе. Критический паттерн: качество ок, сроки боль.
  `— Расскажите, как вы впервые купили у Холста.
— Весна 2024, у меня был день рождения, 45. Хотела подарок себе. Открываю инстаграм — платье цвета «песочной дюны» из итальянского льна, 32 тысячи. Подруга хвалила Холст. Записалась.

— Что происходило до? Чем не устраивал прошлый гардероб?
— У меня кафе на Покровке, я весь день в зале, в движении. Нужна одежда которая не мнётся, не требует химчистки каждую неделю, не блестит от пота. Масс-маркет мнётся. Премиум — Max Mara, Boss — слишком строгий для кафе-формата. Я хотела что-то между: «дорого, но по-домашнему».

— Как прошла примерка?
— Хорошо. Анна сама одевалась примерно как я хотела себя видеть — льняное платье, плетёные сандалии, никаких брендов. Объяснила почему их лён «отстаёт от моды»: «если хочется тренд, идите в Zara, у нас базовая классика». Мне это понравилось. Примерка 40 минут — платье село, потом выбирали что к нему носить. Купила платье + блузку на зиму.

— Что пошло не так?
— Сроки. Платье обещали через 2 недели — ждала 5 недель. Блузку — 3 недели — ждала 7 недель. Писала в WhatsApp, Анна отвечала честно: «Галина в отпуске, Надежда сломала палец». Понимаю что маленькое производство, но у меня был день рождения 15 апреля, а платье приехало 30 мая. На день рождения надела старое.

— Что было самым важным в момент получения?
— Первая реакция: «блин, стоит того». Платье сидит так что я в нём себя ощущаю выше (мой рост 158). Блузка из египетского хлопка — мягкая как вода. Но осадок от сроков остался.

— Почему остались клиентом?
— Вторые покупки пока не делала. Может вернусь зимой — они обещали коллекцию базовых кардиганов. Если опять 5+ недель — буду искать альтернативу. Ключевое: я им доверяю по качеству, но не доверяю по срокам.

— Что бы изменили?
— Честные сроки при заказе. Не «2 недели», а «4-6 недель» с запасом. Лучше переобещать большое и прислать раньше, чем наоборот. И SMS когда готово — они пишут только в WhatsApp, иногда пропускаешь.

— Кому рекомендуете?
— Терпеливым женщинам за 40, которые не покупают по срочной причине. Если платье на свадьбу через месяц — не к ним. Если хотите вещь на 10 лет и можете подождать — к ним.`,

  // Интервью 3 — Ольга, 52, бухгалтер на пенсии. Gift-покупка, эмоциональный паттерн.
  `— Расскажите, как вы узнали про Холст.
— Мне 52, бухгалтер на пенсии. У дочери был 30-летний юбилей в июле 2024, она упомянула что хочет «платье, чтоб не стыдно в ресторан с женихом». Искала где заказать качественный подарок. Подруга дочери посоветовала Холст.

— Что пытались решить?
— Не хотела дарить деньги — обезличенно. Не хотела украшение — вкусы разные. Платье — риск, но дочь спокойная, классику любит. Решила: заказываю, примерим вместе, если не подошло — купят с доплатой другое. Анна согласилась на такой формат.

— Как прошёл процесс?
— Приехала одна в шоурум на Подсосенский. Анна сразу: «расскажите про дочь, я посоветую». Показала фото — адвокат в крупной фирме, 180 см. Анна говорит: «для её типа льняное платье-футляр тёмно-синего, стройнит и в офис тоже работает». Показала варианты. Взяла размер 44, оплатила 38 тысяч. Через 3 недели платье приехало. Дочь примерила — идеально, подгонки не потребовалось.

— Что было самым важным в этот момент?
— Дочь ПЛАКАЛА когда надела. Я такого не видела 15 лет — последний раз она плакала когда ей подарили щенка в 14. Обняла меня и сказала «мам, ты меня понимаешь лучше всех». Это было важнее чем само платье.

— Что изменилось после?
— Дочь теперь сама заказывает у Холста — 2 блузки и брюки за полгода. Говорит: «после твоего подарка поняла что можно не в ТЦ». Я сама иногда заглядываю — купила рубашку из льна. Для 52 лет дорого, но вещь на 5 лет точно.

— Кому бы рекомендовали?
— Матерям которые не знают что подарить взрослым дочерям. И самим женщинам после 30 кто устал от «одноразового». Не подходит тем кто любит яркие принты и стразы — у Холста всё тихое, монохром. И не подходит молодёжи 20+ — дорого и не по их стилю.

— Что можно улучшить?
— Доставку. Сейчас только самовывоз из шоурума или курьером по Москве. Я живу в Одинцово, пришлось ехать в центр. Если бы слали в ПВЗ — было бы легче.`,
];

// Отдельный интервью-слот. `id` — устойчивый ключ для React (не трогаем при сдвигах).
interface InterviewSlot {
  id: string;
  text: string;
}

function makeSlot(): InterviewSlot {
  // crypto.randomUUID гарантирован в современных браузерах. Zustand / tests работают в jsdom.
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, text: '' };
}

export default function Stage1Page() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Role-gate: owner_viewer видит read-only версию страницы. Writer-UI (слоты,
  // «Извлечь паттерны», «Перейти к Стадии 2») для него бессмысленный — backend
  // даёт 403 на любой POST. См. backend/src/wizard/wizard.controller.ts:95-108.
  const { isOwnerViewer } = useProjectRole(id);
  // Статус проекта нужен чтобы переключить страницу в архивный режим для
  // finalized/archived проектов: писать в завершённый бренд нельзя, и показывать
  // маркетологу/админу пустые слоты ввода вместо собранных данных —
  // халтура (прямая цитата пользователя). См. FinalizedStageView.tsx.
  const [projectMeta, setProjectMeta] = useState<Project | null>(null);
  useEffect(() => {
    if (!id) return;
    http.get<Project>(`/projects/${id}`).then((res) => setProjectMeta(res.data)).catch(() => {});
  }, [id]);
  const isFinalized = projectMeta?.status === 'finalized' || projectMeta?.status === 'archived';
  // Стартуем с 3 обязательных слотов. Маркетолог может добавить 4-й и 5-й.
  const [slots, setSlots] = useState<InterviewSlot[]>(() => [makeSlot(), makeSlot(), makeSlot()]);
  const [result, setResult] = useState<Stage1InterviewPatternsResponse | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Восстановление стейта при возврате маркетолога на страницу. Бэкенд хранит
  // transcript и patterns в `rows` (sheet=1, type='interview'); без этой подгрузки
  // маркетолог уходит на Stage 2, возвращается по ссылке «взять из Стадии 1» —
  // и видит пустую форму. Артём 2026-04-20: «Это капец! Как ты такое допустил?».
  //
  // Транскрипт бьётся обратно по тому же маркеру, что при отправке:
  // `### ИНТЕРВЬЮ N\n<text>\n\n### ИНТЕРВЬЮ N+1\n<text>…`.
  // Если частей <3 (маркетолог сохранил только 1 пункт в прошлой сессии) —
  // дополним пустыми слотами до минимального 3.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    http
      .get<{ transcript: string; patterns: InterviewPatterns | null; isFinalized: boolean }>(
        `/wizard/stage-1/state?projectId=${id}`,
      )
      .then((res) => {
        if (cancelled) return;
        const { transcript, patterns } = res.data;
        if (transcript && transcript.trim().length > 0) {
          // Разбор: split по маркеру `### ИНТЕРВЬЮ N`, отбрасываем заголовки/пустые.
          const parts = transcript
            .split(/\n*### ИНТЕРВЬЮ \d+\n/u)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (parts.length) {
            const restored = parts.slice(0, MAX_INTERVIEWS).map((text) => ({
              id:
                typeof crypto !== 'undefined' && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              text,
            }));
            // Дополняем до минимума 3 пустыми слотами, если сохранено меньше.
            while (restored.length < MIN_INTERVIEWS) restored.push(makeSlot());
            setSlots(restored);
          }
        }
        if (patterns && typeof patterns === 'object') {
          // Синтезируем Stage1InterviewPatternsResponse — фронту нужно `ai.ok=true`
          // и `ai.json=patterns` чтобы Stage1DraftView отрендерил блок. Поля cost/latency
          // не знаем (это ведь прошлый run) — ставим заглушки; TimeSavedChip в cached-режиме
          // для restored-стейта неприменим, поэтому не вызываем его в этой ветке.
          setResult({
            row: null,
            ai: {
              ok: true,
              kind: 'interview_patterns',
              runId: 'restored',
              text: null,
              json: patterns,
              stopReason: null,
              usage: {
                inputTokens: 0,
                outputTokens: 0,
                cacheReadInputTokens: 0,
                cacheCreationInputTokens: 0,
              },
              costUsd: 0,
              costAdjustedUsd: 0,
              costRawUsd: 0,
              latencyMs: 0,
              retries: 0,
              cached: true,
              degraded: false,
            },
          });
        }
      })
      .catch(() => {
        // Тихий фэйл: даже если state endpoint даёт 403/404, пустая форма не ломает UI
      });
    return () => {
      cancelled = true;
    };
  }, [id]);
  // Отдельное состояние для финализации — не переиспользуем `loading`/`error`,
  // потому что маркетолог может «Извлечь паттерны» повторно уже после первого
  // черновика, и тот флоу не должен скрывать ошибку перехода на Стадию 2.
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  // Ref на блок черновика — нужен чтобы после успешного «Извлечь паттерны»
  // страница сама проскролилась к результату. Без этого маркетолог стоит в
  // области ввода, backend возвращает cache-hit за ~15 мс, loader даже не
  // успевает мелькнуть, а черновик рендерится на +2000px ниже — за пределами
  // viewport. Со стороны маркетолога это выглядит как «нихрена не происходит»:
  // нет ни ошибки, ни видимой реакции, он теряет доверие к кнопке и думает,
  // что stage 1 сломан. Скроллим только когда появляется новый `result`.
  const draftRef = useRef<HTMLDivElement | null>(null);

  // Валидированные слоты: текст непустой и длиннее минимума. Используется для enable кнопки
  // и для подсчёта «заполнено N из 3».
  const validSlots = useMemo(
    () => slots.filter((s) => s.text.trim().length >= MIN_CHARS_PER_INTERVIEW),
    [slots],
  );
  const validCount = validSlots.length;
  const canSubmit = validCount >= MIN_INTERVIEWS && !loading;
  const totalChars = slots.reduce((acc, s) => acc + s.text.length, 0);

  const updateSlot = (slotId: string, text: string) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, text } : s)));
  };

  const addSlot = () => {
    if (slots.length >= MAX_INTERVIEWS) return;
    setSlots((prev) => [...prev, makeSlot()]);
  };

  const removeSlot = (slotId: string) => {
    // Не даём удалить последние 3 обязательных слота — иначе маркетолог сломает минимум UI.
    setSlots((prev) => {
      if (prev.length <= MIN_INTERVIEWS) return prev;
      return prev.filter((s) => s.id !== slotId);
    });
  };

  // Заливает слот живым примером транскрипта (Холст-бренд). Снимает транзакционный
  // энергоналог на старте — маркетолог видит реальный формат/объём, потом перезаписывает
  // своими данными. Защита от случайной перезаписи через confirm().
  const fillExample = (slotId: string, idx: number) => {
    const tpl = EXAMPLE_TRANSCRIPTS[idx];
    if (!tpl) return;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    if (slot.text.trim().length > 0) {
      const ok = window.confirm(
        `Перезаписать содержимое интервью ${idx + 1} примером?\nТекущий текст будет потерян.`,
      );
      if (!ok) return;
    }
    updateSlot(slotId, tpl);
  };

  const runInterview = async () => {
    if (!id) return;
    if (validCount < MIN_INTERVIEWS) {
      setError(`Заполните минимум ${MIN_INTERVIEWS} интервью по ${MIN_CHARS_PER_INTERVIEW}+ символов каждое.`);
      return;
    }
    // Склейка для бэкенда в каноническом формате Stage1Service.
    // Берём только валидные слоты — пустые не отправляем.
    const transcript = validSlots
      .map((s, i) => `### ИНТЕРВЬЮ ${i + 1}\n${s.text.trim()}`)
      .join('\n\n');

    setLoading(true);
    setError('');
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await http.post<Stage1InterviewPatternsResponse>(
        '/wizard/stage-1/interview-patterns',
        { projectId: id, transcript },
      );
      // КРИТИЧНО: backend возвращает HTTP 201 даже когда AIService отказался звонить
      // (roundtrip_limit_hit, BUDGET_EXCEEDED, no_vendor_available, llm_failed:*).
      // В этом случае `ai.ok === false`, `row === null`. Если мы слепо setResult,
      // Stage1DraftView отрендерит DraftEmpty со скрытым «Claude не нашёл паттернов» —
      // маркетолог решит что проблема в транскрипте, хотя её там нет. Поэтому:
      // проверяем `ai.ok`, и если false — показываем человеческое сообщение об ошибке
      // с переводом `rejectReason` на русский. Это вскрывает silent-failure класс багов
      // целиком (а не только roundtrip-limit, на котором ловили изначально).
      if (!res.data.ai?.ok) {
        const reason = res.data.ai?.rejectReason ?? 'unknown';
        setError(translateRejectReason(reason));
        return;
      }
      setResult(res.data);
      setElapsed((Date.now() - t0) / 1000);
      // Проскролить к черновику на следующий tick, когда React уже смонтирует
      // Stage1DraftView и `draftRef.current` будет на DOM-узле. Без rAF
      // получим scrollTo на старый позиции (узел появляется позже).
      requestAnimationFrame(() => {
        draftRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(' · ')
          : typeof msg === 'string' && msg
          ? msg
          : 'Claude не справился — попробуйте чуть позже или разбейте транскрипт на части',
      );
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (payload: { rejected: string; reason: string; reformulate: string }) => {
    if (!id) return;
    await http.post('/wizard/feedback', {
      projectId: id,
      artifact: 'stage_1.voice_of_customer',
      verdict: 'revise',
      rejectedText: payload.rejected,
      reasonText: payload.reason,
      reformulationHint: payload.reformulate,
    });
  };

  // «Утвердить и перейти к Стадии 2». Закрывает черновик маркером
  // `row.finalized + status=completed` на бэкенде (Stage1Service.finalizeStage1),
  // который используется как gate для разблокировки Стадии 2. Это не owner-approval
  // (Customer Portrait получит полный Approval позже в рамках `final_document`).
  const handleFinalize = async () => {
    if (!id) return;
    setFinalizing(true);
    setFinalizeError('');
    try {
      await http.post('/wizard/stage-1/finalize', { projectId: id });
      navigate(`/projects/${id}/stage-2`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFinalizeError(
        Array.isArray(msg)
          ? msg.join(' · ')
          : typeof msg === 'string' && msg
          ? msg
          : 'Не удалось закрыть стадию — попробуйте ещё раз или обновите страницу',
      );
    } finally {
      setFinalizing(false);
    }
  };

  // Приоритизация сверху вниз: сначала действие (вопросы), потом риск (warning),
  // потом правило (без гипотез). «Минимум 3 интервью» снят — дублируется в ProgressPill
  // («0/3 обязательно») и в subtitle, повторять третий раз = шум.
  const hints: SufflerHint[] = [
    {
      // #1 — что делать прямо сейчас. Канонический JTBD-набор 7 вопросов по методологии 3.1.
      // Формулировки вытаскивают триггер («Что стало каплей?»), функциональную работу
      // («Что пытались решить?»), эмоциональный исход («Что изменилось?»).
      id: '1',
      title: 'Какие вопросы задавать',
      body: 'Методологический минимум — 7 вопросов JTBD. Не обязательно все, но хотя бы 5 из 7 в каждом интервью.',
      items: [
        'Расскажите, как вы впервые столкнулись с нашей услугой — что тогда происходило?',
        'Что вы пытались решить, когда начали искать? Какую задачу хотели закрыть?',
        'Что уже пробовали до нас — чем там не подошло?',
        'Почему в итоге выбрали именно нас? Что стало каплей?',
        'Что было самым важным, когда вы получили услугу? Что запомнилось?',
        'Что изменилось после в вашей жизни/работе?',
        'Кому бы вы нас рекомендовали — какому человеку в какой ситуации?',
      ],
    },
    {
      // #2 — критический риск. Warning подсвечивается жёлтым бордером в SufflerPanel.
      id: '2',
      title: 'Реальные слова клиента',
      body: 'Не пересказывайте своими словами. Вставьте прямую речь — Claude работает с лексикой клиента, не маркетолога.',
      severity: 'warning',
    },
    {
      // #3 — общее правило без визуального акцента.
      id: '3',
      title: 'Без гипотез',
      body: 'Не интерпретируйте на этом шаге — только «что сказал, что услышал». Выводы делает Claude автоматически.',
    },
  ];

  const steps: StepperItem[] = [
    { index: 1, label: 'Портрет клиента', hint: 'Сейчас: транскрипт → паттерны', status: 'current' },
    { index: 2, label: 'Сессия с собственником', hint: 'Легенда, миссия, ценности', status: 'locked' },
    { index: 3, label: 'Архетип и позиционирование', hint: '12 архетипов, позиционирование', status: 'locked' },
    { index: 4, label: 'Четыре теста месседжа', hint: 'Критика и финальный документ', status: 'locked' },
  ];

  // Архив: проект завершён / в архиве. Writer-UI бессмыслен, показываем
  // собранные данные стадии (интервью, отзывы, конкуренты). Проверяем ДО
  // isOwnerViewer — если проект финальный, собственнику тоже нужен архивный
  // вид, а не EmptyState «ждите маркетолога».
  if (isFinalized && id) {
    return (
      <WizardShell
        stage={1}
        title="Портрет клиента — архив"
        subtitle="Собранные интервью и отзывы, на основе которых построен бренд."
      >
        <FinalizedStageView projectId={id} stage={1} />
      </WizardShell>
    );
  }

  // Owner_viewer: read-only версия. Writer-UI скрыт, показываем баннер +
  // EmptyState с навигацией в «Утверждения». Когда маркетолог закроет стадию 2+,
  // итоговые документы появятся там.
  if (isOwnerViewer) {
    return (
      <WizardShell
        stage={1}
        title="Портрет клиента"
        subtitle="Эту стадию ведёт маркетолог. Вы увидите итоговый портрет в «Утверждениях», когда черновик будет готов."
      >
        <ReadOnlyBanner>
          Стадия 1 — это сбор интервью с клиентами и извлечение паттернов. Текстовые
          поля и кнопки генерации доступны только маркетологу. Как только черновик
          будет готов к подписи, вы получите его на странице{' '}
          <Link to={`/projects/${id}/approvals`} className="underline font-medium">Утверждения</Link>.
        </ReadOnlyBanner>
        <Card className="mt-6">
          <Card.Body>
            <EmptyState
              icon={FileText}
              title="Черновик пока не готов"
              description="Вернитесь позже — как только маркетолог завершит сбор интервью, итоговый портрет клиента появится в «Утверждениях»."
              action={
                <Link
                  to={`/projects/${id}/approvals`}
                  className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg
                    bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-medium
                    transition-colors"
                >
                  К утверждениям <ArrowRight className="w-4 h-4" />
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
      stage={1}
      title="Портрет клиента"
      subtitle="Вставьте транскрипт 3-5 интервью с целевыми клиентами. Claude извлечёт: сегменты, мотивы, боль, триггеры покупки, типовые сомнения."
    >
      <OnboardingBanner
        storageKey="bp.onboarding.stage-1"
        title="Вы не кодите, вы редактируете"
        body="Claude сделает первый черновик по методологии. Ваша работа — прочитать и внести корректировки на основе знания клиента. Справа — панель подсказок по текущему шагу."
      />

      {/* Grid: stepper 280 · main · suffler 320 */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[280px_1fr_320px] gap-6 mt-6">
        {/* Stepper слева — карта маршрута */}
        <aside className="hidden lg:block">
          <Card>
            <Card.Header>
              <Card.Title>Маршрут методологии</Card.Title>
            </Card.Header>
            <Card.Body>
              <Stepper steps={steps} />
            </Card.Body>
          </Card>
        </aside>

        {/* Main — 3-5 слотов интервью */}
        <div className="space-y-6">
          {/* Sticky прогресс-блок: сколько из 3 заполнено + CTA */}
          <Card>
            <Card.Body>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-[#1A1A1A] leading-snug">
                    Интервью с клиентами
                  </h2>
                  <p className="text-[#78716C] text-sm mt-1 leading-relaxed">
                    Прямая речь 3-5 клиентов из разных сегментов. Не пересказ, а цитаты.
                    Формат не важен — Claude работает с любой разметкой.
                  </p>
                </div>
                <ProgressPill
                  valid={validCount}
                  required={MIN_INTERVIEWS}
                  total={slots.length}
                />
              </div>
            </Card.Body>
          </Card>

          {/* Слоты интервью */}
          <div className="space-y-4">
            {slots.map((slot, idx) => {
              const isRequired = idx < MIN_INTERVIEWS;
              const isOptional = !isRequired;
              const chars = slot.text.trim().length;
              const tooShort = chars > 0 && chars < MIN_CHARS_PER_INTERVIEW;
              const filled = chars >= MIN_CHARS_PER_INTERVIEW;
              return (
                <Card key={slot.id}>
                  <Card.Body>
                    <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`font-mono tabular-nums flex-shrink-0 w-7 h-7 rounded-full
                            text-[11px] font-semibold flex items-center justify-center ${
                              filled
                                ? 'bg-[#4F46E5] text-white'
                                : 'bg-[#F5F5F4] text-[#78716C]'
                            }`}
                          aria-hidden
                        >
                          {filled ? <Check className="w-3.5 h-3.5" /> : String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="text-sm font-semibold text-[#1A1A1A]">
                          Интервью {idx + 1}
                        </h3>
                        {isOptional && (
                          <Badge variant="soft" color="neutral">Необязательное</Badge>
                        )}
                        {filled && (
                          <Badge variant="soft" color="success">Готово</Badge>
                        )}
                      </div>
                      {isOptional && (
                        <button
                          type="button"
                          onClick={() => removeSlot(slot.id)}
                          className="flex items-center gap-1 text-[#78716C] hover:text-[#EF4444]
                            text-xs transition-colors rounded-md px-2 py-1 -my-1 -mx-1 hover:bg-[#FEF2F2]"
                          aria-label={`Удалить интервью ${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Удалить
                        </button>
                      )}
                    </div>

                    <Textarea
                      value={slot.text}
                      onChange={(e) => updateSlot(slot.id, e.target.value)}
                      rows={10}
                      sizeField="lg"
                      placeholder={
                        idx === 0
                          ? `Формат — Q&A, прямая речь клиента, 10-15 минут транскрипта.\nМинимум 5 из 7 вопросов JTBD (см. панель справа).\n\n— Расскажите, как вы впервые узнали о нас. Что тогда происходило?\n— …\n\n— Что пытались решить? Какую задачу хотели закрыть?\n— …\n\n— Почему выбрали именно нас? Что стало каплей?\n— …`
                          : idx === 1
                          ? 'Второй клиент — желательно из другого сегмента (возраст / доход / повод покупки).\nПрямая речь, не пересказ. Можно добавить возражения и критику — это полезнее, чем идеальный отзыв.\n\n— Расскажите…\n— …'
                          : 'Третий клиент — закрывает «слепые зоны» сегмента.\nБольше рисков — больше материала для Claude.\n\n— Расскажите…\n— …'
                      }
                      error={tooShort ? `Минимум ${MIN_CHARS_PER_INTERVIEW} символов` : undefined}
                      hint={
                        !tooShort
                          ? `${chars.toLocaleString('ru-RU')} символов · чем больше прямой речи, тем точнее паттерны`
                          : undefined
                      }
                      className="font-mono text-sm"
                    />
                    {/* «Показать пример» — разово заливает живой транскрипт Холст-бренда.
                        Виден только если слот пустой ИЛИ слишком короткий (маркетолог ещё
                        не начал работать всерьёз). Как только в слоте 200+ валидных символов,
                        кнопка скрывается — чтобы не провоцировать случайный overwrite.
                        Для idx >= EXAMPLE_TRANSCRIPTS.length (4-й и 5-й слоты) примера нет —
                        это намеренно, те слоты появляются только после того как маркетолог
                        уже понял формат по первым трём. */}
                    {!filled && idx < EXAMPLE_TRANSCRIPTS.length && (
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => fillExample(slot.id, idx)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md
                            text-xs font-medium text-[#4F46E5] hover:bg-[#EEF2FF]
                            transition-colors"
                          aria-label={`Заполнить интервью ${idx + 1} примером`}
                        >
                          <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                          Показать пример транскрипта
                        </button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              );
            })}
          </div>

          {/* Добавить ещё интервью (только если < MAX) */}
          {slots.length < MAX_INTERVIEWS && (
            <button
              type="button"
              onClick={addSlot}
              className="w-full rounded-2xl border border-dashed border-[#D6D3D1] bg-transparent
                hover:bg-[#FAFAF9] hover:border-[#A5B4FC] text-[#78716C] hover:text-[#4F46E5]
                transition-colors py-4 flex items-center justify-center gap-2 font-medium text-sm"
              aria-label="Добавить ещё одно интервью"
            >
              <Plus className="w-4 h-4" />
              Добавить ещё одно интервью ({slots.length}/{MAX_INTERVIEWS})
            </button>
          )}

          {/* Финальный CTA */}
          <Card>
            <Card.Body>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  {canSubmit ? (
                    <div className="w-9 h-9 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-[#16A34A]" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#F5F5F4] flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-[#A8A29E]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A]">
                      {canSubmit
                        ? 'Всё готово. Claude извлечёт паттерны'
                        : `Заполните ещё ${Math.max(0, MIN_INTERVIEWS - validCount)} ${pluralInterviews(
                            Math.max(0, MIN_INTERVIEWS - validCount),
                          )}`}
                    </p>
                    <p className="text-xs text-[#78716C] tabular-nums font-mono mt-0.5">
                      {validCount}/{MIN_INTERVIEWS} валидно · {totalChars.toLocaleString('ru-RU')} символов
                    </p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  iconLeft={Sparkles}
                  loading={loading}
                  onClick={runInterview}
                  disabled={!canSubmit}
                  data-testid="stage1-submit"
                >
                  {loading ? 'Claude анализирует…' : 'Извлечь паттерны'}
                </Button>
              </div>
            </Card.Body>
          </Card>

          {error && (
            <div
              role="alert"
              className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#B91C1C] flex gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div ref={draftRef}>
              <Stage1DraftView
                result={result}
                elapsed={elapsed}
                onFeedback={submitFeedback}
                onFinalize={handleFinalize}
                finalizing={finalizing}
                finalizeError={finalizeError}
              />
            </div>
          )}
        </div>

        {/* Suffler справа — контекстные подсказки */}
        <aside className="hidden xl:block">
          <SufflerPanel hints={hints} />
        </aside>
      </div>
    </WizardShell>
  );
}

// Рендер результата Stage 1. Разделение вынесено в отдельный компонент чтобы не
// раздувать основной JSX Stage1Page. Читает patterns либо из `ai.json`, либо из
// `row.payload.patterns` (на случай если роль возвращает degraded). Если оба пусты —
// честный empty-state вместо бесполезного «{}».
function Stage1DraftView({
  result,
  elapsed,
  onFeedback,
  onFinalize,
  finalizing,
  finalizeError,
}: {
  result: Stage1InterviewPatternsResponse;
  elapsed: number;
  onFeedback: (p: { rejected: string; reason: string; reformulate: string }) => Promise<void>;
  onFinalize: () => Promise<void>;
  finalizing: boolean;
  finalizeError: string;
}) {
  // patterns приоритет:
  //  1. ai.json — AIService парсит plain-text JSON в структуру ещё на backend
  //     (см. AIService.tryExtractJson). В 99% случаев этой ветки достаточно.
  //  2. row.payload.patterns — то что сохранено в Sheet 1 (тоже структура,
  //     если backend парсил успешно; строка — только legacy cached runs).
  //  3. ai.text + frontend parse — последняя линия обороны на случай если
  //     формат Claude изменится или backend деградировал.
  // Если всё три null → показываем DraftEmpty с сырым текстом (маркетолог
  // хотя бы увидит что вернул Claude).
  const patterns = useMemo<InterviewPatterns | null>(() => {
    const fromAi = result.ai?.json;
    if (fromAi && typeof fromAi === 'object' && !Array.isArray(fromAi) && !('toolCalls' in fromAi)) {
      return fromAi as InterviewPatterns;
    }
    const fromRow = result.row?.payload?.patterns;
    if (fromRow && typeof fromRow === 'object' && !Array.isArray(fromRow)) {
      return fromRow as InterviewPatterns;
    }
    if (typeof fromRow === 'string') {
      const parsed = tryParseJson(fromRow);
      if (parsed) return parsed;
    }
    const text = result.ai?.text;
    if (typeof text === 'string' && text.trim()) {
      const parsed = tryParseJson(text);
      if (parsed) return parsed;
    }
    return null;
  }, [result]);

  const runId = result.ai?.runId ?? '';
  const rawText = result.ai?.text ?? null;

  // Структурные блоки, которые живут над обычными корзинами: key_insight, top-3 похвал/нареканий.
  // Требуются каноном 3.1: «топ-3 за что хвалят / топ-3 за что ругают / ключевой инсайт».
  const interviewsCount = patterns?.interviews_count;
  const keyInsight = patterns?.key_insight?.trim();
  const topPraise = Array.isArray(patterns?.top_praise) ? patterns?.top_praise ?? [] : [];
  const topCriticism = Array.isArray(patterns?.top_criticism) ? patterns?.top_criticism ?? [] : [];

  // Категории для рендера — порядок важен (от ценности для Стадии 2 → к маркерам сегмента для Стадии 3).
  const groups: Array<{
    key: Exclude<keyof InterviewPatterns, 'interviews_count' | 'key_insight' | 'top_praise' | 'top_criticism' | 'segment_signals' | 'jobs_to_be_done' | 'quotes_for_owner_session'>;
    title: string;
    hint: string;
    accent: BulletAccent;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'pains', title: 'Боли клиента', hint: 'Что мешает, раздражает, расстраивает. Отсортировано по частоте; топ-3 выделены.', accent: 'pain', icon: Flame },
    { key: 'gains', title: 'Что радует в опыте', hint: 'Атрибуты сервиса и детали, за которые хвалят. Это не JTBD — это компоненты опыта.', accent: 'gain', icon: ThumbsUp },
    { key: 'repeated_phrases', title: 'Фразы клиента — материал для копирайтинга', hint: 'Дословные выражения (можно вставлять в сайт/рекламу без изменений).', accent: 'quote', icon: MessageSquareQuote },
    { key: 'emotional_markers', title: 'Эмоциональные маркеры', hint: 'Эмоции в языке клиента: страх, гордость, облегчение. Для анализа глубины, не для прямого копирайтинга.', accent: 'emotion', icon: Heart },
  ];

  // Есть ли хоть что-то для рендера?
  const hasAnyContent =
    !!keyInsight ||
    topPraise.length > 0 ||
    topCriticism.length > 0 ||
    groups.some((g) => normalizePatternList(patterns?.[g.key]).length > 0) ||
    normalizeJtbd(patterns?.jobs_to_be_done).length > 0 ||
    hasAnySegmentSignals(patterns?.segment_signals);

  // «Legacy» = черновик собран на старом промпте (до v2.0): нет ключевого инсайта,
  // нет top_praise/top_criticism, segment_signals плоским массивом. В этом случае
  // мы всё равно рендерим что можем, но честно предупреждаем маркетолога, что
  // часть канона 3.2 здесь отсутствует — и предлагаем перезапустить извлечение.
  const isLegacyPatterns =
    !!patterns &&
    hasAnyContent &&
    !keyInsight &&
    topPraise.length === 0 &&
    topCriticism.length === 0 &&
    Array.isArray(patterns.segment_signals);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Честность вместо эффектности: если backend отдал кэш — чип меняется на
            «Результат из кэша от N назад» вместо «Claude за 1 сек». Раньше рендерили
            одинаковый зелёный чип в обоих случаях, и на cache hit это выглядело как
            «Claude думает мгновенно» — методологически ложь («thinking partner», а не
            автогенератор). Свежая длительность берётся из `ai.latencyMs`, а не из
            HTTP round-trip (`elapsed` на cache hit ≈100мс → «1 сек»). */}
        <TimeSavedChip
          generationSeconds={result.ai?.cached ? (result.ai.latencyMs ?? 0) / 1000 : elapsed}
          manualMinutesEquivalent={180}
          cacheHit={result.ai?.cached === true}
          generatedAt={result.ai?.generatedAt}
        />
        {typeof interviewsCount === 'number' && interviewsCount > 0 && (
          <span className="text-xs text-[#78716C] font-mono tabular-nums">
            Проанализировано интервью: {interviewsCount}
          </span>
        )}
      </div>

      <Card>
        <Card.Header>
          <Card.Title>Черновик портрета клиента</Card.Title>
          <Badge variant="soft" color="primary" icon={Sparkles}>AI-черновик</Badge>
        </Card.Header>
        <Card.Body>
          {patterns && hasAnyContent ? (
            <div className="space-y-7">
              {/* Legacy-баннер: честно говорим, что черновик собран до v2.0 промпта,
                  и предлагаем перезапустить «Извлечь паттерны» для полного канона 3.2. */}
              {isLegacyPatterns && (
                <div
                  role="status"
                  className="rounded-2xl bg-[#FFFBEB] border border-[#FCD34D] p-4 text-sm text-[#92400E] flex gap-3"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="space-y-1">
                    <p className="font-medium">Черновик в формате v1.x</p>
                    <p className="leading-relaxed">
                      Здесь нет ключевого инсайта, топ-3 похвал/нареканий и 4 подкатегорий сегмента —
                      этот разбор был сделан до апгрейда методологии до 3.2. Нажмите
                      «Извлечь паттерны» ещё раз — Claude перезапустит разбор в канонический формат.
                    </p>
                  </div>
                </div>
              )}

              {/* Ключевой инсайт — выжимка канона 3.1 */}
              {keyInsight && (
                <div className="rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#4F46E5]" aria-hidden />
                    <span className="uppercase-mono text-[#4F46E5]">Ключевой инсайт</span>
                  </div>
                  <p className="text-[15px] leading-[1.55] text-[#1A1A1A] font-medium">
                    {keyInsight}
                  </p>
                </div>
              )}

              {/* Топ-3 похвалы + топ-3 нарекания бок-о-бок */}
              {(topPraise.length > 0 || topCriticism.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topPraise.length > 0 && (
                    <TopFormulationPanel
                      title="Топ-3: за что хвалят"
                      items={topPraise}
                      tone="praise"
                      total={interviewsCount}
                    />
                  )}
                  {topCriticism.length > 0 && (
                    <TopFormulationPanel
                      title="Топ-3: что раздражает в нише"
                      items={topCriticism}
                      tone="criticism"
                      total={interviewsCount}
                    />
                  )}
                </div>
              )}

              {/* Обычные корзины паттернов — по убыванию occurrences, с выделением топ-3 */}
              {groups.map((g) => {
                const items = normalizePatternList(patterns[g.key]);
                if (!items.length) return null;
                return (
                  <PatternSection
                    key={g.key}
                    title={g.title}
                    hint={g.hint}
                    accent={g.accent}
                    icon={g.icon}
                    items={items}
                    total={interviewsCount}
                  />
                );
              })}

              {/* JTBD — отдельный рендер из-за 3-частной структуры when/want/so_that */}
              {normalizeJtbd(patterns.jobs_to_be_done).length > 0 && (
                <JobsToBeDoneSection
                  items={normalizeJtbd(patterns.jobs_to_be_done)}
                  total={interviewsCount}
                />
              )}

              {/* Сигналы сегмента — 4 подкатегории или legacy flat массив */}
              {hasAnySegmentSignals(patterns.segment_signals) && (
                <SegmentSignalsSection
                  value={patterns.segment_signals}
                  total={interviewsCount}
                />
              )}
            </div>
          ) : (
            <DraftEmpty rawText={rawText} />
          )}
        </Card.Body>
      </Card>

      {runId && (
        <FeedbackForm draftId={runId} rowId={runId} onSubmit={onFeedback} />
      )}

      {/* CTA «Утвердить и перейти к Стадии 2» — виден только когда есть живой
          черновик (hasAnyContent). Если patterns пустые — нечего утверждать,
          маркетолог должен сперва переформулировать интервью. */}
      {patterns && hasAnyContent && (
        <Card>
          <Card.Body>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-4 h-4 text-[#16A34A]" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    Если черновик устраивает — переходите к Стадии 2
                  </p>
                  <p className="text-xs text-[#78716C] mt-1 leading-relaxed">
                    Паттерны зафиксируются и пойдут в «Сессию с собственником» как исходник
                    для миссии и ценностей. Сейчас это технический маркер закрытия стадии;
                    финальное утверждение Портрета клиента соберёте на Стадии 4 вместе со всем
                    итоговым документом.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="md"
                iconRight={ArrowRight}
                loading={finalizing}
                onClick={onFinalize}
                disabled={finalizing}
                data-testid="stage1-finalize"
              >
                {finalizing ? 'Закрываем Стадию 1…' : 'Перейти к Стадии 2'}
              </Button>
            </div>
            {finalizeError && (
              <div
                role="alert"
                className="mt-3 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#B91C1C] flex gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                <p>{finalizeError}</p>
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

type BulletAccent = 'pain' | 'gain' | 'jtbd' | 'quote' | 'emotion' | 'segment';

// Нормализованная запись паттерна. В рендере вся карточка собирается из этой формы —
// независимо от того, прилетел ли от backend новый объект (2.0+) или старая строка (1.x).
interface NormalizedPattern {
  label: string;
  occurrences: number;
  quotes: string[];
}

// ── Нормализаторы ─────────────────────────────────────────────────────────────

function normalizePatternList(value: unknown): NormalizedPattern[] {
  if (!Array.isArray(value)) return [];
  const normalized = value.map(normalizePatternEntry).filter((x): x is NormalizedPattern => !!x);
  // Сортировка по occurrences убыванию — канон 3.1 требует «топ-3» приоритизацию.
  normalized.sort((a, b) => b.occurrences - a.occurrences);
  return normalized;
}

function normalizePatternEntry(entry: unknown): NormalizedPattern | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    if (!trimmed) return null;
    return { label: trimmed, occurrences: 0, quotes: [] };
  }
  if (entry && typeof entry === 'object') {
    const e = entry as Record<string, unknown>;
    // Возможные ключи для основного текста — унифицируем:
    const label =
      (typeof e.pattern === 'string' && e.pattern) ||
      (typeof e.phrase === 'string' && e.phrase) ||
      (typeof e.marker === 'string' && e.marker) ||
      (typeof e.signal === 'string' && e.signal) ||
      '';
    if (!label) return null;
    const occurrences =
      (typeof e.occurrences === 'number' && e.occurrences) ||
      (typeof e.frequency === 'number' && e.frequency) ||
      0;
    const quotes = Array.isArray(e.quotes_for_owner_session)
      ? (e.quotes_for_owner_session as unknown[]).filter((q): q is string => typeof q === 'string')
      : [];
    return { label, occurrences, quotes };
  }
  return null;
}

function normalizeJtbd(value: unknown): JobToBeDone[] {
  if (!Array.isArray(value)) return [];
  const jobs = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const when = typeof e.when === 'string' ? e.when : '';
      const want = typeof e.want === 'string' ? e.want : '';
      const so_that = typeof e.so_that === 'string' ? e.so_that : '';
      // Legacy-форматы, с которыми мы всё равно встречаемся в уже сохранённых row.payload:
      //  · v1.x: {pattern} — только текст
      //  · v1.5 bridge: {job, context} — job как хочу-формулировка, context как когда
      //    Маппим их в канон 3.2, чтобы маркетолог не получал пустую секцию, но
      //    выводим баннер ниже (`isLegacyPatterns`), который честно говорит: «старый формат».
      const legacyJob = typeof e.job === 'string' ? e.job : '';
      const legacyContext = typeof e.context === 'string' ? e.context : '';
      const legacyPattern = typeof e.pattern === 'string' ? e.pattern : '';
      if (!when && !want && !so_that && !legacyJob && !legacyContext && !legacyPattern) {
        return null;
      }
      const occurrences =
        (typeof e.occurrences === 'number' && e.occurrences) ||
        (typeof e.frequency === 'number' && e.frequency) ||
        0;
      const quotes = Array.isArray(e.quotes_for_owner_session)
        ? (e.quotes_for_owner_session as unknown[]).filter((q): q is string => typeof q === 'string')
        : [];
      return {
        // Приоритет: канонические поля → legacy маппинг → plain pattern.
        when: when || legacyContext || '',
        want: want || legacyJob || legacyPattern || '',
        so_that: so_that,
        occurrences,
        quotes_for_owner_session: quotes,
      } as JobToBeDone;
    })
    .filter((x): x is JobToBeDone => !!x);
  jobs.sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0));
  return jobs;
}

function hasAnySegmentSignals(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    const buckets = value as SegmentSignalsBuckets;
    return (
      (buckets.demography?.length ?? 0) +
        (buckets.acquisition_channels?.length ?? 0) +
        (buckets.price_markers?.length ?? 0) +
        (buckets.behavior_patterns?.length ?? 0) >
      0
    );
  }
  return false;
}

// ── Render-компоненты ─────────────────────────────────────────────────────────

function TopFormulationPanel({
  title,
  items,
  tone,
  total,
}: {
  title: string;
  items: TopFormulation[];
  tone: 'praise' | 'criticism';
  total?: number;
}) {
  const Icon = tone === 'praise' ? ThumbsUp : ThumbsDown;
  const accentBg = tone === 'praise' ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]';
  const accentText = tone === 'praise' ? 'text-[#15803D]' : 'text-[#B91C1C]';
  return (
    <div className={`rounded-2xl border p-5 ${accentBg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accentText}`} aria-hidden />
        <span className={`uppercase-mono ${accentText}`}>{title}</span>
      </div>
      <ol className="space-y-3">
        {items.slice(0, 3).map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`font-mono flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center tabular-nums mt-[1px] ${tone === 'praise' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'}`}
              aria-hidden
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] leading-[1.5] text-[#1A1A1A] font-medium">
                {it.formulation}
              </p>
              {it.quote && (
                <p className="text-[13px] leading-[1.5] text-[#78716C] italic mt-1 border-l-2 border-[#E7E5E4] pl-3">
                  «{it.quote}»
                </p>
              )}
              {typeof it.occurrences === 'number' && it.occurrences > 0 && (
                <p className="text-[11px] font-mono text-[#78716C] mt-1 tabular-nums">
                  {formatOccurrences(it.occurrences, total)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PatternSection({
  title,
  hint,
  accent,
  icon: Icon,
  items,
  total,
}: {
  title: string;
  hint: string;
  accent: BulletAccent;
  icon: React.ComponentType<{ className?: string }>;
  items: NormalizedPattern[];
  total?: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 flex-shrink-0 ${iconAccent(accent)}`} />
          <h3 className="text-[15px] font-semibold text-[#1A1A1A] tracking-tight truncate">
            {title}
          </h3>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-[#A8A29E] flex-shrink-0">
          {items.length}
        </span>
      </div>
      <p className="text-xs text-[#78716C] mb-3 leading-relaxed">{hint}</p>
      <ul className="space-y-3">
        {items.map((it, i) => (
          <PatternRow
            key={i}
            item={it}
            accent={accent}
            isTop={i < 3 && it.occurrences >= 2}
            rank={i}
            total={total}
          />
        ))}
      </ul>
    </div>
  );
}

function PatternRow({
  item,
  accent,
  isTop,
  rank,
  total,
}: {
  item: NormalizedPattern;
  accent: BulletAccent;
  isTop: boolean;
  rank: number;
  total?: number;
}) {
  return (
    <li
      className={`flex gap-3 text-[14px] leading-[1.55] text-[#1A1A1A] ${
        isTop ? 'bg-[#FAFAF9] rounded-lg px-3 py-2.5 border border-[#E7E5E4]' : ''
      }`}
    >
      {isTop ? (
        <span
          className="font-mono flex-shrink-0 w-6 h-6 rounded-full bg-[#1A1A1A] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums mt-[1px]"
          aria-hidden
          title="Топ-3 по частоте"
        >
          {String(rank + 1).padStart(2, '0')}
        </span>
      ) : (
        <span
          className={`flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full ${accentDot(accent)}`}
          aria-hidden
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="flex-1">{item.label}</span>
          {item.occurrences > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-[#78716C] flex-shrink-0">
              {formatOccurrences(item.occurrences, total)}
            </span>
          )}
        </div>
        {item.quotes.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {item.quotes.map((q, i) => (
              <li
                key={i}
                className="text-[13px] leading-[1.5] text-[#78716C] border-l-2 border-[#E7E5E4]
                  pl-3 italic"
              >
                «{q}»
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function JobsToBeDoneSection({ items, total }: { items: JobToBeDone[]; total?: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Target className="w-4 h-4 flex-shrink-0 text-[#4F46E5]" />
          <h3 className="text-[15px] font-semibold text-[#1A1A1A] tracking-tight truncate">
            Jobs-to-be-done
          </h3>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-[#A8A29E] flex-shrink-0">
          {items.length}
        </span>
      </div>
      <p className="text-xs text-[#78716C] mb-3 leading-relaxed">
        Для чего клиент реально «нанимает» услугу. Канонический формат JTBD:
        <span className="font-mono text-[#4F46E5]"> когда → хочу → чтобы</span>.
      </p>
      <ul className="space-y-3">
        {items.map((job, i) => {
          const occ = job.occurrences ?? 0;
          const isTop = i < 3 && occ >= 2;
          return (
            <li
              key={i}
              className={`flex gap-3 text-[14px] leading-[1.55] text-[#1A1A1A] ${
                isTop ? 'bg-[#F5F3FF] rounded-lg px-3 py-2.5 border border-[#DDD6FE]' : ''
              }`}
            >
              {isTop ? (
                <span
                  className="font-mono flex-shrink-0 w-6 h-6 rounded-full bg-[#4F46E5] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums mt-[1px]"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
              ) : (
                <span
                  className="flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-[#4F46E5]"
                  aria-hidden
                />
              )}
              <div className="flex-1 min-w-0">
                {job.when || job.want || job.so_that ? (
                  <dl className="space-y-1">
                    {job.when && (
                      <div className="flex gap-2">
                        <dt className="uppercase-mono text-[#4F46E5] min-w-[60px]">Когда</dt>
                        <dd className="flex-1">{job.when}</dd>
                      </div>
                    )}
                    {job.want && (
                      <div className="flex gap-2">
                        <dt className="uppercase-mono text-[#4F46E5] min-w-[60px]">Хочу</dt>
                        <dd className="flex-1">{job.want}</dd>
                      </div>
                    )}
                    {job.so_that && (
                      <div className="flex gap-2">
                        <dt className="uppercase-mono text-[#4F46E5] min-w-[60px]">Чтобы</dt>
                        <dd className="flex-1">{job.so_that}</dd>
                      </div>
                    )}
                  </dl>
                ) : null}
                {occ > 0 && (
                  <p className="text-[11px] font-mono tabular-nums text-[#78716C] mt-1.5">
                    {formatOccurrences(occ, total)}
                  </p>
                )}
                {job.quotes_for_owner_session && job.quotes_for_owner_session.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {job.quotes_for_owner_session.map((q, j) => (
                      <li
                        key={j}
                        className="text-[13px] leading-[1.5] text-[#78716C] border-l-2 border-[#DDD6FE] pl-3 italic"
                      >
                        «{q}»
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SegmentSignalsSection({
  value,
  total,
}: {
  value: InterviewPatterns['segment_signals'];
  total?: number;
}) {
  // Новый формат — объект с 4 подкатегориями. Legacy — плоский массив.
  const isBuckets = value && !Array.isArray(value) && typeof value === 'object';
  const subSections: Array<{ title: string; hint: string; items: NormalizedPattern[] }> = [];

  if (isBuckets) {
    const b = value as SegmentSignalsBuckets;
    const bucketDefs: Array<[string, string, unknown]> = [
      ['Демография', 'Возраст, пол, семейный статус, география, профессия.', b.demography],
      ['Каналы привлечения', 'Через что пришли: рекомендация, отзывы, реклама, сарафан.', b.acquisition_channels],
      ['Ценовые маркеры', 'Средний чек, отношение к скидкам, порог отказа.', b.price_markers],
      ['Поведение при выборе', 'Как выбирают и используют: сравнивают, читают отзывы, задают вопросы.', b.behavior_patterns],
    ];
    for (const [t, h, v] of bucketDefs) {
      const items = normalizePatternList(v);
      if (items.length) subSections.push({ title: t, hint: h, items });
    }
  } else {
    // Legacy — единый блок
    const items = normalizePatternList(value);
    if (items.length) subSections.push({ title: 'Сигналы сегмента', hint: 'Общий список — устаревший формат 1.x.', items });
  }

  if (!subSections.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 flex-shrink-0 text-[#0EA5E9]" />
        <h3 className="text-[15px] font-semibold text-[#1A1A1A] tracking-tight">
          Сигналы сегмента
        </h3>
      </div>
      <p className="text-xs text-[#78716C] mb-4 leading-relaxed">
        Разбиты на 4 подкатегории — чтобы на Стадии 3 не пришлось заново сортировать
        демографию, каналы, цены и поведение.
      </p>
      <div className="space-y-5">
        {subSections.map((s) => (
          <div key={s.title} className="rounded-xl bg-[#F0F9FF] border border-[#BAE6FD] p-4">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h4 className="text-[14px] font-semibold text-[#0C4A6E]">{s.title}</h4>
              <span className="text-[11px] font-mono tabular-nums text-[#0369A1] flex-shrink-0">
                {s.items.length}
              </span>
            </div>
            <p className="text-xs text-[#0369A1] mb-3 leading-relaxed opacity-80">{s.hint}</p>
            <ul className="space-y-2">
              {s.items.map((it, i) => (
                <li key={i} className="flex gap-2 text-[14px] leading-[1.55] text-[#0C4A6E]">
                  <span className="flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full bg-[#0EA5E9]" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="flex-1">{it.label}</span>
                      {it.occurrences > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-[#0369A1] flex-shrink-0">
                          {formatOccurrences(it.occurrences, total)}
                        </span>
                      )}
                    </div>
                    {it.quotes.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {it.quotes.map((q, j) => (
                          <li key={j} className="text-[12px] leading-[1.4] text-[#0369A1] italic opacity-85">
                            «{q}»
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// «Упомянуто в N из M интервью» — канон 3.1 требует явной частоты для top-3 приоритизации.
// Если total неизвестен, показываем просто «×N».
function formatOccurrences(occ: number, total?: number): string {
  if (typeof total === 'number' && total > 0) {
    return `упомянуто в ${occ} из ${total} интервью`;
  }
  return `×${occ}`;
}

function iconAccent(accent: BulletAccent): string {
  switch (accent) {
    case 'pain': return 'text-[#EF4444]';
    case 'gain': return 'text-[#16A34A]';
    case 'jtbd': return 'text-[#4F46E5]';
    case 'quote': return 'text-[#F59E0B]';
    case 'emotion': return 'text-[#EC4899]';
    case 'segment': return 'text-[#0EA5E9]';
    default: return 'text-[#A8A29E]';
  }
}

// Утилита — пытается распарсить JSON из произвольной строки. Claude иногда оборачивает ответ
// в markdown ```json ... ```, иногда вставляет префикс — пробуем оба варианта. Возвращает
// object или null (не бросает — caller показывает fallback).
function tryParseJson(text: string): InterviewPatterns | null {
  const attempts: string[] = [];
  const trimmed = text.trim();
  attempts.push(trimmed);
  // strip ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) attempts.push(fenceMatch[1].trim());
  // extract first {...} block
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    attempts.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const a of attempts) {
    try {
      const parsed = JSON.parse(a);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as InterviewPatterns;
      }
    } catch {
      // следующая попытка
    }
  }
  return null;
}

// Цветная точка-булит для визуальной группировки категорий. Не критично для доступности —
// заголовок группы уже несёт смысл, точка — декор.
function accentDot(accent?: BulletAccent): string {
  switch (accent) {
    case 'pain': return 'bg-[#EF4444]';
    case 'gain': return 'bg-[#16A34A]';
    case 'jtbd': return 'bg-[#4F46E5]';
    case 'quote': return 'bg-[#F59E0B]';
    case 'emotion': return 'bg-[#EC4899]';
    case 'segment': return 'bg-[#0EA5E9]';
    default: return 'bg-[#A8A29E]';
  }
}

// Переводит технический reject-код из AIService в человеческую фразу для маркетолога.
// Список синхронизирован с backend/src/ai/ai.service.ts (rejected() + degraded() callsites).
// Важно: без англицизмов, без «ERROR_CODE», без «попробуйте ещё раз» в пустоту —
// каждое сообщение несёт конкретное действие или ожидание. «Roundtrip limit hit» —
// реальный лимит 5 вызовов на стадию в час, это методологический инвариант
// (анти-ping-pong), а не баг. Маркетологу надо подождать или уже использовать
// ранее извлечённые паттерны.
function translateRejectReason(reason: string): string {
  if (reason === 'roundtrip_limit_hit') {
    return 'На этой стадии уже 5 вызовов Claude за последний час — методологический лимит анти-ping-pong. Подождите до часа либо утвердите один из предыдущих черновиков и перейдите дальше.';
  }
  if (reason === 'BUDGET_EXCEEDED') {
    return 'Исчерпан AI-бюджет этого проекта. Попросите администратора увеличить budgetUsd в настройках проекта.';
  }
  if (reason === 'DAILY_CAP_EXCEEDED') {
    return 'Исчерпан дневной потолок AI-затрат на всей платформе. Попробуйте завтра или свяжитесь с администратором.';
  }
  if (reason === 'no_vendor_available') {
    return 'Ни один LLM-вендор не настроен. Администратору: проверьте ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENAI_COMPAT_API_KEY в backend/.env.';
  }
  if (reason === 'tool_not_whitelisted') {
    return 'Claude вернул вызов несанкционированного инструмента — вызов отклонён системой безопасности. Зафиксировано в security-events, администратор уведомлён.';
  }
  if (reason.startsWith('llm_failed:')) {
    const code = reason.slice('llm_failed:'.length);
    if (code.includes('rate_limited')) {
      return 'Вендор LLM сейчас перегружен (rate limit). Подождите 1-2 минуты и попробуйте ещё раз.';
    }
    if (code.includes('auth')) {
      return 'Ключ доступа к LLM-вендору недействителен. Администратору: проверьте ANTHROPIC_API_KEY / OPENAI_API_KEY.';
    }
    if (code.includes('context_too_long')) {
      return 'Транскрипт слишком длинный для одного вызова. Разбейте на 2-3 части и вызовите извлечение дважды.';
    }
    return `Связаться с LLM-вендором не удалось (${code}). Попробуйте ещё раз через минуту.`;
  }
  return `Запрос отклонён системой: ${reason}. Если повторяется — напишите администратору со скриншотом.`;
}

// Если LLM вернула текст без JSON (degraded / parsing fail) — показываем сырой текст
// в mono-блоке, чтобы маркетолог видел что Claude реально сказал. Если вообще пусто —
// честный empty state с подсказкой.
function DraftEmpty({ rawText }: { rawText: string | null }) {
  if (rawText && rawText.trim().length > 0) {
    return (
      <div>
        <p className="text-xs text-[#78716C] mb-3 leading-relaxed">
          Claude вернул ответ без структуры. Это бывает при редком формате интервью —
          прочтите сырой текст, скопируйте значимое вручную в Sheet 1.
        </p>
        <pre
          className="font-mono text-xs bg-[#F5F5F4] text-[#1A1A1A]
            rounded-xl p-4 overflow-auto leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {rawText}
        </pre>
      </div>
    );
  }
  return (
    <div className="py-8 text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[#FAFAF9] flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-[#A8A29E]" aria-hidden />
      </div>
      <p className="text-sm text-[#1A1A1A] font-medium mb-1">Черновик пустой</p>
      <p className="text-[13px] text-[#78716C] leading-relaxed max-w-md mx-auto">
        Claude не нашёл устойчивых паттернов. Попробуйте добавить больше прямой речи
        клиентов или разных сегментов — и запустите извлечение ещё раз.
      </p>
    </div>
  );
}

// Индикатор в шапке: сколько валидных слотов / сколько нужно / сколько всего открыто.
function ProgressPill({
  valid,
  required,
  total,
}: {
  valid: number;
  required: number;
  total: number;
}) {
  const reached = valid >= required;
  return (
    <div
      className={`flex-shrink-0 rounded-full px-4 py-2 flex items-center gap-2 text-xs font-medium
        ${reached ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F5F5F4] text-[#78716C]'}`}
      role="status"
      aria-live="polite"
    >
      {reached ? <Check className="w-3.5 h-3.5" aria-hidden /> : null}
      <span className="tabular-nums">
        {valid}/{required} {reached ? 'готово' : 'обязательно'}
      </span>
      {total > required && (
        <span className="text-[10px] font-mono opacity-70 tabular-nums">+{total - required}</span>
      )}
    </div>
  );
}

function pluralInterviews(n: number): string {
  // ru-RU: 1 интервью, 2-4 интервью, 5 интервью (слово не склоняется по падежу, но кол-во)
  // — используем простую форму "интервью" во всех случаях.
  return 'интервью';
}
