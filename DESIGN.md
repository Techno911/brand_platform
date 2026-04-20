# DESIGN.md — Brand Platform (BP) дизайн-система

> Единый источник правды по визуалу и UX-паттернам BP.
> Дополняет: `~/.claude/CHIP_UI_KIT.md` (общая бойлерплейт-спецификация ЧиП), `BP/CLAUDE.md` (инварианты продукта), брендбук Артём & Партнёры (`Чирков и партнеры/Логотип/LOGOBOOK/`).
> При конфликте приоритет — этот файл.

---

## 1. Design philosophy — «методология видна в UI»

BP не ещё один SaaS-бойлерплейт. Это **материализация методологии ЧиП 3.1** в интерфейсе. Четыре принципа:

**1.1. Claude = черновик. Человек = подпись.**
Каждый AI-артефакт визуально ниже человеческого. Оранжевая полоска слева на AI-блоке, серая — на утверждённом. После принятия человеком: полоска тускнеет, появляется `<Badge>Утверждено маркетологом</Badge>`. Никогда не «AI решил архетип» — всегда «Claude предложил, вы выбрали».

**1.2. Линейность 4 стадий — закон, а не подсказка.**
Стадии жёстко блокируются до DoD предыдущей. Навигация назад разрешена (просмотр + правка утверждённого), «перепрыгнуть» — нет. Stepper слева видим всегда, визуально показывает где ты и что заблокировано.

**1.3. Гуманитарий-friendly.**
Целевой пользователь — Оля, маркетолог-гуманитарий без технического бэкграунда. Запрет:
- технический жаргон («tool call», «token», «prompt run», «roundtrip») в UI маркетолога
- пустой экран без подсказки что делать
- больше 2 CTA на одном экране
- модалки-подтверждения на каждое действие

**1.4. Anti-принципы.**
- ❌ Glassmorphism на основном контенте. Разрешён только на dropdown/popover.
- ❌ Motion everywhere. Только ключевые переходы (см. §7).
- ❌ Тени везде. Карточки без тени по умолчанию; `shadow-soft-2` только на overlay/admin.
- ❌ Пёстрые цвета ради эмоций. Оранжевый = действие, серый = контекст, зелёный = успех, красный = блок. Больше ничего.

---

## 2. Design tokens

### 2.1. Цвет

**Base palette (брендбук ЧиП):**
```
--brand-white:   #FEFEFE   /* CMYK 0 0 0 0 */
--brand-ink:     #2B2A29   /* тёмно-серый, "COLOR 02" в брендбуке */
```

**Accent (платформенный, подтверждён оранжевой крышкой на бутылке стр. 21 брендбука):**
```
--primary-50:    #FFF7ED
--primary-100:   #FFEDD5
--primary-200:   #FED7AA
--primary-300:   #FDBA74
--primary-400:   #FB923C
--primary-500:   #F97316   /* canonical brand accent */
--primary-600:   #EA580C   /* hover */
--primary-700:   #C2410C
--primary-800:   #9A3412
--primary-900:   #7C2D12
```

**Neutral (тёплый серый, чтобы не спорил с тёплым оранжевым):**
```
--neutral-0:     #FFFFFF
--neutral-50:    #FAFAF9
--neutral-100:   #F5F5F4
--neutral-200:   #E7E5E4
--neutral-300:   #D6D3D1
--neutral-400:   #A8A29E
--neutral-500:   #78716C
--neutral-600:   #57534E
--neutral-700:   #44403C
--neutral-800:   #292524
--neutral-900:   #1A1A1A   /* sidebar bg, text-ink */
```

**Semantic:**
```
--success-500:   #22C55E   --success-50:   #F0FDF4
--warning-500:   #EAB308   --warning-50:   #FEFCE8
--danger-500:    #EF4444   --danger-50:    #FEF2F2
--info-500:      #3B82F6   --info-50:      #EFF6FF   /* ТОЛЬКО в admin observability; НЕ UI-акцент */
```

**Запрет:** `blue/indigo/violet/purple-{N}` в классах и hex-цветах вне `--info-*` на admin-страницах. `grep -rE '(blue|purple|indigo|violet)-[0-9]' frontend/src/` должен быть пустым, кроме admin-наблюдаемости.

### 2.2. Typography

**Гибрид двух шрифтов (обосновано):**

| Использование | Шрифт | Обоснование |
|---|---|---|
| Body-текст, UI-элементы, формы, длинные абзацы | **Inter** 400/500/600/700 | Sans-serif для длинного чтения, отличная кириллица, стандарт SaaS |
| Логотип, числа, код, моноширинные значения, debug | **IBM Plex Mono** 400/500/600/700 | Канон брендбука. Используется в лого и tagline |
| Display-заголовки стадий, hero-блоки | **IBM Plex Mono SemiBold** | Переносит характер брендбука в продукт |

**Шкала (rem, 1rem = 16px):**
```
display:    2.5rem (40px)  / line-height 1.1 / weight 600 / Plex Mono / tracking -0.02em
h1:         2rem   (32px)  / line-height 1.15 / weight 700 / Inter
h2:         1.5rem (24px)  / line-height 1.25 / weight 600 / Inter
h3:         1.25rem (20px) / line-height 1.3  / weight 600 / Inter
body-lg:    1rem   (16px)  / line-height 1.6  / weight 400 / Inter
body:       0.875rem (14px)/ line-height 1.6  / weight 400 / Inter   /* default */
caption:    0.75rem (12px) / line-height 1.5  / weight 500 / Inter
mono-sm:    0.8125rem(13px)/ line-height 1.5  / weight 500 / Plex Mono /* числа, cost, IDs */
```

### 2.3. Spacing scale

Шаг 4px. Разрешённые значения (Tailwind): `0/0.5/1/1.5/2/3/4/5/6/8/10/12/16/20/24/32`. Другие — через inline style только для динамики.

### 2.4. Radius

```
--radius-sm:   4px   /* чипы, теги, inline-элементы */
--radius-md:   8px   /* input, small buttons */
--radius-lg:   12px  /* ★ все buttons — canonical */
--radius-xl:   16px  /* small cards (chips, badges large) */
--radius-2xl:  20px  /* ★ все cards — canonical */
--radius-full: 9999px /* avatar, pill */
```

**Hard rule из CLAUDE.md:** кнопки только `rounded-lg`, карточки только `rounded-2xl`. Нарушение = баг.

### 2.5. Shadow

```
--shadow-none:   none                            /* default для <Card> */
--shadow-soft-1: 0 1px 2px 0 rgba(0,0,0,0.05)    /* sticky nav, subtle */
--shadow-soft-2: 0 4px 12px 0 rgba(0,0,0,0.06)   /* <Card elevated> в admin */
--shadow-overlay:0 12px 40px 0 rgba(0,0,0,0.15)  /* <Modal>, <Dropdown> */
--shadow-focus:  0 0 0 3px rgba(249,115,22,0.25) /* focus ring orange */
```

**Правило:** карточки без тени по умолчанию. `shadow-soft-2` разрешён только на `<Card elevated>` в admin-дашбордах, где плотная информация требует визуальной иерархии.

### 2.6. Motion

```
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1)     /* default для enter */
--ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1)    /* для toggle */
--dur-instant:     100ms  /* focus-ring, hover-color */
--dur-fast:        150ms  /* button press, small transitions */
--dur-base:        200ms  /* suffler slide, stepper advance */
--dur-slow:        300ms  /* sidebar collapse, page fade */
--dur-pensive:     500ms  /* stage transition, DOCX preview fade */
```

**Запрет:** спиннеры на каждой кнопке, параллакс, spring-physics, бесконечные анимации (кроме loading-индикатора внутри `<Button loading>`).

---

## 3. Compound UI-примитивы

Живут в `frontend/src/components/ui/`. API — Radix-inspired (headless+styled), без shadcn CLI.

### 3.1. `<Button>`

```tsx
<Button
  variant="primary" | "secondary" | "ghost" | "danger"
  size="sm" | "md" | "lg"
  iconLeft={LucideIcon}
  iconRight={LucideIcon}
  loading={boolean}
  disabled={boolean}
  type="button" | "submit"
>
  Label
</Button>
```

Высоты: sm=32px, md=40px, lg=48px. Все — `rounded-lg`, `font-medium`, focus ring оранжевый.

### 3.2. `<Card>` + slots

```tsx
<Card variant="default" | "elevated" | "interactive">
  <Card.Header>…</Card.Header>
  <Card.Body>…</Card.Body>
  <Card.Footer>…</Card.Footer>
</Card>
```

- `default`: `rounded-2xl border border-neutral-200`, без тени. Canonical.
- `elevated`: + `shadow-soft-2`. ТОЛЬКО в admin.
- `interactive`: + `hover:border-primary-300 cursor-pointer transition-colors`. Для карточек проектов на dashboard.

### 3.3. `<Input>` / `<Textarea>` / `<Select>`

```tsx
<Input
  label="Email"
  hint="Используйте корпоративный адрес"
  error="Неверный формат"
  iconLeft={Mail}
  size="md" | "lg"
  {...nativeInputProps}
/>
```

Дефолт: `bg-neutral-100 border-neutral-200 rounded-lg h-10`, focus: `border-primary-500 ring-1 ring-primary-500`. Ошибка: `border-danger-500 ring-danger-500`.

### 3.4. `<Badge>`

```tsx
<Badge variant="solid" | "outline" color="primary" | "neutral" | "success" | "warning" | "danger">
  Утверждено
</Badge>
```

Высота 22px, `rounded-md text-xs font-semibold px-2`, uppercase opt-in.

### 3.5. `<EmptyState>`

```tsx
<EmptyState
  icon={FolderKanban}
  title="У вас пока нет проектов"
  description="Проджект Чиркова заведёт первый проект после вводного звонка."
  action={<Button variant="primary">…</Button>}
/>
```

Layout: icon 48px neutral-300 в круге neutral-100, title h3, description body muted, action опционально. **Seed-правило:** каждая list-страница ОБЯЗАНА иметь EmptyState.

### 3.6. `<Stepper>` (вертикальный)

```tsx
<Stepper value={currentStep} onChange={setStep}>
  <Stepper.Item index={1} status="completed" label="Портрет" />
  <Stepper.Item index={2} status="current" label="Сессия" />
  <Stepper.Item index={3} status="locked"  label="Архетип" />
  <Stepper.Item index={4} status="locked"  label="4 теста" />
</Stepper>
```

Circle 32px. completed = primary-500 bg + checkmark; current = primary-500 outline + number; locked = neutral-200 bg + lock icon. Линия между = neutral-200 (completed = primary-500).

### 3.7. `<Tabs>`

Radix-like controlled. Подчёркивание `border-b-2 border-primary-500` на активной вкладке. На dark backgrounds — через prop `theme="dark"`.

### 3.8. `<Modal>` (Dialog)

Overlay `bg-neutral-900/60 backdrop-blur-sm`, panel `rounded-2xl bg-white max-w-lg shadow-overlay`. ESC закрывает, фокус-trap, `aria-modal="true"`.

### 3.9. `<Dropdown>` (Menu)

Panel `rounded-lg shadow-overlay border-neutral-200 bg-white/95 backdrop-blur-md`. Glass — единственное разрешённое место для glassmorphism.

### 3.10. `<Tooltip>` + `<Tooltip.Rich>`

Обычный: тёмный bg neutral-900, text white, 300ms delay (как в текущем Tooltip.tsx).
Rich: с заголовком и ссылкой «Подробнее», `max-width 280px`. Используется на суфлёр-подсказках и cost-tooltips.

### 3.11. `<Breadcrumbs>`

```tsx
<Breadcrumbs>
  <Breadcrumbs.Item href="/projects">Проекты</Breadcrumbs.Item>
  <Breadcrumbs.Item href="/projects/123">Белая Линия</Breadcrumbs.Item>
  <Breadcrumbs.Current>Стадия 2</Breadcrumbs.Current>
</Breadcrumbs>
```

Иконка `ChevronRight` 14px между. Text-sm neutral-500, current = neutral-900 semibold.

### 3.12. `<DiffBlock>` (Cursor pattern, Stage 4)

```tsx
<DiffBlock
  before="Мы создаём уникальные продукты"
  after="Мы делаем то, что нельзя украсть"
  label="Message #2 / Фраза"
/>
```

Split или unified — prop `view="split" | "unified"`. Removed = neutral-100 bg + strikethrough; added = primary-50 bg + `border-l-2 border-primary-500`.

### 3.13. `<SuggestionMark>` (Google Docs pattern, Approvals)

Inline-marker: `<span>` с `underline decoration-warning-500 decoration-dotted`, клик фокусирует thread справа. Hover показывает мини-tooltip с именем автора.

---

## 4. Key screens specs

### 4.1. Login

**Layout:** split 40/60 (hard-constraint из CLAUDE.md).

- **Левая панель (40%, `bg-neutral-900`):**
  - Логотип `/brand/logo-full-dark.png` с CSS `filter: invert(1) brightness(1.15)` → visually white-on-dark (избегаем варианта с tagline-матом).
  - Hero-заголовок (Plex Mono SemiBold 32px/1.1): **«Методология ЧиП 3.1. Линейно и по делу.»**
  - Три подсказки под ним (Inter 14px neutral-400, Plex Mono для цифр):
    - `4` стадии. `8–12` рабочих дней.
    - `3`-уровневый валидатор на каждую формулировку.
    - Собственник подписывает документ в один клик.
  - Footer: copyright + ссылка на CHANGELOG.

- **Правая панель (60%, `bg-white`):**
  - Max-width 420px центр.
  - `<h1>Добро пожаловать</h1>` (Inter 24px bold), подзаголовок «Войдите, чтобы продолжить» neutral-500.
  - Форма через `<Input size="lg">` + `<Button variant="primary" size="lg" iconLeft={LogIn}>Войти</Button>`.
  - Error-box через inline Badge-red или карточка neutral. **Без ссылки «Зарегистрироваться»** (CLAUDE.md hard rule).

- **Motion:** страница fade-in 300ms на mount. На правую панель — delay 100ms (каскад).

### 4.2. Dashboard маркетолога

**Layout:** вертикально.

1. **Topbar приветствие** — `<h1>Доброе утро, {firstName}</h1>` + hero-chip с суфлёром (Linear inbox pattern):
   > «Следующий шаг: Стадия 2 — сессия с собственником. Собственник ждёт ответа по 3 ценностям.»
2. **Grid 60/40:**
   - **60% проекты:** карточки через `<Card variant="interactive">` с progress-dots (4 круга = 4 стадии). Hover — border primary-300.
   - **40% боковой блок:**
     - `<Card>` «Бюджет проекта» — `<TimeSavedChip>` (сколько Claude сэкономил часов — уже готов компонент) + progress-bar бюджета (лимит видит только маркетолог).
     - `<Card>` «Лента» — последние 5 action в audit log (по проекту) с иконками lucide.
3. **EmptyState**: если проектов нет → `<EmptyState>` с call «Дождитесь, когда проджект ЧиП пришлёт приглашение в проект».

### 4.3. Wizard Stage 1 (Typeform pattern)

**Цель:** собрать портрет клиента — 6 вопросов. Одно окно = один вопрос.

**Layout:**
- **Left 280px:** `<Stepper>` вертикальный (4 стадии).
- **Center flex:** один вопрос за раз, `<h2>` + `<Textarea size="lg">` (min-h-32), hint ниже.
- **Right 320px:** `<SufflerPanel>` (уже реализован) — подсказки + мини-примеры.
- **Top sticky 2px progress bar** `bg-primary-500` (Stripe pattern).
- **Bottom sticky bar:** `<Button variant="ghost">Назад</Button>` слева, счётчик «2 из 6» в центре, `<Button variant="primary">Далее →</Button>` справа. `Enter` = next.
- **Valid?** — если поле пустое/короткое, кнопка disabled, под полем hint «минимум 30 символов».

### 4.4. Wizard Stage 2-3 (ChatGPT Canvas pattern)

**Цель:** править AI-черновики ценностей/легенды/миссии/позиционирования.

**Layout:** split 40/60.
- **Left 40%:** `<Card>` заметки маркетолога + цитаты из Stage 1.
- **Right 60%:** AI-canvas. Каждая AI-секция = `<Card>` с `border-l-4 border-primary-500`:
  - Заголовок (Ценность #1 / Миссия / и т.д.)
  - AI-текст
  - Chips-панель внизу:  
    `<Button variant="ghost" size="sm" iconLeft={Check}>Принять</Button>`  
    `<Button variant="ghost" size="sm" iconLeft={RefreshCw}>Пересгенерировать</Button>`  
    `<Button variant="ghost" size="sm" iconLeft={Edit}>Править</Button>`
  - После принятия: `border-l-4` меняется на neutral-300, появляется `<Badge color="success">Утверждено маркетологом</Badge>`.
- **Sticky footer:** `<Button variant="primary" size="lg" disabled={!allAccepted}>Отправить на одобрение собственника</Button>`

### 4.5. Wizard Stage 4 (Cursor + DOCX preview)

**Цель:** 4 теста месседжа + генерация финального DOCX.

**Layout:** `<Tabs>` сверху (`rounded-lg border` для tablist):
1. **Просмотр** — финальный документ в типографике, max-width 720px, Inter 16px, line-height 1.6.
2. **Сравнить** — `<DiffBlock view="split">` для каждого отредактированного message.
3. **Preview DOCX** — iframe с docx-preview (либо S3-ссылка через docx-exporter микросервис).

**Bottom sticky bar:** `<Button variant="primary" iconLeft={Download} size="lg">Скачать DOCX</Button>` + `<FeedbackForm>` в попапе.

### 4.6. Approvals (owner_viewer, судьба 2 минут)

**Контекст:** собственник заходит один раз. Утверждает или просит правки. Методологический инвариант: без его approval ничего не публикуется.

**Layout:** 280 / flex / 320.
- **Left 280px:** список пунктов approval (ценности, миссия, позиционирование, messages). Каждая с иконкой статуса: `CheckCircle` neutral-300 → primary-500 при approved, `MessageCircle` warning-500 если правка запрошена.
- **Center flex:** документ с inline `<SuggestionMark>` на фрагментах где собственник может оставить правку.
- **Right 320px:** thread-comments (Figma branch-comments pattern). Клик на `<SuggestionMark>` фокусирует соответствующий thread.
- **Bottom sticky CTA bar** (GitHub PR pattern):
  - `<Button variant="primary" size="lg" iconLeft={Check}>Одобрить целиком</Button>`
  - `<Button variant="secondary" size="lg" iconLeft={MessageCircle}>Запросить правки</Button>`
  - `<Button variant="ghost" size="lg">Оставить комментарий</Button>`

**Гуманитарный first-use:** собственник видит `<OnboardingBanner>` поверх документа на первом входе: «Читайте документ. Внизу три кнопки. Если всё нравится — нажимайте зелёную. Если что-то поправить — жёлтую.»

### 4.7. Admin (7 дашбордов, Горшков + Карпов паттерны)

Общее: `<Card variant="elevated">` разрешён. Плотность информации выше. Иерархия:

- **SilentFailuresPage:** `<Tabs>` Активные / Решённые / Игнор. Таблица + «Расследовать» → `<Modal>` с prompt_run деталями.
- **BillingConfigPage:** `<Card>` с range-sliders для `anthropic_cost_factor`, `markup_percent`, `currency_rate_usd_rub`. Live preview итоговой маржи.
- **MarketerQualityPage:** heatmap 7×4 (7 маркетологов × 4 стадии), drill-down `<Modal>`.
- **GoldenSetPage:** таблица фикстур + `<Button>Прогнать регрессионный тест</Button>` (PR blocker gate).
- **WizardDropoffPage:** funnel-bar + список уходов.
- **SecurityEventsPage:** table с фильтром по типу (prompt_injection / tool_call_rejected / pii_warning).
- **UsersPage:** table + `<Badge>` для ролей + `<Dropdown>` для действий.

---

## 5. Информационная архитектура

### 5.1. Sidebar grouping

Dark `bg-neutral-900`. Ширина 240/64 inline style (Tailwind v4 JIT constraint). Lockup:
```
┌─ Лого + название
├─ Nav user:
│   Главная
│   Проекты
│   Утверждения (если есть проекты)
├─ ──────────── (разделитель border-t border-neutral-700)
├─ Nav admin (только chip_admin):
│   Silent failures
│   Качество маркетологов
│   …
└─ [avatar + имя] [LogOut]    ← единственное место с logout (CLAUDE.md hard)
```

Collapse state в `localStorage('bp.sidebar.open')`. Header пустой.

### 5.2. Breadcrumbs

Показываются на Wizard/Project/Admin-детальных. Не на Dashboard/Login.

Формат:
```
Проекты  ›  Белая Линия  ›  Стадия 2
```

### 5.3. Empty states — first-class citizens

CLAUDE.md правило: «У КАЖДОЙ роли должен быть контент при входе». Применение: каждая list-страница (`ProjectsPage`, `ApprovalsPage`, `UsersPage`, `SilentFailuresPage` etc.) имеет `<EmptyState>` для рендера без данных. Seed создаёт минимум 5 недель данных, но UI не должен ломаться без данных.

---

## 6. Interaction patterns (по ролям)

### 6.1. Cost-display

- **Маркетолог:** только процент от лимита бюджета в `<Card>Бюджет проекта</Card>`. Не видит ни токенов, ни raw cost, ни маржу.
- **chip_admin:** `/admin/billing` — raw cost + markup + margin per project. Полная видимость (единственная роль с доступом к биллингу; см. docs/RBAC.md).
- **owner_viewer:** не видит cost вообще.

### 6.2. Per-stage AI drafting UX

| Стадия | Паттерн | Компонент |
|---|---|---|
| 1 (интервью) | Typeform (one Q/step) | `<Stepper>` + focused-input |
| 2 (сессия) | ChatGPT Canvas | split 40/60 + inline chips |
| 3 (архетип) | ChatGPT Canvas + critique | + `<Card border-warning-500>` для замечаний критиков |
| 4 (4 теста) | Cursor diff | `<Tabs>` + `<DiffBlock>` |

### 6.3. Approval workflow

Owner-viewer видит документ ReadOnly, но с overlay `<SuggestionMark>`. Suggestions создаются через выделение текста → всплывает `<Button size="sm">Предложить правку</Button>` (Google Docs pattern). Обязательный комментарий обоснования.

### 6.4. Error surfaces

- Inline field error: под input, `text-sm text-danger-500`.
- Form error summary: `<Card variant="default" className="border-danger-500 bg-danger-50">`.
- Toast (будущее): правый нижний угол, 5s auto-dismiss.
- Critical (budget exceeded, project busy): full-page `<ErrorBoundary>` с CTA «Связаться с проджектом ЧиП».

---

## 7. Motion бюджет

**Разрешено:**
- Sidebar collapse: 300ms ease-in-out
- Stepper advance: 200ms ease-out (circle fill)
- Stage transition (page-level): 500ms crossfade
- `<SufflerPanel>` enter: 200ms slide-in (уже реализован)
- `<Modal>` enter: 200ms scale-fade
- Button hover-color: 150ms
- Focus ring: instant (100ms при keyboard nav)

**Запрещено:**
- Спиннер на каждой кнопке (только `loading={true}` prop)
- Параллакс
- Spring physics
- Бесконечные анимации (кроме внутри `<Button loading>`)

---

## 8. Accessibility

- Focus ring: `ring-2 ring-primary-500 ring-offset-2` на всех interactive-элементах.
- ARIA: `<Stepper>` → `role="progressbar" aria-valuenow aria-valuemax`; `<Modal>` → `role="dialog" aria-modal="true"`; `<Badge>` → `role="status"` когда это live-state.
- Клавиатура: Tab/Shift+Tab везде, Enter submit, Esc close-modal, стрелки в `<Stepper>` (опц).
- Контраст:
  - Оранжевый `#F97316` на белом — 3.42:1. Только AA Large (18px+ или 14px+ bold). **НЕ для body-текста.**
  - Оранжевый на neutral-900 — 5.1:1. Годится для label/caption.
  - Body-text = neutral-900 на neutral-0 = 17.5:1 ✓
- Screen readers: все иконки lucide с `aria-hidden` если только декор; с `aria-label` если кнопка-иконка.

---

## 9. Brand assets checklist

### 9.1. Уже получено из брендбука (`Чирков и партнеры/Логотип/`)

| Путь в BP | Источник | Применение |
|---|---|---|
| `frontend/public/brand/logo-full-dark.png` | `LOGO/1.png` | Горизонтальный лого (тёмный на светлом) — admin header, Stage 4 DOCX footer, email-шаблоны |
| `frontend/public/brand/logo-icon-dark.png` | `LOGO/15.png` | Только иконка (коза + кружка, тёмный) — collapsed sidebar, mobile, favicon sync |
| `frontend/public/brand/logo-icon-outline.png` | `LOGO/19.png` | Альтернативная иконка с меньшим trim — loading-states |
| `frontend/public/brand/logo-emblem-dark.png` | `LOGO/8.png` | Круглый эмблема-штамп (тёмный на светлом) — печать «approved», достижения |
| `frontend/public/brand/logo-emblem-light.png` | `LOGO/18.png` | Круглый эмблема (белый на тёмном) — sidebar collapsed альтернатива, stickers |
| `frontend/public/brand/logo-white.png` (существующий) | legacy | Оставляем как fallback; в sidebar применяется CSS `filter: invert(1) brightness(1.15)` к `logo-full-dark.png` |
| `frontend/public/fonts/IBMPlexMono-*.ttf` | `FONTS/IBM_Plex_Mono/` | @font-face в `index.css`, 5 вариантов (Light/Regular/Medium/SemiBold/Bold) |

### 9.2. ЗАПРЕЩЕНО использовать

- `LOGO/3.png`, `LOGO/4.png`, `LOGO/5.png`, `LOGO/10.png`, `LOGO/11.png` — содержат tagline «системный консалтинг, блять!». **Мат запрещён** (апдейт 2026-04-18: «мы изменились»).
- Фото-бутылки с подписью «ГДЕ ТЫ УЧИЛСЯ, Я ПРЕПОДАВАЛ» — допустимо только внутри рекламных носителей ЧиП, НЕ внутри BP (корпоративный tone-of-voice маркетолог-клиентов).

### 9.3. Нужно от пользователя (Post-MVP)

| Asset | Использование | Приоритет |
|---|---|---|
| `og-image-1200x630.png` | social preview при шаринге ссылок | P2 |
| `favicon-512.png` | PWA/retina | P2 |
| `pattern-bg-dark.svg` | опциональный орнамент на login dark-panel | P3 |
| Иллюстрации-сцены (Оля в процессе, собственник одобряет, архив проектов) | `<EmptyState>` картинки вместо lucide-icons | P3 |
| Вариант лого с новым (без мата) tagline | альтернатива `logo-full-dark.png` с акцентной фразой под ним | P2 |
| `logo-full-white.png` (родной белый без tagline) | замена CSS-filter на настоящий asset | P1 |

---

## 10. Tone-of-voice 2026

**Апдейт от пользователя (18 апреля 2026): «мат запрещён, мы изменились».**

### 10.1. Запреты

- Обсценная лексика любой формы (включая замаскированные варианты вида `бл*ть`, `бля`).
- Пренебрежительный тон в отношении клиента-маркетолога («дурачок», «не понимаешь»).
- Сленг «душного» B2C («бомбит», «огонь», «топчик»).
- Англицизмы без русского эквивалента («кейс» ok, «кейсить» нет).

### 10.2. Разрешено / поощряется

- **Прямая речь.** «Собственник ждёт ответа» лучше, чем «Рекомендуем обратить внимание на статус запроса».
- **Короткие фразы.** Empty states ≤ 12 слов, hints ≤ 15.
- **«Вы» вместо «ты».** Обращение уважительное.
- **Моноширинные числа** в UI (Plex Mono) — отсылает к брендбуку.
- **Humor sparingly.** Одна шутка в пустом состоянии — ok. На Stage 2 (серьёзная сессия) — нет.

### 10.3. Примеры замены

| Было | Стало |
|---|---|
| «Короче, тут надо заполнить портрет» | «Начнём с портрета клиента. 6 вопросов.» |
| «Ничего не сделано» | «У вас пока нет проектов. Проджект ЧиП заведёт первый после вводного звонка.» |
| «Залетай в wizard» | «Перейти к wizard» |
| «Тебя ждёт собственник» | «Собственник ждёт вашего ответа по 3 ценностям.» |

---

## 11. Roadmap и verification

### 11.1. MVP (в этой задаче)

1. ✅ Копирование брендовых ассетов (logo×5 + IBM Plex Mono×5)
2. ⏳ Design tokens в `index.css`
3. ⏳ Compound-primitives: Button, Card, Input, Badge, EmptyState, Stepper, Tabs, Modal, Tooltip, Breadcrumbs, DiffBlock, SuggestionMark
4. ⏳ Редизайн 4 категорий экранов (Login+Layout+Sidebar, Dashboard, Wizard 1-4, Approvals+Admin)

### 11.2. Post-MVP

- Иллюстрации вместо lucide-icons в EmptyState
- og-image + pattern-bg (P2-P3 из §9.3)
- Storybook для примитивов
- Dark theme
- i18n (EN) — только после 5+ клиентов с международным scope

### 11.3. Verification gates

**Автоматические:**
```bash
cd frontend && npx tsc --noEmit                           # 0 errors
cd frontend && npm run build && ls dist/index.html        # successful bundle

# Constraint audit (must be empty или явно allowed):
grep -rE "(blue|purple|indigo|violet)-[0-9]" frontend/src/ | grep -v 'admin/' 
grep -rE "from 'react-icons|heroicons|feather'" frontend/src/
grep -rE "rounded-(xl|3xl|full)" frontend/src/ | grep -i button
grep -rE "shadow-(sm|md|lg|xl|2xl)" frontend/src/ | grep -vi "admin\|modal\|dropdown"
```

**Ручная проверка (чек-лист CLAUDE.md hard-constraints):**
- [ ] Sidebar `bg-neutral-900`, width 240/64 inline style
- [ ] Login split 40/60 (dark/white)
- [ ] Logout только в sidebar
- [ ] Header = только заголовок + `<Bell>` (никакого dropdown имени)
- [ ] Кнопки `rounded-lg`, карточки `rounded-2xl` без тени (кроме `<Card elevated>` в admin)
- [ ] Шрифты: Inter + IBM Plex Mono. Нет Roboto/Poppins/Montserrat
- [ ] Иконки: lucide-react. Нет heroicons/feather
- [ ] Primary `#F97316`. Нет purple/blue вне admin observability
- [ ] Все list-pages имеют `<EmptyState>`
- [ ] Мат отсутствует в UI-текстах и в импортируемых assets

**User-test (финальный gate, вне этой задачи):**
- Оля проходит Stage 1 онбординг ≤5 минут без технических вопросов
- Собственник одобряет документ ≤2 минуты с первого входа
- chip_admin закрывает silent failure ≤30 секунд
- NPS от Оли ≥ 8/10

---

## Summary table — что где живёт

| Вопрос | Ответ |
|---|---|
| Фирменная палитра | §2.1 — `#FEFEFE` + `#2B2A29` brand, `#F97316` accent |
| Шрифты | §2.2 — Inter (body) + IBM Plex Mono (display/numbers) |
| Radius кнопок / карточек | §2.4 — `rounded-lg` / `rounded-2xl` |
| Где компоненты | §3 — `frontend/src/components/ui/` |
| Layout каждого экрана | §4 |
| Что в sidebar | §5.1 |
| Motion rules | §7 |
| A11y | §8 |
| Какие лого использовать | §9.1 |
| Tone-of-voice | §10 |
| Verification | §11.3 |
