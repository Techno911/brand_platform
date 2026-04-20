# HYPERPROMPT для Claude Design — Brand Platform (BP)

> **Как использовать:** открой `claude.ai/design`, создай новый проект,
> вставь весь этот файл как первое сообщение. К нему прикрепи:
> (1) скриншоты всех 16 экранов текущей реализации — из браузера localhost;
> (2) 6 файлов логотипа из `/frontend/public/brand/` (logo-full-dark.png,
> logo-emblem-light.png, logo-emblem-dark.png, logo-icon-dark.png,
> logo-icon-outline.png, favicon.svg);
> (3) референсные скриншоты (список внизу, раздел 11).
>
> Ожидаемый выход: **design system + макеты всех 16 экранов + handoff bundle
> для Claude Code**.

---

## 0. TL;DR — что мы от тебя хотим

Мы запускаем B2B-SaaS **Brand Platform** — линейный wizard из 4 стадий
методологии бренд-разработки. Продукт в стадии MVP; код и архитектура готовы;
**визуальный дизайн — нет**. Текущая реализация выглядит как «vibe-coded
админка», не как премиальный SaaS. Пользователь — агентство с 10–30
клиентами и чеком $2–5k за проект; у них есть ожидания полированного
интерфейса уровня Linear / Stripe / Attio.

**Тебе нужно:**

1. Прочитать эту спецификацию целиком (≈12k слов, подробная, намеренно).
2. Построить design system под наш существующий token-слой (не переизобретай
   палитру — мы её выстрадали, подробности в §6).
3. Спроектировать **все 16 экранов** (список в §8) так, чтобы они
   выглядели как единый premium-продукт, а не собранный из готовых
   компонентов prototype.
4. Соблюсти **все инварианты** (§7) — это не предпочтения, это hard-constraint'ы
   кодовой базы.
5. Выдать **handoff bundle** для Claude Code: design tokens (JSON), компоненты
   (Button, Card, Input, Badge, Tabs, Modal, Stepper, ProgressBar, EmptyState,
   Tooltip, Dropdown, DiffBlock, SuggestionMark, Breadcrumbs + composite
   shell-элементы Sidebar, Header, QueueBanner, WizardShell, CanvasCard,
   SufflerPanel), экранные макеты в HTML+Tailwind (или Figma → Code
   handoff — не принципиально, главное чтобы был однозначно применимый
   набор).

Не пиши код для backend или бизнес-логики — только frontend / presentation.

---

## 1. Кто мы и почему это важно

### 1.1 Заказчик и продукт

**Агентство «Чирков и Партнёры»** (ЧиП) — бутиковое бренд-агентство в
России. Методология 3.1 — их авторский фреймворк, 8–12 рабочих дней
от первого интервью с клиентами собственника до финального бренд-документа
на русском. Обслуживают offline B2C: стоматологии, мебельные салоны,
рестораны, салоны красоты, детские центры, автосервисы.

**Brand Platform (BP)** — внутренний SaaS, который превращает методологию
в масштабируемый процесс. Агентство берёт 10–30 клиентов в год. Каждый
клиент — проект в BP. Внутри проекта — 4 линейных стадии wizard'а; на
каждой стадии маркетолог клиента + проджект ЧиП взаимодействуют с LLM
(Claude как primary, OpenAI как fallback), но **каждый публикуемый
артефакт утверждает собственник бизнеса вручную** — это ядро методологии.

### 1.2 Бизнес-инварианты, которые формируют UX

**(a) Linear wizard, не агент.** Порядок 4 стадий зашит в код. Пользователь
не может «прыгнуть» с 1 на 3; не может запустить параллельно. Каждая
стадия имеет Definition-of-Done, пока не пройдено — следующая заблокирована.
**UX должен передавать ощущение прогрессии, а не гибкости**: прошли шаг,
закрыли, открыли следующий.

**(b) Claude — черновик, человек — подпись.** Каждый экран, где есть
AI-вывод, должен визуально различать: «это AI-драфт, рассмотри» vs
«это утверждено, неизменяемо». Градация должна быть **моментально
считываемая** — не надо читать подпись под текстом чтобы понять статус.
Пример: Google Docs suggestion-mode vs финальный текст.

**(c) Judgment-heavy задачи не делегируем AI.** Архетип бренда (мудрец /
бунтарь / заботливый…) выбирает человек — не LLM. UI **не должен создавать
иллюзию «AI решил архетип»**. Наоборот: AI приносит варианты, человек
выбирает. Это должно ощущаться как инструмент, а не как оракул.

**(d) Reseller-модель LLM.** API-ключи вендоров на сервере агентства.
Клиенты вендоров не видят, ключей не заводят, о промпт-воронке не знают.
Слова «Claude», «Anthropic», «GPT-4», «OpenAI» в UI **не появляются**.
Единственное исключение — админская страница `/admin/silent-failures`,
где chip_admin смотрит prompt-run-логи.

**(e) Роли жёстко зафиксированы (3, не больше).** `chip_admin` (один
человек — Чиркова лично, global), `marketer` (исполнитель — штатный
маркетолог клиента или подрядчик ЧиП, per-project), `owner_viewer`
(собственник бизнеса — утверждает, per-project). Разные роли видят
разные экраны. Owner_viewer почти ничего не видит кроме «Мои бренды» →
«Утверждения» — его UX должен быть **максимально простым**, он заходит
3–4 раза за проект.

### 1.3 Аудитория

Четыре персонажа (Оля и Игорь — оба marketer-role, но разные контексты):

- **Чиркова** (chip_admin, 45 лет) — владелица агентства. Открывает BP
  1–2 раза в день. Смотрит админку (silent failures, биллинг,
  качество маркетологов, биллинг). Ожидает density уровня Bloomberg
  Terminal, но чтобы это не резало глаза.
- **Оля** (marketer-подрядчик ЧиП, 32 года) — ведёт 3–5 проектов
  параллельно. Открывает BP по 5–10 раз в день. Dashboard →
  конкретный проект → Stage 2 → вернуться. Её UX — **главный**.
  Плотно, читаемо, быстро.
- **Игорь** (marketer в штате клиента, 28 лет) — делает черновую
  работу по одному-двум брендам. Открывает BP 2–3 раза в день на пике
  стадии. Wizard-экраны — его основной контекст. Ему нужна ясность:
  «что делать сейчас».
- **Александр** (owner_viewer, 48 лет, собственник стоматологии) —
  заходит 3–4 раза за 10 дней. Открывает письмо «проверьте и утвердите» →
  читает документ → одобряет/просит правки. **Минимум когнитивной
  нагрузки**. Ощущение Google Docs Review, не CMS.

---

## 2. Что такое текущий продукт (функциональный обзор)

### 2.1 Поток работы одного проекта

```
[Chip manager создаёт проект]
            ↓
[Marketer загружает транскрипты 3+ интервью]
            ↓
[Стадия 1: Портрет клиента] — Claude вытаскивает паттерны голоса клиента
            ↓
[Стадия 2: Сессия с собственником] — 4 блока: Challenge, Легенда,
  Ценности, Миссия. Claude — thinking partner, задаёт провокационные
  вопросы. Marketer переносит ответы собственника в систему.
            ↓
[Owner утверждает артефакты стадии 2 на /approvals]
            ↓
[Стадия 3: Архетип и позиционирование] — JSON-спец → позиционирование →
  варианты месседжа → 3 критика, 3 итерации → borderline-ревью.
            ↓
[Owner утверждает артефакты стадии 3]
            ↓
[Стадия 4: Четыре теста месседжа] — месседж прогоняется через 4 теста
  (эмоциональная правда, бренд-консистентность, операционная применимость,
  резонанс с ЦА). Все 4 = green → утверждение собственника.
            ↓
[Финальный DOCX-документ в S3 ObjectLock, 7 лет retention]
```

Стадии идут строго последовательно. Параллельные AI-вызовы в одном
проекте запрещены (pg_advisory_lock на backend).

### 2.2 Роли и видимость страниц

| Страница                | chip_admin | marketer | owner_viewer |
|-------------------------|:----------:|:--------:|:------------:|
| `/login`                | ✓          | ✓        | ✓            |
| `/dashboard`            | ✓          | ✓ (свои)| ✓ (свои)    |
| `/projects`             | ✓ (все)   | ✓ (свои)| ✓ (свои, как «Мои бренды») |
| `/projects/:id`         | ✓          | ✓        | ✓ (read-only)|
| `/projects/:id/stage-1..4` | ✓       | ✓        | ✗            |
| `/projects/:id/approvals`  | ✓       | ✓ (view) | ✓ (act)     |
| `/admin/*` (7 страниц) | ✓          | ✗        | ✗            |

Нав-элементы скрыты по роли. Chip_admin видит максимум; owner_viewer —
только «Главная» + «Мои бренды».

---

## 3. Брендбук

### 3.1 Название и voice

- **Имя продукта:** «Бренд-платформа» (по-русски; как service brand
  бутикового агентства, не как SaaS-компания)
- **Компания:** «Чирков & Партнёры» (ЧиП). Пишется именно так: через `&`.
- **Методология:** «Методология 3.1» — собственная разработка.
- **Слоган:** «Линейно. По делу. Методология 3.1.»
- **Tone-of-voice:** прямой, без слэнга, без emoji, без восклицаний.
  Строгий, профессиональный, но не сухой. Разговор равных. Примеры
  из текущих taglines: «Слушаем клиента.» / «Вытаскиваем мотив.» /
  «Формулируем без клише.» — короткие предложения, императив, точка.
- **Описание:** «Методология 3.1 для offline B2C. От первого интервью
  до финального документа — 8–12 рабочих дней.»
- **Copyright:** «© 2026 Чирков и Партнёры · Бренд-платформа»

### 3.2 Физические ассеты логотипа

В папке `/frontend/public/brand/` (приложи их к чату в Claude Design):

| Файл                     | Назначение                                    |
|--------------------------|-----------------------------------------------|
| `logo-full-dark.png`     | Полный горизонтальный логотип (символ + текст), тёмный вариант. Используется в sidebar (expanded, 240px) и на login-hero. На тёмном фоне применяется CSS-фильтр `invert(1) brightness(1.15)`. |
| `logo-emblem-light.png`  | Только эмблема (без текста), светлая версия. Используется в sidebar в свёрнутом состоянии (64px). |
| `logo-emblem-dark.png`   | Только эмблема, тёмная версия — на светлых фонах (reserved). |
| `logo-icon-dark.png`     | Компактная иконка для favicons/social. |
| `logo-icon-outline.png`  | Outline-вариант иконки — для situations где нужен lineart. |
| `favicon.svg` / `favicon.png` | Favicon браузера. |

**Запрещено:** генерировать новый SVG/emoji/CSS-логотип. Только `<img>`
с этими PNG-файлами. Они из официального брендбука агентства, менять
нельзя.

Эмблема — стилизованная «Ч» с партнёрским жестом (есть в файлах,
посмотри). Передаёт: «Чирков **и** Партнёры», not Чирков один.

### 3.3 Идентичность в цвете и типографике

Это уже зафиксировано в `src/styles/index.css`, НЕ переизобретай:

**Primary:** **Indigo** (Linear/Stripe/Vercel стандарт, осознанный выбор).
`#4F46E5` (primary-500). Шкала 50→900: `#EEF2FF → #1E1B4B`.

**Neutral:** Warm Gray (Stone), не холодный Slate. `#FAFAF9 → #1A1A1A`.
Этот тёплый оттенок — важная идентификация: premium SaaS часто выбирают
warm neutrals (Linear, Attio), сходство с бумажной эстетикой бренд-работы.

**Sidebar background:** `#1A1A1A` (почти-чёрный, warm). Не серый, не
навигация-синий. Это inherited из предыдущих платформ ЧиП и hard-constraint
(см. §7).

**Semantic:** green `#22C55E` (success), yellow `#EAB308` (warning),
red `#EF4444` (danger), blue `#3B82F6` (info — **ТОЛЬКО для admin
observability**, не для общего UI).

**Запрещено как акцент:** фиолетовый `#7C3AED` и синий `#3B82F6`
(синий — только в info-уровне admin-страниц, нигде больше). Оранжевый
`#F97316` исторически был primary — мы его заменили на Indigo,
старые упоминания не возвращать.

**Шрифты:**

- **Inter** (Rasmus Andersson, ex-Figma) — body, UI. Weights: 400, 500,
  600, 700, 800. Loaded через Google Fonts.
- **IBM Plex Mono** — display, numbers, ID-chips, uppercase micro-labels.
  Weights: 300–700. Loaded локально из `/fonts/*.ttf`.

**Запрещено:** Roboto, Arial, Poppins, Montserrat, Söhne (последний —
премиальный, но платный; мы на open-source).

### 3.4 Иконки

**Только `lucide-react`.** Единообразный stroke-weight, в текущей
реализации чаще всего `w-4 h-4` и `w-5 h-5`. Никаких emoji в UI
(ни в заголовках, ни в тостах). Никаких других icon-пакетов (FontAwesome,
Heroicons, Phosphor, Material).

---

## 4. Что сейчас в продукте не работает визуально

### 4.1 Симптомы (observable)

Скриншоты приложены пользователем отдельно. Кратко что в них:

1. **Dashboard:** рваная структура. Metric cards выглядят как
   «floating text без контейнеров», хотя border существует. «Активные
   проекты» list маленький и потерянный. «Как устроена работа» справа
   тесно. Внизу массивный empty space. Page вертикально не плотная,
   но и не «умышленно воздушная» — между ними «просто пусто».
2. **Projects list:** один проект в углу огромного канваса. Grid
   растянут на ширину. Progress bars тонкие, теряются. Filter pills
   вверху справа рассыпаны.
3. **Login:** split 40/60 работает, форма вертикально по центру,
   но общее ощущение «страницы из 2014-го» — поля серого оттенка,
   кнопка indigo без deep-feeling, hero-текст скупой.
4. **Wizard-страницы (Stage 1–4):** 3-column layout (stepper |
   canvas | suffler) технически работает, но визуальный ритм ломается.
   Canvas-карточка не выглядит как «фокальная точка», она равна
   всему остальному.
5. **Approvals:** иерархия документа/suggestions/actions не считывается.
   Sticky action bar снизу пытается быть primary, но теряется в общей
   визуальной какофонии.
6. **Admin-страницы:** density корректная (таблицы, badges), но
   ощущение «скопированный ShadCN» — стоковые компоненты без
   продуктового почерка.

### 4.2 Корневая диагностика (что именно плохо)

Мы провели большой research pass (37 источников: Refactoring UI, Josh
Comeau, Emil Kowalski, Linear design blog, Vercel Geist, Notion UX
breakdowns, Karri Saarinen 10 rules, Avito Design, etc.) и применили:
8pt grid, typography scale, prefers-reduced-motion, explicit states
(hover/active/focus/disabled), Josh Comeau CSS reset, Indigo color
migration, motion budget. **Всё это сделано и работает корректно.**

Но: это подняло продукт с 2/10 до 4/10. Premium SaaS — 8/10. Разница
не в принципах, а в **polish-слое**: depth, subtle gradients, тактильные
микро-детали, ощущение «живого» интерфейса, правильная композиция
focal point'ов на странице, empty states которые не выглядят как
«ещё не допилили», консистентный rhythm между экранами.

Этот polish-слой нельзя получить чтением research. Нужны **конкретные
референсы + pixel-verbatim исполнение**. Отсюда и этот промт.

---

## 5. Цель редизайна (конкретная, не «сделай красиво»)

Мы хотим чтобы BP выглядел как **инструмент за $299–999/мес для
бутикового B2B-агентства** — не как «ещё один Notion-style SaaS», не
как Material-админка, не как «в нашей компании не было дизайнера».

**Конкретные якоря:**

- Линия + ЧиП-партнёрство в визуальной метафоре. Linear говорит «линейно
  значит быстро». ЧиП говорят «линейно значит по методологии». Мы
  берём Linear-плотность/typography/depth, но tone и language чуть
  строже, чуть книжнее — мы не tech-команда, мы агентство-партнёр.
- Ощущение «documentation-grade»: когда смотришь на финальный бренд-документ,
  должно быть понятно что это **подписанный артефакт**, не
  «ещё одна страница в браузере». Приглядись к подаче финальных
  артефактов на Stripe (invoice PDF view), Attio (record detail),
  Linear (issue view) — это хорошие якоря.
- **Density high, но читаемый.** Наши пользователи работают в BP
  часами (marketer-подрядчик ведёт 3-5 проектов, заглядывает 10 раз
  в день). Это не consumer-product с одним CTA на экран. Нужна
  Bloomberg-level плотность, но без Bloomberg-level чёсанки глаз.
- **Rhythm последовательный.** Все 16 экранов должны ощущаться как
  один продукт. Если на Dashboard мы используем card-с-подложкой-subtle,
  то на Approvals — такой же. Если на Wizard'ах header-pattern такой,
  то на admin-страницах идентичный.

**Успех = пользователь открывает любой экран и не думает «дёшево».
Пользователь открывает три экрана подряд и не замечает визуального
switch'а — ощущение одного продукта.**

---

## 6. Существующие design tokens — НЕ ПЕРЕИЗОБРЕТАЙ

Это наш текущий token-слой из `src/styles/index.css`. Он результат
серьёзной работы и договорённостей. Используй как есть, расширяй
только если точно не хватает.

### 6.1 Цвета (CSS custom properties)

```css
/* Primary — Indigo */
--primary-50:  #EEF2FF;  --primary-100: #E0E7FF;  --primary-200: #C7D2FE;
--primary-300: #A5B4FC;  --primary-400: #818CF8;  --primary-500: #4F46E5;  /* base */
--primary-600: #4338CA;  --primary-700: #3730A3;  --primary-800: #312E81;
--primary-900: #1E1B4B;

/* Neutral — Warm Gray (Stone) */
--neutral-0:   #FFFFFF;  --neutral-50:  #FAFAF9;  --neutral-100: #F5F5F4;
--neutral-200: #E7E5E4;  --neutral-300: #D6D3D1;  --neutral-400: #A8A29E;
--neutral-500: #78716C;  --neutral-600: #57534E;  --neutral-700: #44403C;
--neutral-800: #292524;  --neutral-900: #1A1A1A;

/* Semantic */
--success-50:  #F0FDF4;  --success-500: #22C55E;  --success-600: #16A34A;
--warning-50:  #FEFCE8;  --warning-500: #EAB308;  --warning-600: #CA8A04;
--danger-50:   #FEF2F2;  --danger-500:  #EF4444;  --danger-600:  #DC2626;
--info-50:     #EFF6FF;  --info-500:    #3B82F6;  /* admin observability only */
```

### 6.2 Радиусы

```
--radius-sm:   4px
--radius-md:   8px
--radius-lg:   12px   ← все buttons
--radius-xl:   16px
--radius-2xl:  20px   ← все cards
--radius-full: 9999px ← avatars, pills
```

### 6.3 Тени

```
--shadow-none:    none
--shadow-soft-1:  0 1px 2px 0 rgba(0,0,0,0.05)        ← subtle (default cards — не использовать, border only)
--shadow-soft-2:  0 4px 12px 0 rgba(0,0,0,0.06)        ← elevated cards (когда надо акцент)
--shadow-overlay: 0 12px 40px 0 rgba(0,0,0,0.15)       ← modals, dropdowns
--shadow-focus:   0 0 0 3px rgba(79,70,229,0.25)       ← focus ring indigo
```

Default-cards **без тени, только border**. Тень — осознанное elevated-состояние
(modal, dropdown, featured card). Это важный token-стиль: не sprinkle
shadows везде.

### 6.4 Типографика

```
--text-display:  2.25rem   (36px)  ← hero login, marketing-like
--text-h1:       1.875rem  (30px)  ← page title
--text-h2:       1.5rem    (24px)  ← section heading
--text-h3:       1.125rem  (18px)  ← card heading
--text-body-lg:  1rem      (16px)  ← читаемый body
--text-body:     0.875rem  (14px)  ← default UI
--text-caption:  0.75rem   (12px)  ← hint / meta
--text-mono-sm:  0.8125rem (13px)  ← ID/code chips

--lh-tight:   1.2
--lh-snug:    1.35
--lh-normal:  1.5    (body default)
--lh-relaxed: 1.7

--font-sans: 'Inter', system-ui, ...
--font-mono: 'IBM Plex Mono', 'JetBrains Mono', 'Consolas', ...
```

### 6.5 Motion

```
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)

--dur-instant: 100ms
--dur-fast:    150ms   ← color hover transitions
--dur-base:    200ms   ← layout/transform
--dur-slow:    300ms   ← sidebar collapse, modal enter
--dur-pensive: 500ms   ← редко, для больших layout shifts
```

`prefers-reduced-motion` honored глобально.

### 6.6 Пробелы — 4pt grid

Всё spacing кратно 4px (Tailwind default). Никаких 11px / 13px / 15px
значений — эти мгновенно читаются как «ad-hoc, не system». Ok: 4, 8,
12, 16, 20, 24, 32, 40, 48.

---

## 7. Инварианты кодовой базы (HARD-CONSTRAINTS — не нарушай)

Это НЕ «наши предпочтения». Это жёсткие правила из `/frontend/CLAUDE.md`
и инвариантов продукта, которые мы проверяем в CI.

1. **Sidebar:**
   - Фон ровно `#1A1A1A` (neutral-900). Не чёрный, не серый — именно warm.
   - Ширина 240px expanded / 64px collapsed. Inline-style (Tailwind
     JIT dynamic-classes не работают).
   - Логотип: `<img src="/brand/logo-full-dark.png">` (expanded) +
     `<img src="/brand/logo-emblem-light.png">` (collapsed). На тёмном
     фоне логотип инвертируется CSS-фильтром `invert(1) brightness(1.15)`.
   - Navigation двумя группами: `main` (всегда видна) и `admin`
     (только chip_admin). Разделитель — тонкая линия `#292524`.
   - Active nav item: `bg-[#4F46E5]` (indigo-500) + `text-white` +
     `rounded-xl`. Default: transparent.
   - Внизу — user mini-profile (инициалы в индиго-круге + ФИО + role
     label) + **logout button, single, in sidebar footer**.

2. **Header:**
   - Содержит ТОЛЬКО: (a) page title (h1, 30px semibold, tracking-tight),
     (b) notification bell icon (справа).
   - **НЕТ** dropdown с именем пользователя. **НЕТ** аватара.
     **НЕТ** breadcrumbs-trail за пределами detail-страниц.
     **НЕТ** search bar (есть на конкретных экранах, не в header).
   - На detail-страницах (проект / стадия / approvals) над title —
     **breadcrumbs** (отдельный компонент Breadcrumbs.Item + Breadcrumbs.Current).

3. **Cards:**
   - Border-radius ровно `rounded-2xl` (20px). **Не 16px, не 24px.**
   - Default: border `#E7E5E4`, no shadow. Elevated variant: border +
     `shadow-soft-2`. Interactive variant: hover border indigo-300 +
     hover shadow-soft-2 subtle.

4. **Buttons:**
   - Border-radius `rounded-lg` (12px). **НЕ rounded-2xl** (карточки и
     кнопки должны визуально отличаться: карточки мягче, кнопки
     острее).
   - 4 варианта: primary (indigo-500 filled), secondary (white +
     border), ghost (transparent + hover bg), danger (red filled).
   - Каждый вариант: default / hover / active / focus / disabled —
     все 5 состояний определены.
   - Размеры: sm (h-8, 32px), md (h-10, 40px), lg (h-12, 48px).

5. **Inputs:**
   - Border-radius `rounded-lg`. Фон `#F5F5F4` (warm gray-100).
   - Focus: border indigo-500 + ring-1 indigo-500 + фон white.
   - Error: border red-500 + ring-1 red-500.

6. **Нет dark mode.** Только light theme. Dark mode — post-MVP.

7. **Нет регистрации.** Login page — только email/password. Пользователей
   заводит chip_admin вручную. **Нет ссылки «зарегистрироваться»,
   нет «forgot password» SSR-флоу**; есть только reset через
   chip_admin out-of-band.

8. **Нет нативных `title=""` тултипов.** Есть собственный Tooltip
   component. Везде где нужен hint-on-hover — через него.

9. **Language:** RU-only UI, en-только в технических местах (stage-slug,
   debug-IDs). Нет i18n-готовности в MVP. Даты через
   `toLocaleString('ru-RU')`.

10. **Stack:** React 18 + Vite + TypeScript + Tailwind CSS v4 +
    Zustand (state) + lucide-react (icons). Handoff должен быть
    compatible: Tailwind utility classes + TSX. Не используй CSS-in-JS
    (styled-components, emotion, @stitches).

---

## 8. Экраны — полный перечень и что на каждом

Далее — 16 экранов с intent-описанием и per-screen рефs. Это не
wireframe — это **заказ дизайна**. Выдай мне для каждого: макет
(desktop 1440×900 обязательно, mobile 375 желательно), empty state,
loading state, error state где релевантно.

### 8.1 LoginPage — `/login`

**Intent:** вход в систему. Нет регистрации. Нет social login. Только
email + password + «Войти». Гостевая страница — единственная где hero
может быть более marketing-ish (лёгкий нарратив про методологию),
потому что клиенты иногда ссылаются на логин извне.

**Структура (hard-constraint, не меняй split):**

- 40% left panel: dark (`#1A1A1A`), hero content (logo + hero headline
  + 3 taglines + 3 numbered features + copyright).
- 60% right panel: white, вертикально центрированная форма
  (max-width 28rem).

**Референс для композиции:**

- **Linear `/login`** — dark-side + light-side, minimal form, strong
  type ladder. Это наш главный якорь.
- **Stripe `/login`** — как они обрабатывают error-state и spacing
  между label и input.
- **Vercel `/login`** — typography hierarchy в hero.

**Что улучшить:**

- Hero headline сейчас плоский («Линейно. По делу. Методология 3.1.»).
  Нужна 2-строчная композиция с акцентным цветом на второй строке
  (уже есть, но может жить ярче).
- Radial gradient индиго в углу — subtle, почти не виден. Можно
  развернуть в более ощутимую подложку.
- 3 numbered features — сейчас маленькие. Или дать им больше воздуха,
  или превратить в короткие убедительные bullet'ы.
- Правая форма: входные поля слишком маленькие. Должны быть `h-12` для
  premium-feel, с более заметным focus-state.
- Button submit `full-width`, `size=lg`, indigo-filled.

### 8.2 DashboardPage — `/dashboard`

**Intent:** дневной inbox. Пользователь заходит утром, видит: «что
следующее», «что в работе», «где я с бюджетом». Не аналитика-экран;
action-oriented.

**Контент:**

- Greeting (`Доброе утро, {имя}.` / `Добрый день` / `Добрый вечер`
  по времени суток).
- Subtitle: «Claude готовит черновики, вы ставите подпись. Ниже —
  где вас ждут.»
- **NextActionChip** (focal point): один блок «Ваше следующее действие» —
  `Продолжить стадия 2 · Белая Линия · До дедлайна 3 дня`. Urgent
  вариант (≤2 дней) — indigo фон. Normal — white + border. Клик →
  переход на соответствующую wizard-страницу.
- **3 stat cards:** Активных проектов / Завершённых брендов / До
  дедлайна (среднее). Моно-цифры крупно, label uppercase mono.
- **Grid 60/40:**
  - Слева: список активных проектов (до 5) с mini progress bar по
    stage.
  - Справа: Бюджет проектов (spent / total USD, progress bar,
    pct-remaining) + «Как устроена работа» (3 шага onboarding для
    тех кто впервые).

**Пустые состояния:**

- Нет активных проектов: вместо list'a — большой EmptyState с CTA
  «Создать первый проект» (если `canCreate`) или «Пока проектов
  нет — ждите письмо от проджекта» (иначе).
- Первый визит + нет данных: onboarding-карточка prominent.

**Референс:**

- **Linear Inbox + Home** — density + next-action-first pattern.
- **Height home** — mini progress в project list item.
- **Attio dashboard** — компактные metric cards без «рамочек
  ради рамок».
- **Stripe Home** — budget widget с прогресс-баром.

**Что улучшить:**

- NextActionChip сейчас не ощущается как hero-элемент. Должен быть
  первым что глаз цепляет, physically larger, с subtle indigo
  подложкой в urgent-варианте.
- Stat cards должны быть плотнее и единообразнее.
- Список проектов слева должен быть сканируемым (Linear-pattern: name
  + mini progress + due-date, всё в одну строку).
- Budget widget справа — сейчас просто карточка с числами. Нужна
  визуальная подача бюджета как real metric: progress + sparkline
  опционально.

### 8.3 ProjectsPage — `/projects`

**Intent:** каталог всех проектов. Создание новых. Фильтрация.

**Контент:**

- Toolbar: search input (по бренду/клиенту) + filter pills (active
  / finalized / archived / all) + «Новый проект» (если canCreate).
- Grid 3-кол × N: ProjectCard (name, client, industry, tariff, 2 progress
  bars — stage и бюджет — StatusBadge).
- Empty states: no-search + no-filter + can-create (CTA) / no-search +
  no-filter + no-can-create (пассивное сообщение) / search-not-found.
- Modal «Новый проект» — форма: название бренда, клиент (select /
  create new), индустрия (select из 8), тариф (select из 3 с
  prices).

**Референс:**

- **Linear Projects** — плотный grid, читаемые tags.
- **Height Projects** — progress-indicators compact.
- **Attio Records** — фильтр pills.
- **Vercel Projects** — card layout.

**Что улучшить:**

- Карточки сейчас отдельны и «плавают». Нужна осознанная композиция:
  возможно, плотнее сетка (4 per row на 2xl?), чётче hierarchy
  (project name — dominant, остальное — deferred).
- Progress bars в карточках (сейчас тонкие 4px) — возможно визуально
  объединить stage-progress и budget-progress в единый элемент-tile,
  а не 2 отдельных linear bar'а.
- Filter pills сейчас рассыпаны, нужен сегментированный control или
  чёткая группа.

### 8.4 ProjectDetailPage — `/projects/:id`

**Intent:** overview одного проекта. 4 stage-карточки как tiles с
состоянием (completed / active / locked). Export DOCX/XLSX. Список
последних approvals.

**Контент:**

- Header-card: project name (h1), client, industry, tariff,
  бюджет AI (spent / total + pct). Две action buttons: «Экспорт
  XLSX» (secondary), «Экспорт DOCX» (primary).
- **Stage grid 4-across:** StageCard × 4. Каждая: stage icon (лаконичный,
  свой на stage), «Стадия N», stage name, 2-строчный description,
  количество артефактов, CTA кнопка («Продолжить» если active,
  «Посмотреть» если completed, disabled «Откроется позже» если locked).
- **Approvals section:** таблица последних 5 утверждений (artifact,
  when, who approved). CTA «Все утверждения» → `/projects/:id/approvals`.

**Референс:**

- **GitHub Repo Overview** — header с meta + action buttons + tabs
  внизу.
- **Linear Project Page** — stage-like progression.
- **Vercel Project Overview** — hero-metadata + grid.

### 8.5 Stage1Page — `/projects/:id/stage-1`

**Intent:** «Портрет клиента». Маркетолог вставляет транскрипты 3+
интервью с клиентами собственника → Claude извлекает voice-of-customer
(сегменты, боли, мотивы, триггеры). Итерация до готового портрета.

**Обёртка (общая для Stage 1–4):** `WizardShell`.

- Sticky top: 2px indigo progress bar + back-link к проекту.
- Row с 4 stage-buttons (текущая highlighted, пройденные completed
  checkmark, будущие disabled).
- Title mono («Портрет клиента»).

**Content-структура 3-column:**

- **Left 320px:** Stepper — маршрут стадии (4 шага методологии в этой
  стадии). Current highlighted.
- **Center 1fr:** основная рабочая зона — BigCanvasCard с большим
  textarea для транскрипта + character count + CTA «Извлечь
  паттерны».
- **Right 320px:** SufflerPanel — 3 контекстные hint-карточки
  (минимум 3 интервью / реальные слова / без гипотез), иногда
  danger-подсказка.

**Post-run state:**

- TimeSavedChip (короткий chip сверху: «+8 минут сохранено»).
- AI-drift card: pre/code JSON в monospace.
- FeedbackForm — компактная форма feedback (если не ok).

**Референс:**

- **Typeform** — большой textarea как focus-point, остальное
  второстепенно.
- **ChatGPT Canvas** — side panel с контекстом.
- **Notion AI** — prompt в фокусе, результат inline.

### 8.6 Stage2Page — `/projects/:id/stage-2`

**Intent:** «Сессия с собственником». 4 блока: Challenge, Легенда,
Ценности, Миссия. Thinking-partner режим — Claude задаёт провокационные
вопросы, маркетолог уточняет, собственник отвечает.

**Обёртка:** WizardShell.

**Content-структура:**

- **Tabs-bar 4 блока:** Challenge / Легенда / Ценности / Миссия.
  Каждый tab имеет accept-state (зелёный checkmark если accepted).
- **3-column:** (2fr, 3fr, 320px)
  - **Left 2fr:** Input card — textarea для ответов собственника
    (мин 40 символов) + CTA «Запустить thinking-partner» /
    «Сгенерировать черновик» / варианты per block.
  - **Center 3fr:** CanvasCard — AI-результат (если есть) или
    EmptyPlaceholder. Action row внизу карточки: «Принять» / «Пересгенерировать».
  - **Right 320px:** SufflerPanel — 3–4 hint'а per block.
- **Sticky bottom bar:** 4 progress dots (зелёный если accepted) +
  status text + primary CTA «Отправить на одобрение собственника»
  (disabled пока не все 4 accepted).

**Empty / populated / loading states** — нужны все.

**Референс:**

- **ChatGPT Canvas** — input сбоку, результат в фокусе.
- **Google Docs + Comments** — canvas + suggestions тон.
- **Linear Issue — sub-issues** — структура tab-like блоков.
- **Intercom Compose** — AI подсказки в side panel.

### 8.7 Stage3Page — `/projects/:id/stage-3`

**Intent:** «Архетип и позиционирование». 4 блока: Positioning, Messages,
Critique, Borderline. Самая technical-stage — тут появляется
validator (regex → LLM-judge → methodology) с traffic light (green /
yellow / red).

**Обёртка и 3-column структура — идентичны Stage 2.**

**Уникальное:**

- **ValidatorBadge** в Center-column над canvas: `green` (passed all
  checks), `yellow` (borderline, нужен человек), `red` (blocked, не
  принять).
- **JSON-input в некоторых блоках** (Positioning, Borderline) —
  потенциально textarea с mono-font и basic JSON syntax hints.
- **Danger-hint в suffler:** «В формулировках не упоминайте цены,
  скидки, 'наше качество'» — красный баннер в правой колонке.

**Референс:**

- **ChatGPT Canvas + validation**.
- **VSCode / GitHub PR checks** — ValidatorBadge pattern.
- **Stripe webhook validator** — json validation UI.

### 8.8 Stage4Page — `/projects/:id/stage-4`

**Intent:** финальный прогон. Месседж проходит 4 теста параллельно.
Все 4 green → утверждение собственника → export финального DOCX.

**Обёртка:** WizardShell.

**Content-структура:** Tabs = 3 вида:

- **Tests view:** card с input для месседжа + CTA «Прогнать 4 теста».
  После run: 2×2 grid TestCard (green/red border; test name;
  reasoning). Если все passed && не approved: success card
  с CTA «Утвердить финальный месседж».
- **Compare view:** DiffBlock (split-view): original message vs final
  message. Side-by-side diff с highlight changes.
- **Document view:** DOCX preview в iframe (720px × 600px). 2 download
  buttons внизу.

**Референс:**

- **Vercel deployments** — green/red check matrix.
- **GitHub Actions** — test-result tiles.
- **Linear multi-tab issue detail**.
- **Google Docs view** — для Document-tab.

### 8.9 ApprovalsPage — `/projects/:id/approvals`

**Intent:** собственник утверждает артефакты. Immutable snapshots
в S3 ObjectLock (7 лет retention). Это **ключевой экран для
owner_viewer**, особенно важный.

**Content-структура 3-column:** (280px, 1fr, 320px)

- **Left 280px:** список артефактов (stage_2.legend / stage_2.values /
  stage_2.mission / stage_3.positioning / stage_3.final_message).
  Каждый item: name (stage.artifact), icon statuses (checkmark если
  approved, clock если pending), selection highlight.
- **Center 1fr:** DocumentView — reader-mode article.
  `max-width: 720px`, centered. Typography — как у «подписываемого
  документа», не у UI (line-height 1.7, font-size 16px,
  serif-возможно?).
  SuggestionMarks inline (subtle yellow pulse animation) для
  issues. Green/yellow/red badge в header: «Утверждено» / «На ревью» /
  «Требует правок».
- **Right 320px:** thread-панель с suggestions / комментариями.
  «Manual approve fallback» form (в крайнем случае текст-поле для
  overriding digital approval).

**Sticky bottom bar** (только для owner && selected && !approved):
3 buttons: «Оставить комментарий» / «Запросить правки» / «Одобрить».
Primary-кнопка «Одобрить» — indigo filled.

**Референс (ОЧЕНЬ ВАЖНО):**

- **Google Docs — review mode.** Это наш основной якорь. Документ
  в центре, suggestions справа, actions снизу.
- **GitHub PR review.** Комментарии по конкретным строкам.
- **Linear Docs (недавно релизнуто).** Immutable snapshot feel.
- **Craft Docs Comments.**

### 8.10 SilentFailuresPage — `/admin/silent-failures`

**Intent:** chip_admin смотрит prompt-run-логи. AI-вызовы с retry > N,
timeouts, validation fails, blocked. «Горшков паттерн»: все неудачи
в одном месте, смотрим глазами каждое утро.

**Контент:**

- Intro card (elevated): AlertTriangle icon, explanation, Telegram
  digest note (9:00 MSK).
- Controls: threshold input (default 3 retries) + Refresh button + count badge.
- **Tabs 3:** All / By command / By error.
- Tables в каждом tab:
  - All: id, commandName, status, errorCode, retryCount,
    providerLatencyMs, createdAt.
  - By command: grouped rows.
  - By error: grouped rows.

**Референс:**

- **Sentry Issues list.**
- **Datadog Logs.**
- **Stripe Observability.**
- **PostHog events list.**

### 8.11 MarketerQualityPage — `/admin/marketer-quality`

**Intent:** chip_admin видит средний балл валидатора per marketer за
30 дней. Low score → разговор/тренинг.

**Контент:**

- Intro card (elevated): BarChart3 icon.
- Summary tiles (4): Маркетологов / Средний балл (success/warning/danger
  tone) / Всего валидаций / Low score count.
- Heatmap table: name, email, avgScore (ScoreBadge), totalValidations,
  regexViolations, llmJudgeFlags, methodologyViolations, humanOverrideCount.
  Cell-intensity по количеству.
- Click-on-row → drill-down modal (пока placeholder).

**Референс:**

- **Stripe Team Analytics.**
- **Linear Insights — member quality.**
- **Notion Team usage.**

### 8.12 WizardDropoffPage — `/admin/wizard-dropoff`

**Intent:** где маркетологи застревают, жмут back, зовут поддержку.
Funnel analysis per stage.

**Контент:**

- Intro card (elevated): TrendingDown icon.
- 4 Funnel cards (Stage 1-4): stage badge, count, progress bar.
- Detailed table: stage, stepKey, eventType, count, avgDurationSec.

**Референс:**

- **Mixpanel Funnels.**
- **Amplitude.**
- **Google Analytics Conversion Funnels.**
- **Hotjar Events.**

### 8.13 GoldenSetPage — `/admin/golden-set`

**Intent:** эталонные проекты для regression testing. Walk-forward
nightly 03:00 MSK, threshold 15%. CI блокирует merge prompt-changes
при regression.

**Контент:**

- Intro card (elevated): Target icon.
- Summary tiles: Фикстур всего, Pass rate %, Regression incidents.
- CTA button «Запустить сейчас» (Play icon + indigo filled).
- Tag-cloud: фикстуры per industry.
- History table: timestamp, promptVersion, passRate, regressionDetected
  (red badge).

**Референс:**

- **GitHub Actions workflows.**
- **CircleCI insights.**
- **Vercel deployments list.**

### 8.14 BillingConfigPage — `/admin/billing`

**Intent:** финдир Чиркова правит cost factor, markup, currency rate,
token pricing, тарифы (Economy / Standard / Premium). Квартальная
ревизия.

**Контент:**

- Intro card (elevated): Wallet icon.
- **Секции** (accordion или последовательный stack?):
  1. Cost factor (input + Save).
  2. Markup % (input + Save).
  3. Currency rate USD/RUB (input + Save).
  4. Token pricing: per-model (claude-opus-4-7, claude-haiku-4,
     gpt-4.1, gpt-4.1-mini, deepseek-chat). Per model 4 поля:
     inputPerMillion, outputPerMillion, cacheWritePerMillion,
     cacheReadPerMillion.
  5. Tariffs table (3 rows × 5 cols): E/S/P × monthly_rub /
     included_projects / markup_percent / sla_hours /
     manual_review_hours.
- **Live margin preview** внизу (важно): берёт текущие значения + sample
  tokens (300k input, 30k output) → рассчитывает cost USD, cost RUB,
  price per Standard, margin pct. Если NaN — багу fix (у нас это
  горело).

**Референс:**

- **Stripe Billing Settings.**
- **Shopify Plan Editor.**
- **AWS Cost Explorer.**

### 8.15 SecurityEventsPage — `/admin/security`

**Intent:** BriefSanitizer + RBAC events. Prompt injection, PII,
secrets, rejected tool-calls, jailbreak attempts. Critical → Telegram
chip_admin немедленно.

**Контент:**

- Intro card (elevated): Shield icon.
- **Tabs 4:** All / Critical / Warning / Info (count badges).
- Event table: kind, severity (color badge), userId (short hash),
  projectId (short hash), meta (JSON truncated + tooltip), createdAt.
- Tool whitelist section внизу: list ToolWhitelistEntry × N.

**Референс:**

- **Auth0 Logs.**
- **Sentry Security Events.**
- **CloudFlare Security.**
- **Stripe Radar events.**

### 8.16 UsersPage — `/admin/users`

**Intent:** RBAC user management. 4 роли. Регистрация только через
chip_admin. Клиенты.

**Контент:**

- Intro card (elevated): Users icon.
- **2-column layout** (xl: grid-cols-2):
  - **Clients section:** search, list × N (name + type ООО/ИП
    badge), «Новый клиент» button.
  - **Users section:** search, list × N (fullName, email, globalRole
    badge, projectRoles count).

**Референс:**

- **Linear Team Members.**
- **GitHub Org Members.**
- **Vercel Team Settings.**

---

## 9. Компоненты — ОЖИДАЕМЫЙ handoff

Выдай полный набор, оформленный как Figma design system + HTML+Tailwind
exports. Или просто HTML+Tailwind если Figma недоступно. Формат не
критичен — критично что каждый компонент приходит с:

- default state
- hover state
- active / pressed state
- focus-visible state
- disabled state
- loading state (где применимо)
- empty state (где применимо)
- error state (где применимо)

### 9.1 Atoms / Primitives

- **Button** (primary | secondary | ghost | danger) × (sm | md | lg)
  × (with iconLeft | with iconRight | icon-only). Subtle scale-98 на
  active, transition-[background-color,border-color,color,transform]
  duration-150 ease-out.
- **Input** / **Textarea** / **Select** — с label, hint, error message.
  Height md (40px) и lg (48px).
- **Checkbox** / **Radio** / **Switch** (редко используется, но должен быть).
- **Badge** (solid | soft | outline) × (neutral | primary | success |
  warning | danger | info) × (with icon | without).
- **Avatar** (initials-based, indigo circle, sm/md/lg).
- **Tooltip** (not native).
- **Link** (indigo, underline on hover).
- **Divider** (hr-style + vertical).
- **Kbd** (keyboard-shortcut chip, mono).

### 9.2 Molecules

- **Card** (Card.Header / Card.Title / Card.Description / Card.Body /
  Card.Footer). Variants: default (border only), elevated (border +
  shadow-soft-2), interactive (hover effects).
- **Tabs** (Tabs.List / Tabs.Tab / Tabs.Panel). Underline-style active
  indicator.
- **Breadcrumbs** (Breadcrumbs.Item / Breadcrumbs.Current). ChevronRight
  separator. Last item — muted.
- **Dropdown** (menu-style, items с icons + kbd).
- **Modal** (header-body-footer, closeButton, overlay с blur-backdrop).
- **ProgressBar** (horizontal, 4-6-8px heights, primary/success/warning/danger
  colors).
- **Stepper** (vertical, per-step: number-badge (completed/active/locked) +
  title + description + connector line).
- **EmptyState** (icon + title + description + action). Compact и full
  varianty.
- **Pagination** (если нужна).
- **Toast / Snackbar** (сейчас нет, можно добавить в system).

### 9.3 Composite / Shell

- **Sidebar** (fixed left, dark, 240/64 collapsible). Вариант с
  chip_admin admin-группой и без.
- **Header** (top bar, breadcrumbs optional, title + bell).
- **QueueBanner** (показывается когда AI-queue depth > 0; Clock icon,
  indigo bg-50, compact).
- **WizardShell** (sticky top 2px progress + back-link + 4 stage-button
  row + title). Обёртка для Stage 1–4.
- **CanvasCard** — центральная карточка wizard'ов с AI-результатом.
  Имеет варианты: empty, loading (spinner + explanation), populated,
  accepted.
- **SufflerPanel** — правая панель wizard'ов с 3-4 hint-карточками
  (info / warning / danger).
- **StatCard** — dashboard-карточка с моно-цифрой и uppercase label.
- **ProjectCard** — card для projects list. Variant interactive.
- **StageCard** — card в project detail. 4 состояния: locked / active /
  completed / disabled.
- **TestCard** (Stage 4) — green/red border + icon + name + reasoning.
- **ValidatorBadge** (Stage 3) — green/yellow/red with label и
  explanation-popover.
- **TimeSavedChip** — subtle chip «+8 мин сохранено».
- **SuggestionMark** (Approvals) — inline text highlight с yellow
  pulse.
- **DiffBlock** (Stage 4 Compare) — side-by-side diff с highlighting.

### 9.4 Screens

Все 16 (пере)изобрази. Minimum — desktop 1440×900. Желательно также
1920×1080 и 375×812 (iPhone). Для каждого экрана:

- populated state (с реалистичными данными; примеры имён: «Белая
  Линия», «Стоматология №1», «Премиум Кухни», «Детская Академия
  Моцарта», «Автотехцентр RS», «Ресторан Пушкин»; industry mix).
- empty state.
- loading state.
- error state (где релевантно).

---

## 10. Что мы от тебя ждём на выходе

1. **Design tokens JSON** (формат Style Dictionary / Figma Tokens).
   Если ты подкорректируешь тени или добавишь «medium» градацию —
   окей, но не ломай уже закреплённое (colors / radii / fonts).
2. **Component library** — все компоненты из §9 в виде:
   - Figma файл (приоритет), ИЛИ
   - HTML+Tailwind страница с каждым компонентом и всеми его
     состояниями.
3. **Screen mockups** — все 16 экранов. Desktop + mobile.
4. **Handoff bundle** — один zip (или одна web-страница) со всем
   вышеперечисленным в форме, которую можно передать в Claude Code
   и попросить «имплементируй это».
5. **Design rationale notes** (короткие): на каждый экран 2–3 предложения
   «почему именно так, к какому референсу ближе всего, что
   отличает от текущего».

---

## 11. Референс-библиотека (обязательно посмотри, приложу скриншоты
отдельно)

Это продукты, в стиле которых мы хотим быть. Пользователь приложит
конкретные скриншоты; ниже — что именно смотреть.

### 11.1 Linear (https://linear.app) — ПЕРВЫЙ якорь

- `/home` (inbox): density + next-action pattern.
- `/my-issues` (list): compact rows + inline progress + priority.
- Issue detail: sidebar metadata + main content + right-rail
  activity.
- Settings: layout и tabs.
- Design docs (https://linear.app/now/how-we-redesigned-the-linear-ui):
  button states, density principles, contrast.

### 11.2 Stripe Dashboard (https://dashboard.stripe.com) — ВТОРОЙ якорь

- Home: metric cards + activity timeline.
- Payments list: dense table + filters.
- Invoice detail: «подписываемый документ» feel.
- Billing settings: as reference для BillingConfigPage.

### 11.3 Vercel (https://vercel.com/dashboard) — ТРЕТИЙ якорь

- Projects list: cards layout.
- Project detail: tabs + deployments list.
- Settings: team members (для UsersPage).
- Typography hierarchy (Geist design system).

### 11.4 Attio (https://attio.com) — для record-style UI

- Records view: table-as-UI.
- Record detail: side-by-side metadata + notes.

### 11.5 Notion / Notion Calendar

- Sidebar breakdown (есть отдельная статья на Medium).
- Page header patterns.

### 11.6 Google Docs / Craft Docs

- **Review mode** — главный якорь для ApprovalsPage.
- Suggestion mode UX.
- Document typography.

### 11.7 ChatGPT Canvas / Anthropic Claude Artifacts

- Side panel + main content layout.
- AI-draft visual differentiation.

### 11.8 Typeform

- One-question focus UX (для Stage 1 в упрощённом режиме).

### 11.9 Height (https://height.app)

- Project progress compact pattern.

### 11.10 PostHog / Sentry / Datadog

- Observability dashboards (для admin pages).

### 11.11 GitHub

- PR review UX (для Approvals comment threads).
- Repo overview (для ProjectDetailPage).

---

## 12. Anti-patterns — КАТЕГОРИЧЕСКИ НЕ НАДО

- ❌ Не предлагай dark mode. Не сейчас.
- ❌ Не предлагай «ещё одну палитру» или пастельные оттенки.
- ❌ Не переделывай sidebar на «hamburger menu / modern floating nav» —
  left-dark-sidebar 240/64 это hard-constraint.
- ❌ Не добавляй user-avatar-dropdown в header. Никогда.
- ❌ Не добавляй социальные/маркетинговые элементы (share buttons,
  referral promos, tooltips про product tour).
- ❌ Не используй скевоморфные/«стеклянные»/glassmorphism эффекты.
  Мы — Linear-like flat (+ subtle depth), не iOS 7.
- ❌ Не добавляй animated-illustrations на empty states (Lottie).
  Только static-иконки lucide-react.
- ❌ Не используй emoji в UI текстах.
- ❌ Не используй colored shadows (типа indigo-shadow). Только
  нейтральные rgba(0,0,0,X).
- ❌ Не предлагай новые шрифты. Inter + IBM Plex Mono — final.
- ❌ Не предлагай border-radius > 20px (для карточек) или > 12px
  (для кнопок). Это hard limit.
- ❌ Не добавляй onboarding-tour overlay / coach-marks. Onboarding —
  это секция на dashboard «Как устроена работа», больше ничего.

---

## 13. Оценочные критерии (как мы поймём что ты справился)

1. **Три экрана подряд смотрим — ощущается один продукт.** Rhythm,
   density, typography — consistent.
2. **Любой экран открываем — первое что цепляет глаз, это primary
   action / focal point этой страницы.** (Не логотип, не navigation,
   не footer.)
3. **Visual hierarchy безошибочная.** Page title ≫ section heading ≫
   card title ≫ body. Без зрительного «парета» где два элемента
   кричат одинаково.
4. **Empty states — намеренные.** Не «мы не заполнили», а «мы
   осознанно показываем что список пуст, и вот что делать».
5. **Premium feel без кричащих эффектов.** Никаких gradient banners,
   animated hero, бросающихся в глаза colored shadows. «Spartan
   elegance».
6. **Density не ломает читаемость.** Chip_manager должен видеть 5
   проектов + 3 статы + next action на одном экране без scroll —
   но не терять фокус.
7. **Owner_viewer на ApprovalsPage минимум когнитивной нагрузки.**
   Он видит: документ, 3 кнопки, suggestions. Всё остальное — тихое.
8. **Все инварианты §7 соблюдены.** Sidebar / header / buttons /
   cards — все в рамках.
9. **Tokens из §6 не переизобретены.** Расширения окей; замены — нет.
10. **Handoff bundle компилируется в Claude Code.** Tailwind classes +
    TSX, без кастомного CSS-in-JS, без зависимостей которых у нас нет.

---

## 14. Коротко — что от тебя

**Build a design system and complete UI for a premium B2B SaaS — Brand
Platform by Чирков и Партнёры agency. 16 screens, 4 user roles, linear
4-stage wizard + approvals + admin. Visual aim: Linear-grade density
and craft, Stripe-grade typography, Attio-grade record UX, Google
Docs-grade review-mode. Keep our indigo / warm-gray / IBM Plex Mono
tokens intact. Observe all invariants from section 7. Output Figma +
HTML/Tailwind handoff bundle for Claude Code.**

**Start with the design system foundation (tokens audit + atoms
primer), then shell (Sidebar / Header / WizardShell), then 4 wizard
stages (highest-frequency screens), then the rest. Show me thinking.
Ask clarifying questions if ambiguous — особенно по §8 (per-screen specs).**

Спасибо. Мы настроены сделать это правильно.

---

## Приложения (прикрепить отдельными файлами в Claude Design)

1. **Текущие скриншоты** всех 16 экранов — из браузера localhost. Пользователь сделает скриншоты сам, как минимум: Login, Dashboard, Projects, Project Detail, Stage 1–4, Approvals, Admin (все 7).
2. **Логотипы:** `logo-full-dark.png`, `logo-emblem-light.png`, `logo-emblem-dark.png`, `logo-icon-dark.png`, `logo-icon-outline.png`, `favicon.svg`. Из `/frontend/public/brand/`.
3. **Референсы (screenshots):** минимум по 1 экрану с каждого — Linear Home, Linear Issue, Stripe Dashboard, Stripe Invoice, Vercel Projects, Attio Records, Notion Calendar, Google Docs Review, ChatGPT Canvas, GitHub PR. **Это самый важный блок приложений** — без них ты не поймёшь «в каком стиле».
4. **`src/styles/index.css`** — текущие токены (приложи как справочный файл).
5. **`src/config/platform.ts`** — brand texts.
