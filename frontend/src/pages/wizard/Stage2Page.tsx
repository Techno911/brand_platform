import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Sparkles, MessagesSquare, CheckCircle2, Send, AlertCircle, Lightbulb,
  FileText, ArrowRight,
} from 'lucide-react';
import WizardShell from './WizardShell';
import Stage2DraftView from './Stage2DraftView';
import SufflerPanel, { type SufflerHint } from '../../components/SufflerPanel';
import TimeSavedChip from '../../components/TimeSavedChip';
import OnboardingBanner from '../../components/OnboardingBanner';
import FeedbackForm from '../../components/FeedbackForm';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import FinalizedStageView from '../../components/FinalizedStageView';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { Textarea } from '../../components/ui/Input';
import Tabs from '../../components/ui/Tabs';
import { http } from '../../api/http';
import { useProjectRole } from '../../hooks/useProjectRole';
import type { AIResult, AIInvokeResult, Project, Row } from '../../types/api';

type Block = 'challenge' | 'legend' | 'values' | 'mission';

const BLOCKS: Block[] = ['challenge', 'legend', 'values', 'mission'];

// Challenge — live thinking-partner (маркетолог пастит ответы собственника, Claude
// задаёт контр-вопросы), БЕЗ артефакта. Поэтому accept на challenge не персистится
// и не считается для «готов ли черновик к отправке». Артефакты стадии 2 — только
// legend/values/mission, их и гейтим для submitForApproval. Раньше allAccepted
// требовал 4/4 включая challenge → после любого рефреша challenge.accepted = false
// → кнопка «На одобрение собственника» permanently disabled даже при 3 валидных
// артефактах. Обнаружено 2026-04-20 во время фикса inline-CTA карточки.
const PERSISTENT_BLOCKS: Block[] = ['legend', 'values', 'mission'];

const ENDPOINT: Record<Block, string> = {
  challenge: '/wizard/stage-2/challenge-owner',
  legend: '/wizard/stage-2/legend-draft',
  values: '/wizard/stage-2/values-draft',
  mission: '/wizard/stage-2/mission-variants',
};

// Multi-line placeholder'ы + exampleTemplate + canvasExpectation снимают «когнитивный налог»:
//  · placeholder показывает СТРУКТУРУ (не контент) — маркетолог сразу видит, что Q→A и сколько.
//  · exampleTemplate заливается кнопкой «Показать пример» — живой реалистичный текст из ниши одежды,
//    маркетолог читает и стирает / переписывает под своего клиента. Не ждёт Claude впустую.
//  · canvasExpectation рендерится в EmptyCanvasPlaceholder — говорит заранее, что появится справа,
//    убирает страх «а что вообще будет?».
// Все примеры намеренно нейтральны по нише (можно перенести на стоматологию / ресторан / автосервис),
// но написаны живым языком, без штампов — это показывает маркетологу уровень детализации.
const LABELS: Record<Block, {
  short: string;
  title: string;
  hint: string;
  placeholder: string;
  exampleTemplate: string;
  canvasExpectation: string;
  cta: string;
  feedbackArtifact: string;
}> = {
  challenge: {
    short: 'Уточнения',
    title: 'Уточнения для собственника',
    hint: 'Вставьте ответы собственника на первый блок вопросов. Claude сыграет роль напарника — уточнит, переспросит, снимет общие фразы.',
    placeholder:
      'Вопрос 1: Расскажите историю бренда — как начинали, почему пошли в это дело?\n' +
      'Ответ: …\n\n' +
      'Вопрос 2: Чем гордитесь? Что НЕ стали бы делать даже за хорошие деньги?\n' +
      'Ответ: …\n\n' +
      'Вопрос 3: Был случай, когда отказали клиенту? Почему именно ему?\n' +
      'Ответ: …',
    exampleTemplate:
      'Вопрос 1: Расскажите историю бренда — как начинали, почему пошли в одежду?\n' +
      'Ответ: Я 15 лет работала закупщицей в массмаркете. Надоело продавать вещи, которые теряют форму после двух стирок. В 2020 открыла мастерскую — только натуральные ткани, ручная сборка. Первый год шила на заказ подругам.\n\n' +
      'Вопрос 2: Чем гордитесь? Что НЕ стали бы делать даже за деньги?\n' +
      'Ответ: Не работаем с синтетикой вообще. Два года назад приходил клиент — заказ на 400 штук корпоративного мерча из полиэстера. Отказала. Моя швея месяц без работы сидела, но мы правила не переступаем.\n\n' +
      'Вопрос 3: Был случай, когда отказали клиенту?\n' +
      'Ответ: Девушка просила срочно, в три дня, свадебное платье. Шили неделю. Я ей сказала: «в понедельник вы не получите платье, но в четверг получите платье, в котором не стыдно». Она согласилась, потом написала что лучший день жизни.',
    canvasExpectation:
      'Список уточняющих вопросов (3-7 шт.) с объяснением, что они должны вскрыть. Плюс разбор ответов собственника на поверхностные и глубокие сигналы — подсветит где копать дальше.',
    cta: 'Сформулировать уточняющие вопросы',
    feedbackArtifact: 'stage_2.challenge',
  },
  legend: {
    short: 'Легенда',
    title: 'Легенда бренда',
    hint: 'Вставьте «жизнеописание» собственника — биография, поворотные моменты, почему открыл этот бизнес, на чём «сломался».',
    placeholder:
      'Где и как рос, чем занимался до бизнеса.\n' +
      'Поворотный момент — что заставило уйти в своё.\n' +
      'Провалы и ошибки, которые формировали характер.\n' +
      'Момент, когда бизнес «щёлкнул» и стал тем, что сейчас.\n\n' +
      'Желательно 1 000+ символов. Можно прямой речью собственника, можно от третьего лица.',
    exampleTemplate:
      'Анна выросла в Иваново в семье текстильщиков. Мать 30 лет работала на фабрике, отец — закройщик. В детстве дома всегда пахло шерстью и горячим утюгом.\n\n' +
      'После школы уехала в Москву, пошла работать закупщицей в Zara. 15 лет в массмаркете — от байера до директора категории. Умела считать маржу на глаз.\n\n' +
      'Сломалась в 2019 году. Инвентаризация склада — 40 тысяч блузок из вискозы, которые никто не стал покупать после двух стирок. Их списали. Анна впервые поняла, что её работа — делать мусор.\n\n' +
      'В 2020, в первый локдаун, купила две швейные машинки и 10 рулонов льна из Ивановского склада, который закрывался. Шила у себя на кухне первые 3 месяца — на заказ подругам. Первая клиентка — журналистка, написала про мастерскую: «по цене одного свитера Uniqlo вы получаете вещь, которая переживёт ваш развод». Статья разошлась.\n\n' +
      'Сейчас в штате 6 швей, все — женщины 45+, которых не брали на фабрики из-за возраста. Анна принципиально не берёт молодых: «у них ещё руки не поставлены».',
    canvasExpectation:
      'Черновик легенды в 3-5 абзацев, со структурой «откуда пришёл → слом → озарение → как стало бизнесом». Плюс 2-3 альтернативные концовки, между которыми можно выбрать.',
    cta: 'Сгенерировать черновик легенды',
    feedbackArtifact: 'stage_2.legend',
  },
  values: {
    short: 'Ценности',
    title: 'Ценности (3-5 штук, каждая — конкретное поведение)',
    hint: 'Вставьте ответы собственника на вопрос «что НЕ купили бы даже за большие деньги / за что точно бы уволили?» — из этого рождаются ценности.',
    placeholder:
      'За что точно уволили бы сотрудника (одним-двумя реальными случаями)?\n' +
      'От каких клиентов отказываетесь даже с большим чеком, и почему?\n' +
      'Что делаете, даже когда никто не смотрит?\n' +
      'Чем отличаетесь от конкурентов на поведенческом уровне, не на словах?',
    exampleTemplate:
      'За что увольняли. Швея Лена пришила подкладку со смещением на 2 мм — клиентка бы не заметила. Лена не пересшила, сдала как есть. Уволили в тот же день. Через неделю её сын позвонил — семья без денег, просил взять обратно. Не взяли. У нас не воспитывают, у нас приходят уже взрослыми.\n\n' +
      'От каких клиентов отказываемся. Девушка заказала 12 платьев «под ивент» — собиралась сдавать в аренду через свой инстаграм. Я отказала. Мои вещи не про «одеться на фото» — они про то, что ты носишь 10 лет. Она обиделась, но 400 тысяч я не жалею.\n\n' +
      'Что делаем, когда никто не смотрит. Перешиваем вещь, даже если клиент забыл её у нас три месяца назад. Подкладка в кармане — белая, не серая как у всех. Этикетки пришиваем вручную изнутри, не термостикеры — стикер через год отклеится, прошивка останется.\n\n' +
      'Чем отличаемся. Не делаем скидок вообще. Не участвуем в чёрных пятницах. Не снимаем вещь с производства, если её носит хотя бы одна клиентка — у нас пальто из коллекции 2020 до сих пор в прайсе, по той же цене.',
    canvasExpectation:
      '3-5 ценностей. Каждая — краткая формулировка + 2-3 поведенческих маркера (что делаем / что НЕ делаем) + подчёркнуто, какие клише Claude убрал из ваших ответов.',
    cta: 'Сгенерировать черновик ценностей',
    feedbackArtifact: 'stage_2.values',
  },
  mission: {
    short: 'Миссия',
    title: 'Миссия (3 варианта)',
    hint: 'Вставьте ответы собственника на вопрос «если завтра закрываем бизнес — чего не станет в мире, кроме денег?». Claude даст 3 варианта формулировки.',
    placeholder:
      'Для кого существует бренд — конкретный архетип клиента, не «все женщины 25-45».\n' +
      'Чтобы что изменилось у клиента — функциональный плюс эмоциональный результат.\n' +
      'Какую ложь бренд отказывается говорить — что мы никогда не обещаем.\n' +
      'Что останется, если завтра компания исчезнет, кроме денег.',
    exampleTemplate:
      'Для кого. Женщина 35-55, которая перешла из «покупаю 30 вещей в год на Lamoda» в «покупаю 6 вещей в сезон и ношу 5 лет». Обычно после развода, выгорания или повышения. Она больше не хочет доказывать, что «модная».\n\n' +
      'Чтобы что. Чтобы перестать каждое утро полчаса стоять перед гардеробом. Чтобы вещь не ломалась в самый важный день. Чтобы не чувствовать стыд за участие в индустрии, которая травит текстильщиц и сливает краску в реки.\n\n' +
      'Какую ложь не говорим. Не говорим «доступно» — пальто стоит 68 тысяч. Не говорим «для каждой» — мы не для каждой. Не говорим «бесконечная мода» — нам не нужны сезонные коллекции.\n\n' +
      'Что останется, если закроемся. Останется 6 швей 45+, которых снова никто не возьмёт. Останется 3 000 клиенток с 4-7 нашими вещами в шкафу, которые они будут носить ещё 10 лет. Останется пример — что малое ателье может конкурировать с мировыми брендами в своей нише.',
    canvasExpectation:
      '3 варианта миссии в разных регистрах (рациональный / эмоциональный / провокационный). Каждый проверен на запрещённые слова: «прибыль», «оборот», «заработать» — валидатор блокирует их красным.',
    cta: 'Сгенерировать 3 варианта миссии',
    feedbackArtifact: 'stage_2.mission',
  },
};

// Контекстные подсказки по активному блоку. До этого hints были общие для всей стадии и не менялись
// при переключении вкладки — маркетолог тратил внимание на нерелевантные тексты. Теперь на каждом
// шаге он видит только свои риски и свои формулы.
const HINTS_BY_BLOCK: Record<Block, SufflerHint[]> = {
  challenge: [
    {
      id: 'ch-1',
      title: 'Где взять вопросы',
      body: 'Вернитесь на Стадию 1 → секция «Jobs-to-be-done» и «Цитаты для сессии с собственником». Оттуда — первые 3 вопроса по свежим следам клиентов.',
    },
    {
      id: 'ch-2',
      title: 'Маркеры поверхностного ответа',
      body: 'Если видите «качество», «индивидуальный подход», «команда профессионалов», «клиентоориентированность» — это клише. Claude сам подсветит такие фразы и задаст вопрос вглубь.',
      severity: 'warning',
    },
    {
      id: 'ch-3',
      title: 'Формат Q → A',
      body: 'Вставляйте «Вопрос: …», потом «Ответ: …». Claude поймёт структуру и разметит, где ответ поверхностный (нужно копать), где глубокий (можно двигаться дальше).',
    },
  ],
  legend: [
    {
      id: 'lg-1',
      title: 'Легенда ≠ CV',
      body: 'Легенда — это НЕ биография в духе «родился, учился, женился». Нужны 3-5 поворотных моментов: слом → вопрос «зачем я это делаю» → ответ через действие.',
    },
    {
      id: 'lg-2',
      title: 'Прямая речь сильнее',
      body: 'Можно от третьего лица, но вставки прямой речи собственника («я тогда сказал себе…») дают Claude живой материал. Без них черновик получается пресным.',
    },
    {
      id: 'lg-3',
      title: 'Без розовой упаковки',
      body: 'Если в тексте нет провала, ошибки или боли — Claude сгенерирует статью из Wikipedia. Добавьте реальные кризисы, даже если собственник стесняется.',
      severity: 'warning',
    },
  ],
  values: [
    {
      id: 'vl-1',
      title: 'Ценность = поведение, не слово',
      body: 'Ценность — это НЕ «качество», «надёжность», «доверие». Это: «уволили за то, что не пересшил подкладку на 2 мм» или «отказали клиенту на 400к из-за полиэстера».',
      severity: 'warning',
    },
    {
      id: 'vl-2',
      title: 'Запрещённые клише',
      body: 'Если в тексте есть «профессионализм», «клиентоориентированность», «индивидуальный подход» — вычеркните и замените конкретным случаем. Иначе валидатор вернёт на правку.',
    },
    {
      id: 'vl-3',
      title: 'Тест «что НЕ сделаем»',
      body: 'Сильная ценность имеет обратную сторону — то, что бренд точно НЕ делает. Если обратной стороны нет — это общая фраза, а не ценность.',
    },
  ],
  mission: [
    {
      id: 'ms-1',
      title: 'Маркер денег — STOP',
      body: 'Миссия НЕ может содержать слова «заработать», «прибыль», «выручка», «оборот». Валидатор заблокирует красным, собственник не сможет утвердить.',
      severity: 'danger',
    },
    {
      id: 'ms-2',
      title: 'Формула «для кого → чтобы → без лжи»',
      body: 'Сильная миссия = ДЛЯ КОГО (архетип клиента) + ЧТОБЫ ЧТО (функциональный и эмоциональный результат) + БЕЗ ЛЖИ (что бренд точно не обещает).',
    },
    {
      id: 'ms-3',
      title: 'Тест «мир без нас»',
      body: 'Проверка: если завтра бренд исчезнет — чего не станет, кроме денег? Если ответ «ничего» — миссии пока нет, надо копать ответы собственника глубже.',
    },
  ],
};

interface BlockState {
  text: string;
  result: AIResult | null;
  elapsed: number;
  accepted: boolean;
}

const INITIAL_STATE: BlockState = { text: '', result: null, elapsed: 0, accepted: false };

// Backend response envelope. Wizard-контроллеры (legend/values/mission) оборачивают
// AI-ответ в `{row, ai}`. Challenge (`challenge-owner-response`) отдаёт голый
// AIInvokeResult. Нормализатор ниже приводит оба варианта к одной форме.
type Stage2Envelope =
  | { row: Row | null; ai: AIInvokeResult<any> }
  | AIInvokeResult<any>;

function normalizeAI(raw: Stage2Envelope): AIInvokeResult<any> {
  return 'ai' in raw ? raw.ai : (raw as AIInvokeResult<any>);
}

// Тот же перевод reject-reason в человекочитаемое сообщение, что живёт в
// Stage1Page.tsx. Дублируем здесь намеренно: Stage 1 и Stage 2 — разные
// страницы с разными lifecycle'ами, копипаста дешевле вынесения в общий
// helper (который притянет Stage 3/4 зависимость). Класс ошибок silent-
// rejection (журнал CLAUDE.md 2026-04-19): любой endpoint возвращающий
// AIInvokeResult ОБЯЗАН ветвить ok:false и переводить rejectReason.
function translateRejectReason(reason: string): string {
  if (reason === 'roundtrip_limit_hit') {
    return 'На этой стадии уже 5 вызовов Claude за последний час — методологический лимит анти-ping-pong. Подождите до часа либо утвердите предыдущий черновик.';
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
    return 'Claude вернул вызов несанкционированного инструмента — вызов отклонён системой безопасности. Зафиксировано в security-events.';
  }
  if (reason === 'PROJECT_BUSY') {
    return 'Другой вызов Claude по этому проекту уже идёт. Подождите 5-10 секунд и повторите — параллельные вызовы запрещены методологией.';
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
      return 'Текст слишком длинный для одного вызова. Сократите или разбейте на 2 части.';
    }
    return `Связаться с LLM-вендором не удалось (${code}). Попробуйте ещё раз через минуту.`;
  }
  return `Запрос отклонён системой: ${reason}. Если повторяется — напишите администратору со скриншотом.`;
}

export default function Stage2Page() {
  const { id } = useParams<{ id: string }>();
  const { isOwnerViewer } = useProjectRole(id);
  // См. комментарий в Stage1Page: архивный вид для finalized-проектов.
  const [projectMeta, setProjectMeta] = useState<Project | null>(null);
  useEffect(() => {
    if (!id) return;
    http.get<Project>(`/projects/${id}`).then((res) => setProjectMeta(res.data)).catch(() => {});
  }, [id]);
  const isFinalized = projectMeta?.status === 'finalized' || projectMeta?.status === 'archived';
  const [active, setActive] = useState<Block>('challenge');
  const [blocks, setBlocks] = useState<Record<Block, BlockState>>({
    challenge: { ...INITIAL_STATE },
    legend: { ...INITIAL_STATE },
    values: { ...INITIAL_STATE },
    mission: { ...INITIAL_STATE },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Тост «Блок X утверждён → переходим к Y». Без визуальной подтверждалки
  // accept ощущался как ничего-не-делание: badge на CanvasCard менялся тихо,
  // tab сбоку подсвечивался мелко, маркетолог не считывал событие.
  // Артём 2026-04-20: «нажал принять, ничего не произошло».
  const [acceptToast, setAcceptToast] = useState<{ from: Block; to: Block | null } | null>(null);
  // submittedAt — timestamp успешного запроса на одобрение. Когда установлен,
  // sticky-бар «На одобрение собственника» меняется на зелёный баннер «отправлено, ждём».
  // In-memory state: если маркетолог перезагрузит страницу, факт сабмита сейчас теряется;
  // бэк пишет audit_event, восстановление будет добавлено вместе с Telegram-дайджестом
  // (раздел Post-MVP). Для текущей задачи (чтобы маркетолог видел результат клика) достаточно.
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  // Восстановление стейта 3 блоков (legend/values/mission) при возврате маркетолога.
  // Challenge — live thinking partner, не персистится (его ввод — ответы собственника
  // в режиме рилтайма, сохранять их как row нет смысла: они попадают внутрь Stage 1/2
  // обоих контекстов). Без этой подгрузки маркетолог видит пустую Stage 2, при этом
  // Claude уже генерировал на бэке — Артём 2026-04-20: «нажал принять, ничего не произошло».
  type BlockSnapshot = { text: string; draft: unknown; accepted: boolean };
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    http
      .get<{ legend: BlockSnapshot; values: BlockSnapshot; mission: BlockSnapshot }>(
        `/wizard/stage-2/state?projectId=${id}`,
      )
      .then((res) => {
        if (cancelled) return;
        const { legend, values, mission } = res.data;
        const toBlockState = (s: BlockSnapshot): BlockState => {
          if (!s.draft && !s.text) return { ...INITIAL_STATE };
          // Defensive decode: в старых строках БД draft мог лечь строкой-JSON (старый
          // `r.text ?? r.json` путь до 2026-04-20). Фронт-side LegendView / ValuesView
          // падали в FallbackText и рендерили сырой JSON. Пробуем распарсить: если
          // получился объект — отдаём его как json, иначе оставляем в text (и тогда
          // FallbackText хотя бы покажет plain text, не «нестандартный вид»).
          let draftJson: unknown = s.draft;
          let draftText: string | undefined;
          if (typeof s.draft === 'string') {
            const trimmed = s.draft.trim();
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              try {
                draftJson = JSON.parse(trimmed);
              } catch {
                draftJson = null;
                draftText = trimmed;
              }
            } else {
              draftJson = null;
              draftText = trimmed;
            }
          }
          return {
            text: s.text ?? '',
            result: s.draft
              ? ({
                  promptRunId: 'restored',
                  status: 'ok',
                  json: draftJson ?? null,
                  text: draftText,
                } as AIResult)
              : null,
            elapsed: 0,
            accepted: !!s.accepted,
          };
        };
        setBlocks({
          challenge: { ...INITIAL_STATE },
          legend: toBlockState(legend),
          values: toBlockState(values),
          mission: toBlockState(mission),
        });
      })
      .catch(() => {
        /* тихий фэйл: пустая форма лучше сломанной страницы */
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const current = blocks[active];

  const updateBlock = (block: Block, patch: Partial<BlockState>) => {
    setBlocks((prev) => ({ ...prev, [block]: { ...prev[block], ...patch } }));
  };

  const run = async () => {
    if (!id || current.text.trim().length < 40) {
      setError('Вставьте ответы собственника (минимум 40 символов) или расшифровку аудио-сессии.');
      return;
    }
    setLoading(true); setError('');
    const t0 = Date.now();
    try {
      // Shape mismatch class — см. журнал CLAUDE.md 2026-04-19 (Stage 4) и 2026-04-20
      // (этот же баг в Stage 2). Backend для legend/values/mission возвращает
      // envelope `{row, ai: AIInvokeResult}`, для challenge — голый AIInvokeResult.
      // Раньше фронт типизировал всё как одиночный AIResult → `res.data.status`
      // был undefined → условная проверка `!== 'ok'` давала true → рендерился
      // жёлтый баннер «Сработал запасной план» + FallbackText «Пусто.», хотя
      // на самом деле Claude ответил полноценно (см. DB prompt_runs.output_json).
      // Артём 2026-04-20: «нажал сгенерировать ценности — пусто! Ой, боже мой!».
      const res = await http.post<Stage2Envelope>(ENDPOINT[active], {
        projectId: id,
        text: current.text,
      });
      const ai = normalizeAI(res.data);
      if (!ai.ok) {
        setError(translateRejectReason(ai.rejectReason ?? 'unknown'));
        return;
      }
      // Конвертируем реальный AIInvokeResult в frontend-сокращённый AIResult для
      // downstream-компонентов (CanvasCard, FeedbackForm, Stage2DraftView). status
      // маркируем 'degraded' для degraded-вызовов — чтобы жёлтый баннер срабатывал
      // ТОЛЬКО когда реально сработал fallback (а не на любом успешном ответе).
      const asResult: AIResult = {
        promptRunId: ai.runId,
        status: ai.degraded ? 'degraded' : 'ok',
        json: ai.json ?? undefined,
        text: ai.text ?? undefined,
        costUsd: ai.costUsd,
        degraded: ai.degraded,
      };
      updateBlock(active, {
        result: asResult,
        elapsed: (Date.now() - t0) / 1000,
        accepted: false, // новый черновик = снова не принят
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(' · ')
          : typeof msg === 'string' && msg
          ? msg
          : 'Claude не справился — попробуйте чуть позже',
      );
    } finally {
      setLoading(false);
    }
  };

  // accept: отмечает текущий блок как утверждённый И автоматически перелистывает на
  // следующий неутверждённый. Раньше после accept появлялся «NextStepCard: Перейти к
  // "Легенда"» — промежуточный экран, требующий ещё один клик. Артём (2026-04-19):
  // «зачем лишний экран утверждено следующий шаг легенда? Почему нельзя сразу перейти?».
  // Теперь: один клик «Принять черновик» → накат галочки на вкладку + скачок вперёд.
  // Если все 4 блока утверждены — остаёмся на текущем (sticky-бар внизу активируется).
  //
  // Accept теперь персистит на бэкенде: раньше `accepted` жил только в useState и
  // терялся при любой навигации. Артём (2026-04-20): «нажал принять, ничего не
  // произошло». Теперь: POST /stage-2/accept-block → row.status=completed +
  // row.finalized=draft, возврат на страницу отрабатывает getState() и видит чекмарк.
  // Плюс: acceptToast — явная подтверждалка «Блок X → переходим к Y» на 2.5 сек.
  const accept = async () => {
    // Challenge — live thinking partner без персистенции; accept на нём не имеет
    // методологического смысла (собственник ещё не дал финальный ответ).
    // Но UI-путь всё равно совместим: прокрутим на legend без бэкенд-вызова.
    if (!id) return;
    const nextIdx = BLOCKS.indexOf(active);
    let nextBlock: Block | null = null;
    for (let step = 1; step <= BLOCKS.length; step++) {
      const cand = BLOCKS[(nextIdx + step) % BLOCKS.length];
      if (cand === active) continue;
      if (!blocks[cand].accepted) { nextBlock = cand; break; }
    }

    if (active !== 'challenge') {
      try {
        await http.post('/wizard/stage-2/accept-block', { projectId: id, block: active });
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            'Не удалось сохранить утверждение. Повторите через пару секунд.',
        );
        return;
      }
    }

    updateBlock(active, { accepted: true });
    setAcceptToast({ from: active, to: nextBlock });
    // Тост держится 2.5 сек — достаточно прочесть формулировку и начать работать
    // на новой вкладке. Если маркетолог сам переключил таб раньше — тост всё равно
    // уйдёт по таймеру, это ок.
    setTimeout(() => setAcceptToast(null), 2500);
    if (nextBlock) {
      setActive(nextBlock);
      // rAF: дать React перерисовать панель, потом прокрутить вверх.
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // Откат утверждения: маркетолог вернулся на уже принятую вкладку (галочка зелёная),
  // хочет внести правку — FeedbackForm в accepted=true режиме показывает кнопку
  // «Вернуть на правки». Клик вызывает reopen, accepted снова false, три поля снова
  // доступны. Бэкенд тоже откатывает row.status='planned', finalized=null —
  // чтобы при следующем заходе маркетолог видел консистентный стейт.
  const reopen = async () => {
    if (!id) return;
    updateBlock(active, { accepted: false });
    if (active === 'challenge') return;
    try {
      await http.post('/wizard/stage-2/reopen-block', { projectId: id, block: active });
    } catch {
      /* тихий фэйл: UI уже перерисован в правку-режим, БД догонит на следующем accept */
    }
  };

  const submitFeedback = async (payload: { rejected: string; reason: string; reformulate: string }) => {
    if (!id) return;
    await http.post('/wizard/feedback', {
      projectId: id,
      artifact: LABELS[active].feedbackArtifact,
      verdict: 'revise',
      rejectedText: payload.rejected,
      reasonText: payload.reason,
      reformulationHint: payload.reformulate,
    });
  };

  const submitForApproval = async () => {
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await http.post(`/projects/${id}/approvals/request`, { projectId: id, stage: 2 });
      // Фиксируем факт отправки в локальном состоянии — sticky-бар сменится на
      // зелёный баннер «отправлено, ждём собственника», чтобы маркетолог видел
      // результат действия. Backend audit_event даёт восстанавливаемую историю.
      setSubmittedAt(new Date());
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Не удалось отправить на одобрение');
    } finally {
      setSubmitting(false);
    }
  };

  // Счётчик / gate на отправку считаем по PERSISTENT_BLOCKS (3 артефакта),
  // не по всем 4 — см. комментарий у PERSISTENT_BLOCKS выше.
  const acceptedCount = useMemo(
    () => PERSISTENT_BLOCKS.filter((b) => blocks[b].accepted).length,
    [blocks],
  );
  const allAccepted = acceptedCount === PERSISTENT_BLOCKS.length;

  // Контекстные подсказки — меняются при переключении вкладки.
  // Общая подсказка «собственник — не маркетолог» уехала в OnboardingBanner (верх страницы),
  // чтобы в SufflerPanel остались только actionable риски текущего блока.
  const hints = HINTS_BY_BLOCK[active];

  // Заполнение textarea примером. Если уже что-то введено — спросим подтверждение,
  // чтобы маркетолог случайно не стёр ответы собственника на полстраницы.
  const fillExample = () => {
    const hasContent = current.text.trim().length > 0;
    if (hasContent) {
      const ok = window.confirm('Перезаписать содержимое поля примером?');
      if (!ok) return;
    }
    updateBlock(active, { text: LABELS[active].exampleTemplate, accepted: false });
  };

  // Архивный режим для finalized/archived проектов — ДО owner_viewer branch
  // (собственнику завершённого проекта тоже нужен архивный вид стадии).
  if (isFinalized && id) {
    return (
      <WizardShell
        stage={2}
        title="Сессия с собственником — архив"
        subtitle="Подписанные легенда, ценности, миссия и видение бренда."
      >
        <FinalizedStageView projectId={id} stage={2} />
      </WizardShell>
    );
  }

  // owner_viewer приходит сюда только из навигации; backend writer-endpoints для него
  // возвращают 403. Показываем read-only экран со ссылкой на «Утверждения», где он
  // реально работает — подписывает итоги, сформированные маркетологом.
  if (isOwnerViewer) {
    return (
      <WizardShell
        stage={2}
        title="Сессия с собственником"
        subtitle="Эту стадию ведёт маркетолог: задаёт вопросы, фиксирует ответы, запускает Claude-черновики легенды/ценностей/миссии. Вам они придут на утверждение."
      >
        <ReadOnlyBanner>
          Стадия 2 — маркетолог работает с вашими ответами и Claude. Когда черновики
          (легенда, 5 ценностей, 3 варианта миссии) будут готовы, вы увидите их на
          странице{' '}
          <Link to={`/projects/${id}/approvals`} className="underline font-medium">
            Утверждения
          </Link>{' '}
          и дадите подпись.
        </ReadOnlyBanner>
        <Card className="mt-6">
          <Card.Body>
            <EmptyState
              icon={FileText}
              title="Черновики пока не готовы"
              description="Маркетолог ещё ведёт сессию. Как только легенда, ценности и миссия пройдут валидатор, вы получите уведомление — и решение будет за вами."
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
      stage={2}
      title="Сессия с собственником"
      subtitle="Легенда, ценности, миссия, видение. Claude играет роль напарника: задаёт уточняющие вопросы, чтобы собственник не отделался общими фразами, а вы фиксируете ответы."
    >
      <OnboardingBanner
        storageKey="bp.onboarding.stage-2"
        title="Черновик ≠ финал"
        body="Всё, что сгенерирует Claude на этой стадии — отправная точка. Финал формулирует собственник и утверждает своей подписью. Валидатор проверяет черновик на 3 слоя: запрещённые слова → смысл → соответствие канону Чиркова. Только после зелёного можно отправлять собственнику."
      />

      {/* Табы блоков — карта прогресса Stage 2 */}
      <div className="mt-6">
        <Tabs value={active} onValueChange={(v) => { setActive(v as Block); setError(''); }}>
          <Tabs.List>
            {BLOCKS.map((b) => (
              <Tabs.Tab key={b} value={b}>
                <span className="inline-flex items-center gap-2">
                  {blocks[b].accepted && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" aria-hidden />
                  )}
                  {LABELS[b].short}
                </span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </div>

      {/* Canvas 40/60: notes слева, AI-результат справа */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_320px] gap-6 mt-6 pb-24">
        {/* Notes — input 40% */}
        <div>
          <Card>
            <Card.Header>
              {/* min-w-0 flex-1 на текстовом контейнере — КЛЮЧ от overflow.
                  flex-child по умолчанию имеет min-width: auto (= естественная
                  ширина содержимого), он не даёт тексту переноситься. min-w-0
                  снимает этот барьер, flex-1 занимает оставшееся место после
                  иконки. Плюс Card.Title дефолтно whitespace-nowrap (ellipsis)
                  — переопределяем на whitespace-normal, чтобы длинный заголовок
                  «Ценности (3-5 штук, каждая — конкретное поведение)» переносился
                  внутри карточки, а не вылезал. Артём 2026-04-20: «текст вылезает
                  из карточки, ты чего?» */}
              <div className="flex items-start gap-2 min-w-0 w-full">
                <MessagesSquare
                  className="w-4 h-4 text-[#4F46E5] mt-0.5 flex-shrink-0"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {/* !-prefix обязателен: CardTitle по-дефолту имеет
                      whitespace-nowrap + overflow-hidden + text-ellipsis
                      для коротких заголовков. Для длинного текста Стадии 2
                      эти три utility сталкиваются с нашими whitespace-normal
                      / overflow-visible — без важности порядок в JIT-CSS
                      недетерминирован, на практике всё равно обрезало. */}
                  <Card.Title className="!whitespace-normal !overflow-visible">
                    {LABELS[active].title}
                  </Card.Title>
                  <Card.Description>{LABELS[active].hint}</Card.Description>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              <Textarea
                value={current.text}
                onChange={(e) => updateBlock(active, { text: e.target.value, accepted: false })}
                rows={12}
                placeholder={LABELS[active].placeholder}
                className="font-mono"
              />
              <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-mono text-[#78716C] tabular-nums">
                    {current.text.length.toLocaleString('ru-RU')} символов
                  </span>
                  {/* «Показать пример» — заливает в textarea готовый кейс из ниши одежды.
                      Маркетолог видит формат / уровень детализации / тон. Дальше стирает и
                      пишет своё. Снимает «страх белого листа» — главный враг в Стадии 2. */}
                  <button
                    type="button"
                    onClick={fillExample}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4F46E5]
                      hover:text-[#3730A3] transition-colors rounded-md px-2 py-1 -my-1 -mx-1
                      hover:bg-[#EEF2FF]"
                  >
                    <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                    Показать пример
                  </button>
                </div>
                <Button
                  variant="primary"
                  size="md"
                  iconLeft={Sparkles}
                  loading={loading}
                  onClick={run}
                  disabled={current.text.trim().length < 40}
                >
                  {loading ? 'Claude думает…' : LABELS[active].cta}
                </Button>
              </div>
            </Card.Body>
          </Card>

          {error && (
            <div
              role="alert"
              className="mt-4 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#B91C1C] flex gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* AI Canvas — right 60% */}
        <div className="space-y-5">
          {current.result ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <TimeSavedChip generationSeconds={current.elapsed} manualMinutesEquivalent={90} />
                {current.result.status !== 'ok' && (
                  <Badge variant="soft" color="warning">
                    Сработал запасной план{current.result.reason ? ` — ${current.result.reason}` : ''}
                  </Badge>
                )}
              </div>

              <CanvasCard
                accepted={current.accepted}
                title={`Черновик — ${LABELS[active].short}`}
              >
                {/* Структурный рендер вместо сырого JSON.dump — см. Stage2DraftView.
                    Приоритет `json` → `text` потому что json уже распарсен сервером,
                    text используется только как fallback при ошибке парсинга. */}
                <Stage2DraftView
                  block={active}
                  data={current.result.json ?? current.result.text}
                />
              </CanvasCard>

              {/* Единая action-карточка: FeedbackForm теперь содержит BOTH «Пере-генерировать
                  черновик» (требует 3 поля) И «Принять черновик» (без полей). Раньше был
                  зоопарк: FeedbackForm → separate Accept/Regen card → NextStepCard после
                  accept. Артём (2026-04-19): «перегенерировать уже как бы лишняя кнопка,
                  и тогда кнопку принять можно поставить в карточку про что поправить
                  черновике — и будет чище дизайн». Плюс после accept auto-advance сразу,
                  без промежуточного «Утверждено → Следующий шаг: N» экрана. */}
              <FeedbackForm
                draftId={current.result.promptRunId}
                rowId={current.result.promptRunId}
                onSubmit={submitFeedback}
                onAccept={accept}
                accepted={current.accepted}
                onReopen={reopen}
              />
            </>
          ) : (
            <EmptyCanvasPlaceholder expectation={LABELS[active].canvasExpectation} />
          )}

          {/* Inline CTA-карточка «все 3 артефакта готовы → отправляйте собственнику».
              ВАЖНО: рендерится ВНЕ condition `current.result ? ... : ...`, потому что
              полный-стейдж-completion — свойство стадии, а не текущей вкладки. Если
              маркетолог принял legend/values/mission а сейчас открыл challenge-таб
              (у которого result отсутствует), карточка всё равно видна — «что дальше»
              не зависит от того, на какой tab сейчас клик. До этой карточки единственным
              сигналом о завершении стадии был sticky bar внизу экрана + transient
              AcceptToast на 2.5 сек. Артём 2026-04-20 (скриншот КДМ, 4/4 блока
              утверждены): «И что дальше? Ни хрена же не понятно. Надо сделать, чтобы
              было понятно.» Класс тот же что запись 2026-04-19 «Dead-end after
              approval» — раньше был per-block (решил NextStepCard после accept одного
              блока), теперь расширяется на per-stage: после accept всех артефактов —
              отдельный визуальный якорь прямо под canvas'ом, где глаза маркетолога
              уже смотрят. Sticky-бар остаётся внизу как дубль для контекста, но
              основной триггер — эта карточка inline. */}
          {allAccepted && !submittedAt && (
            <StageCompleteCard
              submitting={submitting}
              onSubmit={submitForApproval}
              error={error}
            />
          )}
        </div>

        {/* Suffler справа */}
        <aside className="hidden xl:block">
          <SufflerPanel hints={hints} />
        </aside>
      </div>

      {/* Тост «Блок X утверждён → переходим к Y» — показывается на 2.5 сек после accept.
          Без явной подтверждалки accept считывался как ничего-не-произошло: badge на
          CanvasCard менялся тихо, tab подсвечивался мелкой галочкой — маркетолог шёл
          прочь от экрана. Тост — видимое событие посередине экрана. */}
      {acceptToast && (
        <AcceptToast
          from={LABELS[acceptToast.from].short}
          to={acceptToast.to ? LABELS[acceptToast.to].short : null}
          allAccepted={allAccepted}
        />
      )}

      {/* Sticky CTA: «Отправить собственнику» — заменяется на зелёный баннер
          «Отправлено, ждём подписи собственника», когда маркетолог нажал кнопку.
          Без этого действие уходило молча (audit-лог пишется, но UI никак не
          реагировал) — отсюда была претензия Артёма «Я всё сделал, и что дальше?». */}
      {submittedAt ? (
        <StickySubmittedBar submittedAt={submittedAt} projectId={id ?? ''} stage={2} />
      ) : (
        <StickySubmitBar
          blocks={PERSISTENT_BLOCKS.map((b) => ({
            label: LABELS[b].short,
            accepted: blocks[b].accepted,
          }))}
          allAccepted={allAccepted}
          submitting={submitting}
          onSubmit={submitForApproval}
        />
      )}
    </WizardShell>
  );
}

// ———————————————————————————————————————————————————————————————
// CanvasCard — AI-черновик с оранжевой полоской слева (Canvas pattern)
// ———————————————————————————————————————————————————————————————

function CanvasCard({
  accepted,
  title,
  children,
}: {
  accepted: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'relative bg-white rounded-[20px] border overflow-hidden',
        accepted
          ? 'border-[#86EFAC]'
          : 'border-[#E7E5E4] shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]',
      ].join(' ')}
    >
      {/* Левый indigo-stripe пока черновик не принят */}
      {!accepted && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#4F46E5]" aria-hidden />
      )}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="uppercase-mono text-[#78716C]">{title}</p>
        {accepted ? (
          <Badge variant="soft" color="success" icon={CheckCircle2}>
            Утверждено маркетологом
          </Badge>
        ) : (
          <Badge variant="soft" color="primary" icon={Sparkles}>
            AI-черновик
          </Badge>
        )}
      </div>
      <div className="px-6 pb-5">{children}</div>
    </div>
  );
}

// EmptyCanvasPlaceholder рассказывает заранее, ЧТО появится после нажатия «Сгенерировать».
// Маркетолог не ждёт вслепую — он видит формат ожидаемого ответа, снижает энергию входа.
function EmptyCanvasPlaceholder({ expectation }: { expectation: string }) {
  return (
    <div className="h-full min-h-[280px] border-2 border-dashed border-[#E7E5E4]
      rounded-[20px] flex flex-col items-center justify-center text-center p-8 bg-[#FAFAF9]">
      <div className="w-12 h-12 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-3">
        <Sparkles className="w-5 h-5 text-[#4F46E5]" aria-hidden />
      </div>
      <p className="text-sm font-medium text-[#44403C]">Что Claude вернёт в канвас</p>
      <p className="text-xs text-[#78716C] mt-2 max-w-md leading-relaxed">
        {expectation}
      </p>
      <p className="text-[11px] font-mono uppercase tracking-[0.08em] text-[#A8A29E] mt-4">
        заполните поле слева → нажмите «Сгенерировать»
      </p>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// StickySubmitBar — «Отправить на одобрение собственника»
// ———————————————————————————————————————————————————————————————

function StickySubmitBar({
  blocks,
  allAccepted,
  submitting,
  onSubmit,
}: {
  blocks: { label: string; accepted: boolean }[];
  allAccepted: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const acceptedCount = blocks.filter((b) => b.accepted).length;
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md
        border-t border-[#E7E5E4] py-3 px-6"
      style={{ paddingLeft: 'calc(var(--sidebar-w, 240px) + 24px)' }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Per-block chips with named labels (handoff pattern) */}
        <div className="flex items-center gap-4 flex-wrap">
          {blocks.map((b) => (
            <span
              key={b.label}
              className={[
                'inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap',
                b.accepted ? 'text-[#15803D]' : 'text-[#78716C]',
              ].join(' ')}
            >
              <span
                className={[
                  'w-2 h-2 rounded-full flex-shrink-0',
                  b.accepted ? 'bg-[#22C55E]' : 'bg-[#D6D3D1]',
                ].join(' ')}
                aria-hidden
              />
              {b.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[13px] font-mono tabular-nums text-[#78716C]">
            {acceptedCount}/{blocks.length}
          </span>
          <Button
            variant="primary"
            size="md"
            iconRight={Send}
            onClick={onSubmit}
            loading={submitting}
            disabled={!allAccepted}
          >
            На одобрение собственника
          </Button>
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// StickySubmittedBar — зелёная плашка «отправлено, ждём подписи».
// Отображается после успешного POST /projects/:id/approvals/request.
// Не блокирует навигацию: маркетолог может уйти на /approvals и смотреть статус.
// ———————————————————————————————————————————————————————————————

function StickySubmittedBar({
  submittedAt,
  projectId,
  stage,
}: {
  submittedAt: Date;
  projectId: string;
  stage: 1 | 2 | 3 | 4;
}) {
  const timeStr = submittedAt.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#F0FDF4] backdrop-blur-md
        border-t border-[#86EFAC] py-3 px-6"
      style={{ paddingLeft: 'calc(var(--sidebar-w, 240px) + 24px)' }}
      role="status"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="w-5 h-5 text-[#15803D] flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#14532D]">
              Стадия {stage} отправлена собственнику на подпись
            </p>
            <p className="text-xs text-[#166534]">
              {timeStr} · собственник увидит черновики на странице «Утверждения» и поставит подпись.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`/projects/${projectId}/approvals`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D]
              text-white text-sm font-medium hover:bg-[#166534] transition-colors"
          >
            Открыть «Утверждения»
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// AcceptToast — всплывающее сообщение «Блок X утверждён → переходим к Y».
// Центр экрана, белая плашка с зелёной каёмкой, исчезает через 2.5 сек.
// Задача: превратить silent tab-switch после accept в видимое событие.
// Без тоста Артём (2026-04-20) читал accept как «ничего не произошло».
// ———————————————————————————————————————————————————————————————

function AcceptToast({
  from,
  to,
  allAccepted,
}: {
  from: string;
  to: string | null;
  allAccepted: boolean;
}) {
  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-[#86EFAC]
          bg-white shadow-lg"
      >
        <CheckCircle2 className="w-5 h-5 text-[#15803D] flex-shrink-0" aria-hidden />
        <div className="text-sm">
          <span className="font-semibold text-[#14532D]">
            «{from}» утверждено маркетологом
          </span>
          {to && !allAccepted ? (
            <span className="text-[#166534]"> → переходим к «{to}»</span>
          ) : allAccepted ? (
            <span className="text-[#166534]">
              {' '}
              — все 4 блока готовы. Отправьте на одобрение собственника ↓
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ———————————————————————————————————————————————————————————————
// StageCompleteCard — inline CTA-карточка «все 4 блока утверждены →
// отправляйте собственнику на одобрение». Отображается в canvas-колонке
// прямо под FeedbackForm'ом (= там, где глаза маркетолога после accept
// последнего блока). Зелёный success-colorway (совпадает с рамкой accepted
// CanvasCard) + иконка-кружок + заголовок + пояснение + primary-CTA с
// иконкой Send. Класс Dead-end-after-approval: запись 2026-04-19 решила
// его per-block, эта карточка — его per-stage эквивалент.
// Артём 2026-04-20 (скриншот КДМ): «И что дальше? Ни хрена же не понятно.»
// ———————————————————————————————————————————————————————————————

function StageCompleteCard({
  submitting,
  onSubmit,
  error,
}: {
  submitting: boolean;
  onSubmit: () => void;
  error: string;
}) {
  return (
    <div className="rounded-[20px] border-2 border-[#86EFAC] bg-[#F0FDF4] p-6">
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-full bg-[#22C55E] flex items-center
            justify-center flex-shrink-0"
          aria-hidden
        >
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[#14532D]">
            Все четыре блока утверждены — черновик стадии готов
          </h3>
          <p className="text-sm text-[#166534] mt-1.5 leading-relaxed">
            Следующий шаг — отправить легенду, ценности, миссию и уточнения
            собственнику на одобрение. Он получит уведомление, прочитает все
            четыре блока и либо подпишет их, либо вернёт на правки с
            комментариями. До подписи собственника стадия 3 остаётся
            заблокированной.
          </p>
          {error && (
            <div
              role="alert"
              className="mt-3 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg
                text-sm text-[#B91C1C] flex gap-2"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
              <p>{error}</p>
            </div>
          )}
          <div className="mt-4">
            <Button
              variant="primary"
              size="md"
              iconLeft={Send}
              loading={submitting}
              onClick={onSubmit}
            >
              {submitting ? 'Отправляем…' : 'На одобрение собственника'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
