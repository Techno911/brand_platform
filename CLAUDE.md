# CLAUDE.md — Brand Platform (BP) project invariants

> Локальный конфиг проекта. Дополняет [глобальный ~/.claude/CLAUDE.md](../../../.claude/CLAUDE.md).
> Claude Code читает этот файл автоматически. Не удалять.

---

## Принципы (не переписывать, основа продукта)

- **Moat BP = методология + library отраслей, не код и не вендор LLM.** Любой рефакторинг ради красоты запрещён. Методологический слой (`prompts/`, `knowledge/`, `golden-set/`) — главная ценность; код и LLM-вендор инструментальны.
- **Claude = черновик, человек = утверждение.** Ни один артефакт не публикуется без `owner_viewer.approved_by`. Это архитектурный инвариант, не рекомендация UX.
- **Judgment-heavy делегировать нельзя, intelligence-heavy — можно.** Архетип/позиционирование выбирает человек; черновики и критика — LLM. UI не должен создавать иллюзию «AI решил архетип».
- **Reseller-модель.** API-ключи вендоров (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_COMPAT_API_KEY`) только в env сервера Чиркова. Клиенты не видят ключей, не заводят свои, не знают о промпт-воронке.
- **Linear wizard, не автономный агент.** Порядок 4 стадий зашит блокировкой, каждая стадия DoD-gated. (См. `docs/ADR/0002-no-low-code-wizard-builder.md`.)
- **Multi-vendor LLM (антихрупкость).** Anthropic primary, OpenAI secondary, DeepSeek/Qwen/GLM tertiary — все три сконфигурированы одновременно. Автоматический fallback при auth/transient/content_filter. Per-stage политика: judgment-heavy → primary, judge/classify/sanity → tertiary. Запрещены только self-hosted / Ollama (см. `docs/ADR/0001-multi-vendor-llm.md`).

---

## Стек (фиксировано глобальным CLAUDE.md, не менять)

- Backend: NestJS 10 + TypeScript 5 + TypeORM + PostgreSQL 16
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS v4 + Zustand
- Auth: JWT (access 15m + refresh 7d) + bcryptjs
- Icons: lucide-react only
- Font: Inter
- AI: multi-vendor через `LLMProvider` interface
  - Anthropic: `@anthropic-ai/sdk` (primary, `claude-opus-4-7` / `claude-haiku-4`)
  - OpenAI: native fetch (secondary, `gpt-4.1` / `gpt-4.1-mini`)
  - OpenAI-compat: native fetch (tertiary, `deepseek-chat` / `qwen3-max` / `glm-4.6`)
- LLM control plane: `VendorRouter` + `GlobalLLMQueue` (per-vendor RPM/TPM bucket) + `ProjectBusyService` (pg_try_advisory_xact_lock)
- Containers: Docker Compose, `bp-postgres` / `bp-backend` / `bp-frontend` / `bp-docx-exporter`

---

## 6 slash-команд (промпт-шаблоны в `backend/src/prompts/`)

Каждая команда — markdown-файл с YAML-frontmatter:

| Команда | Файл | Стадия |
|---|---|---|
| `/interview-patterns` | `prompts/interview_patterns.md` | 1 |
| `/review-classify` | `prompts/review_classify.md` | 1 |
| `/values-draft` | `prompts/values_draft.md` | 2→3 |
| `/legend-draft` | `prompts/legend_draft.md` | 2 |
| `/mission-variants` | `prompts/mission_variants.md` | 2 |
| `/positioning-draft` | `prompts/positioning_draft.md` | 3 |
| `/message-variants` | `prompts/message_variants.md` | 3 |

Плюс вспомогательные:
- `/critique-message` (3 критика, 3 итерации) — `prompts/critique_message.md`
- `/challenge-owner-response` (thinking partner) — `prompts/challenge_owner_response.md`
- `/plan-mode-15q` (15 уточняющих вопросов по одному) — `prompts/plan_mode_15q.md`
- `/methodology-compliance-check` (LLM-judge на канон 3.1) — `prompts/methodology_compliance_check.md`

---

## Retention и audit

- **debug-логи промптов:** 14 дней, доступ `chip_admin`. PII-pre-screened.
- **`prompt_run` таблица:** бессрочно (метрики + cost), PII-чистая.
- **`audit_events`:** бессрочно, AES-256-GCM на rest.
- **`Approval` + immutable snapshots S3:** 7 лет object-lock.
- **`security_events`:** бессрочно (prompt injection detections, tool-call rejections, PII warnings).

---

## Observability

- **Grafana dashboards** читают `prompt_run` + `audit_events`.
- **Telegram-бот `chip_admin`** (Post-MVP) — нотификации на `error_code`, `BUDGET_EXCEEDED`, `prompt_injection_detected`, `golden_set_regression`.
- **Silent failures dashboard** — Горшков паттерн: все запросы / стоимость / ошибки / зависания в одном месте.

---

## Безопасность (подробно в PLAN.md §8)

- `BriefSanitizerService` **до** первого LLM-вызова каждой стадии (vendor-agnostic). Prompt injection = TOP-1 уязвимость LLM.
- Whitelist tool-names: `draft_value`, `generate_mission`, `classify_message`, `generate_positioning`, `critique_message`, `challenge_owner_response`. Whitelist применяется к ответам от ЛЮБОГО вендора (fallback на OpenAI/DeepSeek НЕ расширяет tool surface).
- `max_agent_roundtrips_per_stage = 5`.
- `ProjectBusyService` — `pg_try_advisory_xact_lock(hash(projectId))`: два параллельных AI-вызова в рамках одного проекта запрещены (409 `PROJECT_BUSY`). Причина методологическая: миссия строится на основе утверждённых ценностей, race condition недопустим.
- `GlobalLLMQueueService` — per-vendor token-bucket (RPM/TPM rolling 60s) + global concurrency cap. Защита от burst'а когда 10+ маркетологов одновременно.
- `docx-exporter` — отдельный Docker-контейнер `read_only: true`, tmpfs `/tmp/export-*`.
- `gitleaks` pre-commit на `prompts/*.md` и `backend/.env*` (защищает все три вендорских ключа).
- Semgrep SAST + OWASP ZAP DAST в CI.

---

## Запрещено (hard)

- **Self-hosted LLM (Ollama, local Llama, собственный GPU-кластер)** — противоречит reseller-модели и не окупается на 10-30 клиентах. Multi-vendor API (Anthropic/OpenAI/DeepSeek/Qwen/GLM) — разрешено и настраивается через env; self-host — нет.
- **Low-code wizard builder** — линейный порядок 4 стадий зашит в код. Кастомизация под индустрию = `industry_context/`, не структура wizard'а. См. `docs/ADR/0002`.
- Claude Computer Use — BP = API, не автоматизация десктопа.
- Paperclip / AgentTeams оркестрация — у нас linear wizard.
- Notion/Slack/Google Docs MCP в backend — только vendor LLM API (Anthropic/OpenAI/compat).
- «Маркетинг в одну кнопку» self-service — BP = 8-12 дней с человеком.
- Vibe-coded CRM — у Чиркова 10-30 клиентов, не окупается.
- Паспортная/карточная PII в промптах — `BriefSanitizerService` фильтрует (vendor-agnostic).
- Изменение промпта без прогона golden set (CI блокирует; golden set — per-vendor пара).
- AI-действие без `generated_by` (`${vendor}:${model}`) / `modified_by` / `approved_by` в `audit_events`.
- Vision-вызовы на каждый запрос (только `/review-classify` на скриншотах отзывов, на primary провайдере).
- Добавление 4-й роли в RBAC — см. `docs/RBAC.md`. 3 роли (`chip_admin` global, `marketer` per-project, `owner_viewer` per-project) зафиксированы.

---

## Проверки перед коммитом (обязательно)

```bash
cd backend && npx tsc --noEmit   # 0 ошибок
cd frontend && npx tsc --noEmit  # 0 ошибок
cd backend && npm run test:golden-set  # регрессия <15%
```

---

## Версионирование — ЖЁСТКОЕ ПРАВИЛО

**После КАЖДОГО изменения кода (frontend или backend) обязательно бампать версию. Не рекомендация — hard rule.**

Версия живёт в трёх местах, все три должны обновляться синхронно:

1. `frontend/src/config/platform.ts` → `PLATFORM.version` — **user-visible** (печатается на login-странице под заголовком; маркетолог/собственник/админ видит её каждый раз при входе). Схема: `vМажор.Минор.Патч`. Каждая часть ОДНОЗНАЧНАЯ (0..9), при переполнении каскадирует выше: v3.4.9 → v3.5.0 → v3.5.1 ... → v3.9.9 → v4.0.0. «Трёхзначная» в терминологии автора платформы = версия из трёх частей (x.x.x), а не «патч может быть многоразрядным» — это уточнение было ошибкой Claude 2026-04-19 и откачено. Мажор = смена методологии. Минор = новый канон на стадии. Патч = обычный build-bump.
2. `frontend/package.json` → `version` — semver.
3. `backend/package.json` → `version` — semver, синхронно с frontend.

**Автоматизация.** `frontend/package.json` → `build` скрипт: `node scripts/bump-version.mjs && tsc --noEmit && vite build`. То есть `npm run build` во фронте делает bump автоматически. После любой правки во фронте достаточно запустить `cd frontend && npm run build` — скрипт инкрементит и platform.ts, и package.json.

**Backend `package.json` бампается вручную** (нет аналогичного скрипта). Для patch-бампа: `cd backend && npm version patch --no-git-tag-version`.

**Sanity-check перед коммитом:**

```bash
grep '"version"' frontend/package.json backend/package.json
grep "version:" frontend/src/config/platform.ts
# Три строки должны показывать свежую версию, не ту же что была в HEAD.
```

Если забыл бампнуть — это блокер к коммиту. Откат к HEAD, bump, пересборка, тогда коммит.

**Почему hard rule:** пользователь входит на страницу, видит ту же версию что вчера, и делает вывод «ничего не изменилось → зачем я тебя просил». Теряется доверие к тому что правки вообще применяются. Версия на login — индикатор прогресса, а не декорация.

---

## Работа над ошибками (живой журнал, пополнять после каждой сессии)

> Сюда пишутся **конкретные грабли** на которые наступила эта сессия и правило, чтобы следующая на них не наступила. Формат: `## Дата — краткое имя ошибки` → что произошло → почему произошло → правило на будущее.

### 2026-04-20 — Четыре бага на Стадии 2: gate-locked + верстка-overflow + Values/Mission shape-mismatch (v3.5.8)

**Что произошло.** Артём (chip_admin) надел маркетологовы тапки — залогинился как `olya@chirkov-bp.ru` и прошёл CJM-сценарий Стадии 2. Нашёл 4 регресса за один заход:

1. **«Почему у меня стадия 2 закрыта?»** — Стадия 1 утверждена, интервью все в БД, черновик паттернов — есть, но pill «Стадия 2» в Wizard-shell'е заблокирован. Возврат в аккаунт → кликаю «Стадия 2» → locked. Методологический смысл: cross-check Стадии 1 уже пройден, следующая стадия обязана быть открыта.
2. **«Что с версткой? Почему текст вылезает из карточки?»** — На всех 4 табах Стадии 2 (Вызов/Легенда/Ценности/Миссия) заголовок `Card.Title` вытек за пределы `Card` справа, обрезался многоточием или проезжал под иконку колокольчика в header'е. Типичный flex-child-overflow баг, но проявился сразу после бамп-версии → Артём справедливо заметил.
3. **«Нажал сгенерировать черновик ценности — пусто!»** — После нажатия «Сгенерировать» AI отработал (в `/tmp/bp-backend.log` видно `{status:'ok', costUsd:0.04, latencyMs:9210}`), но фронт показал жёлтый бейдж «Сработал запасной план (low budget)» + `FallbackText` с «Пусто.». То есть успешный ответ Claude отрисовался как degraded-fallback — это методологическая ложь маркетологу.
4. **«Сразу на будущее проверь миссию — там сто пудов будет опять ошибка»** — Проактивная проверка. Действительно: таб «Миссия» после генерации показал 3 карточки вариантов, но в каждой вместо текста миссии стояло «—», а все 9 ScoreBar (3 варианта × 3 метрики) были равномерно заполнены на 100%. Методологическая ценность вариантов = 0 (нельзя выбрать «более ясную» если все 100% ясные).

**Корневая причина.** Четыре независимых корня, два из которых — повторы классов, уже задокументированных в этом журнале:

1. **Stage-gate increment class (НОВЫЙ).** `Stage1Service.finalizeStage1()` ставил `row.finalized + row.status='completed'` и на этом заканчивался. Но `WizardShell.tsx:75` читает `maxAccessibleStage = Math.max(project.currentStage, stage)` — значит решающее поле для pill-гейта это `project.currentStage`, а не наличие finalized-row. «Утверждаю Стадию 1» != «инкрементирую `currentStage`» → 3 проекта (Белая Линия, КДМ, Холст) оказались в rotten-state: Stage 1 закрыта, но открыть Stage 2 невозможно.

2. **Tailwind v4 + flex-child overflow (НОВЫЙ класс для этого проекта).** Card.Header имел `<div className="flex items-start gap-2">` (без `min-w-0`), внутри title-контейнер не имел `min-w-0 flex-1`, а `Card.Title` в UI-ките содержит hardcoded `whitespace-nowrap overflow-hidden text-ellipsis`. Три сливающиеся проблемы: (i) flex-child без `min-w-0` НЕ сжимается даже при `overflow:hidden` у родителя — это CSS-инвариант, а не баг Tailwind; (ii) Tailwind v4 JIT не гарантирует порядок утилит, когда две задают одно и то же свойство (`whitespace-normal` vs `whitespace-nowrap`); (iii) `!` префикс нужен для форсированного override внутри темы — без него утилита из UI-кита выигрывала.

3. **Shape-mismatch (ПОВТОР класса 2026-04-19 Stage 4).** `Stage2Page.tsx` делал `http.post<AIResult>(ENDPOINT[active], {...})` и читал `res.data.status !== 'ok'` → включал degraded-fallback. Но backend endpoint'ы `/wizard/stage-2/legend` / `/values` / `/mission` возвращают envelope `{row, ai: AIInvokeResult}`, где `ai.ok: true` и `row.payload.draft: {…}`. Фронт читал `res.data.status` → `undefined !== 'ok'` → true → «Сработал запасной план». Класс уже описан в записи 2026-04-19 «Stage 4 silent-failure» — и повторился на Stage 2 потому что я не прошёл превентивно по всем стадиям wizard'а.

4. **Schema-drift (ПОВТОР класса 2026-04-20 Raw JSON в Canvas), развёрнутый на Values и Mission.** Claude на `/values-draft` возвращает `manifestations: ["Первичный приём длится не меньше 40 минут", "Прозрачное ценообразование без скрытых позиций"]` — **массив строк**, а не `{context, action}[]`. `ValueCard` ожидал объектов, делал `m.context` → undefined → `m.action ?? '—'` → рендерил «—» × N. Аналогично Mission: Claude возвращает ПЛОСКИЙ объект `{mission, action_verb, target, outcome, clarity:5, uniqueness:4, actionability:4}`, а `MissionVariant` тип ожидал `{text, scoring: {clarity, uniqueness, actionability}}` + 0-1 scale. Симптомы: `variant.text` undefined → «—»; `ScoreBar` получал `value=5`, clamp'ил `min(1, 5) = 1` → 100% для всех вариантов и метрик. Differentiated score — ключевая методологическая точка при выборе миссии; клампинг до 100% её стирает.

**Что починил.**
- `backend/src/wizard/stages/stage-1.service.ts`: импорт `Project` + `LessThan` из typeorm; `@InjectRepository(Project) projects: Repository<Project>` в конструктор; `finalizeStage1()` после `row.save()` делает `this.projects.update({id: projectId, currentStage: LessThan(2)}, {currentStage: 2})`. `LessThan(2)` — чтобы не откатывать currentStage у проекта, который уже продвинулся на 3 или 4 (редкий сценарий пере-утверждения Стадии 1, но технически возможный). Одноразовый heal через psql: `UPDATE projects SET current_stage = 2 WHERE id IN (SELECT DISTINCT project_id FROM rows WHERE sheet = 1 AND finalized IS NOT NULL) AND current_stage < 2` — обновил 3 застрявших проекта без TypeORM-миграции.
- `frontend/src/pages/wizard/Stage2Page.tsx`: (a) Card.Header rewrite — `<div className="flex items-start gap-2 min-w-0 w-full"><Icon className="flex-shrink-0"/><div className="min-w-0 flex-1"><Card.Title className="!whitespace-normal !overflow-visible">{…}</Card.Title></div></div>`; (b) `Stage2Envelope` type + `normalizeAI()` helper + явная сборка `AIResult` из envelope перед `updateBlock`; (c) `translateRejectReason()` дублирован из `Stage1Page.tsx` (10 кодов: `roundtrip_limit_hit`, `BUDGET_EXCEEDED`, `DAILY_CAP_EXCEEDED`, `PROJECT_BUSY`, `no_vendor_available`, `tool_not_whitelisted`, `llm_failed:*`).
- `frontend/src/pages/wizard/Stage2DraftView.tsx`: (a) `ValueItem.manifestations: Array<string | ValueManifestation>` + ValueCard `typeof m === 'string' ? <span>{m}</span> : <span>{m.context}: {m.action ?? '—'}</span>` branch; (b) `MissionVariant` расширен плоскими полями Claude-reality (`mission`, `action_verb`, `target`, `outcome`, `clarity`, `uniqueness`, `actionability`); (c) `displayText = variant.text ?? variant.mission ?? '—'`; (d) `ScoreBar` нормализует `value > 1 ? value / 5 : value` — это поддерживает оба формата (0-1 от старого промпта и 1-5 от нового Claude).

**Верификация Preview MCP (olya@chirkov-bp.ru):** Стадия 2 теперь доступна через pill (h1 «Стадия 2. Сессия с собственником» рендерится). CSS: `getComputedStyle(h3).whiteSpace === 'normal'`, `overflow === 'visible'`, заголовок wraps в 2 строки внутри границ карточки. Values: 10 manifestations отрендерено, 0 «—» fallback'ов (примеры: «Первичный приём длится не меньше 40 минут», «Прозрачное ценообразование без скрытых позиций» — Белая Линия стоматология). Mission: 3 варианта с дифференцированными score'ами (Variant 1: 100/80/80, Variant 2: 100/100/80, Variant 3: 80/80/100) — подтверждает что 1-5 → 0-1 нормализация работает. Легенда: `sectionsRendered = ['Точка старта', 'Поворотные даты']`.

**Правило.**
(a) **Stage-finalize = `row.status='completed'` + `row.finalized={...}` + `project.currentStage = stage+1` ОДНОВРЕМЕННО.** Инвариант: любая кнопка «Утвердить и перейти к Стадии N+1» должна пройти ВСЕ три шага в одной транзакции. Если на UI кнопка «перейти» есть, а инкремента currentStage нет — pill-гейт заблокирован, и маркетолог сидит в rotten-state'е пока кто-то не пролечит psql'ом. Каждая следующая finalize-ручка (Stage 2, 3, 4 → «На одобрение собственника») обязана следовать этому паттерну превентивно.
(b) **Tailwind v4 + flex-child: `min-w-0` на wrapper + `!` префикс на override утилит.** Это НЕ баг Tailwind, это CSS-инвариант: flex-child с content больше flex-basis требует `min-width:0` чтобы сжаться. Забыл — получил overflow. Плюс когда перекрываешь утилиту из UI-кита (Card.Title, Button variant, etc.), всегда через `!` префикс — порядок утилит в Tailwind v4 не гарантируется, `class="whitespace-normal whitespace-nowrap"` может дать любой из двух.
(c) **Shape-mismatch класс повторился на Stage 2 потому что я не прошёл превентивно после Stage 4.** Запись 2026-04-19 уже формулировала правило: «backend-контракт endpoint'а, который возвращает envelope, никогда не типизировать на фронте как одиночный AIResult». Но я закрыл правило ТОЛЬКО на Stage 4 и не прогнал остальные стадии. Урок: когда в журнале появляется «(повтор класса)», это не констатация — это зов к превентивному обходу ВСЕХ мест где класс может повториться. Сейчас: проверить Stage 3 `Stage3Page.tsx` + Stage 4 (уже проверен) на envelope-типизацию перед следующей сессией.
(d) **Schema-drift у Claude: union-тип в каждом `*DraftView` для КАЖДОЙ вложенной структуры, не только верхнего уровня.** Запись 2026-04-20 (LegendData) формулировала правило для `LegendData`, но я не распространил его на `ValueItem.manifestations` (вложенный массив) и `MissionVariant` (полностью плоский формат). Правило расширяется: union-тип обязателен не только для root-data, но и для каждого вложенного поля которое Claude может вернуть в 2+ формах — и для каждого numeric-scale поля обязательна явная нормализация (0-1 vs 1-5 vs 1-10), потому что LLM может выдать любой из распространённых диапазонов, а UI компонент обязан отображать консистентно.

### 2026-04-20 — Raw JSON в Canvas: тройной слой schema-дрейфа + string-as-object баг

**Что произошло.** Сразу после предыдущего фикса persistence (см. запись ниже) Артём кликнул на уже утверждённый таб «Легенда» и увидел в CanvasCard **сырой JSON-дамп** вместо структурного рендера: `{"legend":{"founder":{"name":"Анна","role":"основательница"},"milestones":[{"date":"2019","fact":"..."}],...,"turning_point":"После списания..."}}`. То есть persistence'а починил, а rendering — не починил. Маркетолог / собственник видит техно-мусор на финальном экране стадии. Артём: «Ремонтируй».

**Корневая причина.** Три слоя, все три надо закрыть одновременно, иначе баг возвращается:
1. **Backend хранил draft строкой.** `Stage2Service.draftLegend/Values/Mission` делали `draft: r.text ?? r.json` — AIService возвращает сырой JSON-ответ Claude И в `text` (raw string) И в `json` (распарсенный объект). `??`-приоритет отдавал text'у → в `rows.payload.draft` оседала **строка**. Frontend `LegendView` гвардит `if (!isObject(data)) return <FallbackText>` и `FallbackText` при `isNonEmptyString` рендерит голый текст. Получается: Claude отдал объект → AIService распарсил → мы намеренно сохранили в строку → фронт отказался его разбирать.
2. **Frontend не пытался decode'нуть.** `toBlockState` в `Stage2Page` делал `json: s.draft` напрямую, без проверки-парсинга. Старые записи в БД (до фикса слоя 1) остались бы строками навсегда и продолжили бы рендериться сырым JSON'ом даже после бэкенд-фикса.
3. **Schema-drift между промптом и реальностью Claude.** `legend-draft.md` в `expectedOutputSchema` просит `{origin: {founder_name, founder_role}, milestones: [{year, event, why_matters}], turning_point: {year, event, before, after}}`. Claude реально возвращает `{founder: {name, role}, milestones: [{date, fact}], turning_point: <string>}` + кладёт warnings/unverified_claims ВНУТРИ `legend`, а не снаружи. `LegendView` знал только expected-форму → даже при правильно распарсенном объекте деструктурировал пустоту и рисовал голый каркас или падал в FallbackText.

**Что починил.**
- `backend/src/wizard/stages/stage-2.service.ts`: во всех трёх draft-методах `r.text ?? r.json` → `r.json ?? r.text`. Object first, string только как последняя надежда (когда Claude выдал нераспарсиваемый JSON).
- `frontend/src/pages/wizard/Stage2Page.tsx` → `toBlockState`: defensive decode. Если `s.draft` — строка и выглядит как JSON (`{` / `[`) — пробуем `JSON.parse`. Успех → `result.json = parsed`. Неудача или не-JSON строка → `result.text = trimmed, json = null`. Старые записи в БД чинятся на возврате без миграции.
- `frontend/src/pages/wizard/Stage2DraftView.tsx` → `LegendData` принимает два варианта milestone-полей (`{year, event, why_matters}` И `{date, fact}`); `turning_point` может быть строкой ИЛИ объектом (два render-ветки); `founder` добавлен на верхнем уровне `legend` (короткая форма рядом с `origin`); `warnings` и `unverified_claims` читаются из двух мест (снаружи `legend` и внутри) с объединением через `Set` для дедупликации.

**Верификация Preview MCP:** логин `olya@chirkov-bp.ru`, Stage 2 → Легенда. На возврате `sectionsRendered = ['Точка старта', 'Поворотные даты', 'Перелом', 'Утверждения без источника', 'Подсказки по текущему шагу']`; `milestonesCount = 4`; `hasRawJSON = false`; `hasSectionTitles = true`. Screenshot подтвердил что «Точка старта» рендерится с чипом founder-имени, milestones в timeline'е, turning_point как абзац-строка, unverified_claims как список с warning-иконками.

**Правило.**
(a) **Draft/artifact/snapshot в БД обязан храниться как JSON-объект, а не как string.** Приоритет `r.json`, `r.text` только когда парсинг не удался (редкий edge-case). Исключение — если артефакт по смыслу строка (markdown-текст, plain-text от owner'а). JSON → object; object → rendered structure. Строка в БД == `<pre>` на фронте == UX-ад.
(b) **Любой fronted-рендер, ожидающий JSON, обязан иметь defensive decode (`JSON.parse` в try/catch) при восстановлении из persistence.** Даже если backend «теперь правильно хранит объекты» — legacy-записи в БД никто не мигрировал. Defensive decode == миграция-на-чтении (lazy migration), работает без downtime.
(c) **Каждый `<SomethingDraftView>` обязан принимать минимум ДВА варианта schema — ожидаемую промптом И реально выдаваемую Claude.** LLM не соблюдает `expectedOutputSchema` в 100% случаев — он дрейфует (сокращает `founder_name` до `founder.name`, заменяет объект на строку). Не пытайся заставить промпт соблюсти schema (это гонка за ветром — Claude меняет outputs от запроса к запросу). Укрепи РЕНДЕР: две формы, union-тип, fallback в оба бренча. Альтернатива — golden-set на точный JSON-shape, но для живого wizard'а это слишком хрупко.
(d) **После любого persistence-фикса обязательно прогнать RENDER CanvasCard'а (не только «accepted-мигает»).** Previous session закрыла persistence и не посмотрела, КАК draft выглядит при возврате — потому что на тот момент draft уже был объектом в тестовом сценарии. Живой Claude-прогон через 10 минут вернул text, и баг проявился. Итог: «state сохранился» ≠ «state рендерится» — это две разных проверки, обе обязательны.

### 2026-04-20 — State-not-persisted class: Stage 1/2 пустые после возврата

**Что произошло.** Артём под маркетологом: «Я под маркетологом нахожусь на стадии 2, и там вижу подсказки о том, что можно вернуться на стадию 1 и там взять. Я нажимаю на стадию 1, и у меня полностью пустая стадия 1. То есть, мне что, теперь опять все заново начинать? Это капец! Как ты такое допустил? Исправляй.» И второй симптом там же: «Заполнил я стадию 2… нажал сгенерировать черновик легенды, потом нажал там "принять", она обновилась, и ничего не изменилось. Я просто также и застрял на второй стадии, ничего дальше не произошло». То есть wizard терял contract «я вернусь и продолжу с того же места» в ДВУХ стадиях одновременно, причём Stage 2 accept был dead-end ещё с записи 2026-04-19 («dead-end after approval») — значит предыдущий фикс закрыл UX (next-step CTA), но не устранил корень (server-side persistence).

**Корневая причина.** Класс ошибок «state живёт только в React useState». Три слоя:
1. **Stage 1.** `runInterviewPatterns()` сохранял `{raw, patterns}` в `rows.payload` — БЕКЕНД В ПОРЯДКЕ. Но у Stage 1 не было GET-endpoint'а вроде `/wizard/stage-1/state`, а на фронте не было useEffect, который бы при монтировании страницы подтянул сохранённую строку. После навигации `useState` пустел — маркетолог видел девственную стадию.
2. **Stage 2 textarea.** `draftLegend/draftValues/missionVariants` сохраняли только `{draft}` / `{variants}` в payload, БЕЗ `ownerText`. То есть черновик был в БД, а исходный текст маркетолога (который он вставил в Textarea перед генерацией) — нет. На возврате восстановить форму было физически нечем.
3. **Stage 2 accept.** Флаг `accepted` жил исключительно на фронте (`blocks[block].accepted` в `useState`). Нажал «Принять» — UI моргнул, перезагрузил — флага нет. Плюс нет visible-event'а: переход на следующий таб был единственным сигналом, который Артём пропустил глазами (таб сверху, глаза ниже на карточке).

**Что починил.**
- `backend/src/wizard/stages/stage-1.service.ts` → `getState(projectId)`: читает latest `row` со `sheet=1, type='interview'`, возвращает `{transcript, patterns, isFinalized}`. Берёт `row.finalized ?? payload.patterns` — то есть если маркетолог уже утвердил (finalized), отдаём утверждённую версию, иначе — последний draft.
- `backend/src/wizard/stages/stage-2.service.ts` → (a) три draft-метода теперь кладут `ownerText: ownerTranscript` в payload; (b) новый `acceptBlock(projectId, block)` ставит `row.status='completed' + row.finalized=draft` — это персистентная версия прежнего frontend-флага; (c) `reopenBlock(projectId, block)` — откат в `'planned'` + `finalized=null`; (d) `getState(projectId)` собирает снапшот всех трёх блоков (legend/values/mission) с `{text, draft, accepted}`.
- `backend/src/wizard/wizard.controller.ts` → 4 новых endpoint'а: `GET /wizard/stage-1/state`, `POST /wizard/stage-2/accept-block`, `POST /wizard/stage-2/reopen-block`, `GET /wizard/stage-2/state`. Роли: writes — chip_admin/tracker/marketer, reads дополнительно owner_viewer.
- `frontend/src/pages/wizard/Stage1Page.tsx` → useEffect на монтирование: fetch state, split transcript по маркерам `### ИНТЕРВЬЮ N` обратно в слоты, синтезировать `AIInvokeResult<InterviewPatterns>` из сохранённых patterns для CanvasView.
- `frontend/src/pages/wizard/Stage2Page.tsx` → (a) useEffect + `toBlockState()` helper который синтезирует AIResult из сохранённого draft; (b) `accept()` теперь async, POST'ит `/wizard/stage-2/accept-block` перед локальным setState — и падает (показывает error + return) если backend вернул ошибку; (c) новый `AcceptToast` компонент (fixed top-center, белая карточка с зелёной рамкой, 2.5s) — рендерит «„Легенда" утверждено маркетологом → переходим к „Ценности"» при accepting; (d) `reopen()` тоже POST'ит `/reopen-block`.

**Верификация (обязательная после этой ошибки — не «думаю что работает»):**
- Preview MCP: логин `olya@chirkov-bp.ru`, навигация `/projects/.../stage-2`, fill legend textarea, generate, accept → AcceptToast визуально сверкнул + активный таб переключился на «Ценности» + «Легенда» получила зелёный `CircleCheck` (lucide w-3.5 h-3.5 text-[#22C55E]).
- Навигация в Stage 1 → textareas не пусты (1163/1123/998 chars из seed-интервью).
- Навигация обратно в Stage 2 → `counter="1/4"`, Легенда имеет `hasSvg: true` (чекмарк), Ценности/Миссия — `hasSvg: false`. Перекликанье на таб Легенда → textarea восстановлена (710 chars), «Утверждено маркетологом» badge видим, кнопка «Вернуть на правки» есть, кнопки «Принять черновик» нет (корректно — блок уже accepted), «Пересгенерировать» disabled (корректно).

**Правило.**
(a) **Любое persistent UI-состояние (`accepted`, `finalized`, `signed_off`, selected-tab-которое-переживает-рефреш, restored-draft) ОБЯЗАНО жить в БД, а не во `useState` фронта.** Если хочешь новый булев флаг на UI — сначала спроектируй колонку / payload-поле / status-transition, потом пиши React-код. `useState` для persistent-флага = гарантированный bug при любой навигации.
(b) **Каждая wizard-стадия, которая принимает ввод маркетолога, обязана иметь пару endpoint'ов `mutate()` + `getState()`.** mutate сохраняет (уже делает — через createRow), getState читает и отдаёт форматированный снапшот для перерисовки фронта. Без getState — state живёт только в сессии вкладки, и это класс Stage-N-пустая-после-возврата.
(c) **Каждая frontend-страница wizard-стадии обязана иметь useEffect на `[id]`, который подтягивает state перед первым пользовательским вводом.** Лучше лишний GET с пустым ответом, чем один забытый GET в продакшене.
(d) **Action, который меняет persistent-состояние (например Accept), обязан показать visible-event НА ТОМ ЖЕ уровне экрана, где глаза пользователя сейчас.** Переход на следующий таб сверху — не visible-event для глаз у карточки. Toast, inline-badge, scroll-to-status — всё работает. «Изменилась только вкладка сверху» — не работает никогда.
(e) **Fix этого класса ОДНОВРЕМЕННО применяется ко всем 4 стадиям wizard'а — иначе regression вернётся через 2 сессии.** Stage 3 и Stage 4 в этой сессии не тронуты (вне scope запроса Артёма), но их нужно пройти превентивно той же пятёркой: есть ли persistent state? есть ли getState? есть ли useEffect на фронте? есть ли visible-event на accept? есть ли acceptBlock с row.status='completed'? Пока этого нет — запись открыта, класс не закрыт. Закроется только когда Stage 3/4 будут аналогично укреплены.

### 2026-04-19 — Stage 4 silent-failure: shape mismatch + HTTP 200 + пустой рендер

**Что произошло.** На CJM-прогоне Стадии 4 нажал «Прогнать 4 теста», back вернул HTTP 200 за 26 мс, TimeSavedChip отрисовался «Claude сделал черновик за 1 сек — сэкономил 4 ч» — и НИ ОДНОЙ test-card ниже. Кнопки «Утвердить финальный месседж» нет, ошибки нет, страница «как будто закэшировалась, но tests-гриды отсутствуют». Stage 4 — финальный экран перед подписью собственника и выгрузкой DOCX; зависание тут = клиент не получает бренд-книгу.

**Корневая причина.** Двухслойная, обе — варианты того самого silent-failure'а из записи про Stage 1 ниже:
1. **Shape mismatch.** Backend `Stage4Service.runAllTests()` делает `Promise.all` из 4 независимых `ai.invoke({kind:'review_classify'})` и возвращает `{test, result: AIInvokeResult}[]`. Frontend типизировал это как `AIResult` (одиночный результат) и читал `result.json?.tests as TestResult[]` — такого поля в массиве нет, `testResults` навсегда `undefined`, условный рендер test-card'ов не срабатывает.
2. **Четырёхкратный rejected без UI-перевода.** В реальном прогоне все 4 `review_classify` упали в `roundtrip_limit_hit` (5 tool-roundtrip'ов не хватило для LLM-judge'а над коротким месседжем). `ai.service.rejected()` честно WARN'ил каждую попытку в `/tmp/bp-backend.log`, но frontend ожидал одиночный `result` с `ok:false` — а получал массив из 4 ok:false и тихо игнорировал.

**Что починил.**
- `frontend/src/pages/wizard/Stage4Page.tsx`: новый тип `Stage4TestEnvelope = {test, result: AIInvokeResult<ReviewClassifyJson>}[]` — соответствует реальному бекенду. Маппинг в `TestResult[]` с `TEST_LABELS` (memorability/differentiation/claim-backing/emotional-hook → русские названия). `passed` = `r.ok && r.json?.traffic_light === 'green'` (раньше было бы `r.passed` — не существующее поле). `reasoning` собирается из `r.json.reasons ?? r.json.suggestions ?? r.text ?? fallback`.
- Убрал state `result` (AIResult одиночный), заменил на `testResults` (массив). Обновил пропсы `TestsView` + условный рендер `{testResults && …}` вместо `{result && …}`.
- Добавил `translateRejectReason()` — ту же таблицу что в `Stage1Page.tsx`. Перед маппингом проверяется `allRejected = rawTests.every(t => !t.result.ok)`: если да — показываю первую `rejectReason` в человекочитаемом виде («Claude упёрся в лимит итераций (5 roundtrip)…»), НЕ рисую 4 красные карточки (это методологическая ложь — «тест провален» vs «тест не состоялся»).

**Правило.**
(a) Backend-контракт endpoint'а, который возвращает массив (Promise.all), **никогда не типизировать на фронте как одиночный `AIResult`** — это гарантированное молчание при рендере. Перед использованием нового wizard-endpoint'а всегда смотрю сигнатуру NestJS-метода (`return this.stageX.method()` → что там за shape), а не угадываю «наверное такой же как у остальных».
(b) На любой CJM-странице, где юзер жмёт кнопку и ждёт содержательный результат (тесты/черновики/валидации), правило из Stage 1 распространяется **на каждый endpoint, возвращающий AIInvokeResult** — ветвить `ok:false`, переводить `rejectReason`, НЕ рисовать «успех + пусто». Это то же правило, просто повторенное для Stage 4 — и именно так, повторами на каждой стадии, мы боремся с классом, а не с отдельным случаем.
(c) CJM-прогон не заканчивается до тех пор, пока не пройдена ФИНАЛЬНАЯ стадия. Пропустить Stage 4 «потому что она короткая» = пропустить экран перед подписью собственника = пропустить риск провала в ключевой момент воронки (клиент не получает результат → доверие рушится).

### 2026-04-19 — Stage 3 antipattern parity: дубль-кнопка «Пересгенерировать» жила в двух местах

**Что произошло.** После фикса Stage 2 (вынесли Accept/Regen в единый FeedbackForm) обнаружил — Stage 3 страдает тем же дублированием: внутри CanvasCard жили inline-кнопки `[Принять черновик]` + `[Пере-сгенерировать]`, а под ней рендерился ещё один FeedbackForm с собственной кнопкой «Пере-генерировать черновик» внутри трёх-полевой формы. Итого: маркетолог, читающий черновик «Позиционирование», видит ТРИ кнопки для двух решений (Принять / Пересгенерировать) — и две из них делают одно и то же. На Stage 2 я это уже исправил и забыл что Stage 3 повторяет паттерн.

**Корневая причина.** Copy-paste наследие: Stage 3 был «скопирован» со Stage 2 в период до исправления Stage 2. Когда Stage 2 унифицировался, Stage 3 остался в старой форме — классический сценарий параллельных ветвей кода, где фикс применяется по одному месту. В CHIP_UI_KIT нет инварианта «одно решение = одно место», поэтому CI не ловил.

**Что починил.**
- `frontend/src/pages/wizard/Stage3Page.tsx`: убрал `RotateCcw` из импорта; заменил inline Accept+Pересгенерировать в CanvasCard на простой рендер `<CanvasCard accepted={current.accepted}>…</CanvasCard>` + один `<FeedbackForm>` со слитыми Accept + Regen в action-row, как на Stage 2.
- Добавил `accept()` с auto-advance (циклический обход 4 блоков, `setActive(nextUnaccepted)` + `requestAnimationFrame(scrollTo top)`), `reopen()` (сброс `accepted=false` чтобы вернуть маркетолога к форме правок), `submitFeedbackAndRegen()` (последовательный `submitFeedback` → `run`).
- Контракт Accept-кнопки для red-валидатора: `onAccept={current.validation?.trafficLight === 'red' ? undefined : accept}` — когда валидатор вернул red, prop'а просто нет → FeedbackForm не рисует кнопку. Не `disabled`, а отсутствие — потому что отсутствие невозможно «кликнуть тайно», а disabled иногда проскакивает через Enter.

**Правило.** Любой antipattern исправленный на стадии N ОБЯЗАН быть проверен на всех остальных стадиях wizard'а (сейчас 4). CJM-прогон после фикса — не «пощупать эту стадию», а «пощупать ВСЕ 4 стадии и подтвердить что паттерн единый». Stage 3 → Stage 4 тоже проверил: Stage 4 — одиночный flow без 4-блочной структуры, antipattern не применим.

### 2026-04-19 — Dead-end after approval: «утвердил блок — и что?»

**Что произошло.** Артём прошёл Stage 2 «Сессия с собственником»: вставил 3 интервью, нажал «Сформулировать уточняющие вопросы», черновик сгенерировался, Артём нажал «Принять черновик». Badge поменялся на «Утверждено маркетологом», кнопка «Принять черновик» превратилась в «Вернуть на правки», кнопка «Пересгенерировать» стала disabled. На этом UX закончился — куда кликать дальше, не показано. Sticky-бар внизу «На одобрение собственника» — disabled (1/4 утверждено). Таб «Легенда» — серая точка, не призывает. Артём: «блять и мы вернулись туда откуда начинали что дальше не идет». Маркетолог-который-не-Артём в этот момент застревает полностью.

**Корневая причина.** Двухслойная:
1. **Порядок блоков в Canvas.** Внутри CanvasCard жили action-кнопки: `[Принять черновик] / [Пересгенерировать]` — это решения маркетолога. FeedbackForm жил ПОД карточкой — это структурированный «что поправить» с тремя полями. Цикл маркетолога естественно: читаю → (опционально) пишу правки → решаю. Раньше был: читаю → решаю СРАЗУ → (если нет) листаю вниз писать правки. Кнопка решения выше фидбэка — мешает написать фидбэк, провоцирует раннее «принять» без разбора.
2. **Нет next-step CTA после approved.** После `accepted=true` карточка просто перекрасилась в зелёную рамку, и интерфейс замер. Stage 1 была устроена правильно (после хорошего черновика — отдельная карточка «Перейти к Стадии 2» с primary-CTA), на Stage 2 этого паттерна просто не было — 4 блока внутри одной стадии, и между ними маркетолог должен был сам догадаться кликнуть по вкладке.

**Что починил.**
- `frontend/src/pages/wizard/Stage2Page.tsx`: action-chips вынесены из CanvasCard в отдельную «action-карточку» ПОД FeedbackForm'ом. Порядок теперь: черновик → форма правок → кнопки действия (единообразно со Stage 1, где CTA-карточка снизу).
- `Stage2Page.tsx` → новый компонент `NextStepCard` после `accepted=true`. Три ветки: (a) есть следующий неутверждённый блок → «{current} утверждено. Следующий шаг — {next}» + primary-кнопка «Перейти к "{next}"» (переключает active-таб + `scrollTo({top:0})`); (b) все 4 утверждены → «Все четыре блока утверждены — нажмите 'На одобрение собственника' внизу»; (c) защита от exotic-кейса.
- `nextUnacceptedBlock` вычисляется через `useMemo` по циклическому обходу BLOCKS: стартуем с индекса после текущего, возвращаем первый `!blocks[cand].accepted`. Обход именно циклический, а не «строго вперёд», потому что маркетолог может сначала утвердить «Миссию», потом вернуться к «Легенде» — порядок внутри Stage 2 логически независим.

**Правило.** Любое approved-состояние (`accepted`, `finalized`, `signed_off`) обязано показывать **следующий шаг явно** в той же области экрана, а не в стороннем баре/меню/вкладке. Правило обязательное для 4-stage wizard'а: каждый блок/подблок, завершая локальный success, должен либо (a) переключить maker'а на следующий неутверждённый узел, либо (b) явно сказать «готово всё, кликни это для отправки». «Badge → вкладка сверху станет зелёной → угадай» — НЕ считается. Это не плохо-спроектированный UX, это архитектурный долг в переходах состояний; и он умножается: если не поправить на Stage 2, тот же баг приедет на Stage 3 и Stage 4.

### 2026-04-19 — Silent misdirection: «Claude за 1 сек» на HTTP round-trip'е кэш-хита

**Что произошло.** После фикса silent-rejection'а Артём глянул на чип сверху карточки: «Claude сделал черновик за 1 сек — сэкономил 3 ч» и справедливо спросил — «это не фейк?». Фейком оно не было (черновик настоящий, лежит в `prompt_runs`, сгенерирован gpt-5.4-mini за 9.6 сек в 20:28 того же дня), но чип давал ложный сигнал «AI сейчас подумал за 1 секунду». На самом деле сейчас AI вообще не работал — backend нашёл строку с тем же `inputHash` и вернул её без вызова вендора.

**Корневая причина.**
`TimeSavedChip generationSeconds={elapsed}` получал `elapsed = (Date.now() - t0) / 1000` — HTTP round-trip время до backend'а. При cache hit backend отвечает за ~100–200 мс → `Math.max(1, Math.round(0.15))` = «1 сек». Проблема не в математике — проблема в семантике: «Claude сделал черновик за 1 сек» подразумевает время работы LLM, а не время HTTP-запроса к Postgres. Собственник на демо видит «AI магически мгновенный» (методологически — ложь про «thinking partner»), маркетолог не понимает почему страница стабильна между перезагрузками (кэш работает бесшумно).

**Что починил.**
- `backend/src/ai/ai.service.ts`: `AIInvokeResult.generatedAt?: string` (ISO-8601). В cache-hit ветке заполняется `cached.createdAt.toISOString()` (момент оригинального вызова), в real-call ветке — `new Date().toISOString()` (сейчас).
- `frontend/src/components/TimeSavedChip.tsx`: два режима. Fresh (зелёный) — «Claude сделал черновик за N сек — сэкономил M ч», где N берётся из `ai.latencyMs / 1000` (реальная длительность вендорского вызова). Cached (жёлтый) — «Результат из кэша (N назад) — инпут не менялся, повторный вызов не нужен» + `title`-hint объясняющий что это штатное кэширование и сам черновик настоящий.
- `frontend/src/pages/wizard/Stage1Page.tsx:729–737`: передаёт `cacheHit={result.ai?.cached}` и `generatedAt={result.ai?.generatedAt}`.

**Правило.** Silent-misdirection — класс багов где UI бодро рапортует о работе, которой не было или которая была когда-то в прошлом. Каждый UI-элемент показывающий «что AI только что сделал» (progress, latency, cost, token burn, «экономия часов») обязан:
(a) брать метрики из `AIInvokeResult` (с backend'а), а не из frontend-измерений HTTP round-trip'а;
(b) различать свежий вызов и кэш-хит визуально (цвет/иконка/формулировка) — не рендерить одинаковый успех-чип для обоих;
(c) при кэш-хите показывать дату оригинального вызова, чтобы маркетолог понимал stability-поведение страницы.
Методологически: BP = «Claude — thinking partner, не автогенератор». Чип «за 1 сек» убивает эту рамку; «из кэша, инпут не менялся» — укрепляет (объясняет что AI — детерминированный инструмент, а не магия).

### 2026-04-19 — Silent rejection: ai.ok=false молча рендерился как «пустой черновик»

**Что произошло.** После фикса auto-scroll'а Артём загрузил 3 валидных интервью Холста (6569 знаков прямой речи), нажал «Извлечь паттерны». Чип «Claude сэкономил 3 ч за 1 сек» появился сразу → страница дорисовала блок «Черновик пустой. Claude не нашёл устойчивых паттернов». UI доложил «успех» и «пусто» одновременно — маркетолог уверен что Claude не справился, хотя на деле `AIService` отказался звонить вендору молча.

**Корневая причина.** Трёхслойный silent-failure:
1. `AIService.rejected()` и `degraded()` возвращали `{ok:false, json:null, text:null, rejectReason:…}` без единой log-строки. Любой из путей — 5 roundtrip'ов за час, `BUDGET_EXCEEDED`, `tool_not_whitelisted`, LLM-exception — уходил в `/tmp/bp-backend.log` тишиной.
2. Кэш в `ai.service.ts` возвращал любой `prompt_run` со `status='completed'`, включая строки где `outputJson=null` И `outputText=''` — один degraded() результат пожизненно залипал на том же `inputHash`.
3. Frontend `Stage1Page.runInterview` делал `setResult(res.data)` на HTTP 201, не глядя на `ai.ok`. В `Stage1DraftView` с `ai.json=null, row=null, text=null` срабатывал fallback `DraftEmpty` с копирайтом «Claude не нашёл паттернов» — методологически обратная ложь.

**Что починил.**
- `backend/src/ai/ai.service.ts`: `this.logger.warn()` в `degraded()` и `rejected()` + гвард `cacheIsValid = outputJson !== null || outputText.length > 0` перед возвратом кэша. Невалидный кэш теперь WARN-логируется и объезжается (новый вызов идёт к вендору).
- `frontend/src/pages/wizard/Stage1Page.tsx`: перед `setResult` проверяется `res.data.ai?.ok`; при `false` вызывается `translateRejectReason()` (9 известных кодов: `roundtrip_limit_hit`, `BUDGET_EXCEEDED`, `DAILY_CAP_EXCEEDED`, `no_vendor_available`, `tool_not_whitelisted`, `llm_failed:rate_limited|auth|context_too_long|*`) → человекочитаемый русский текст в `setError`.

**Правило.** Любой helper вида «молча верни ok:false» = bug-amplifier. Каждая такая точка обязана:
(a) логировать WARN/ERROR с кодом причины (без этого silent-failures dashboard врёт);
(b) не сохранять в БД `status='completed'` для пустого результата — иначе кэш отдаст пустоту как успех при следующем идентичном запросе;
(c) фронту возвращать поле (`ai.ok`), по которому UI отличит «вызова не было» от «вызов был, итог пустой».
Фронт на любом endpoint возвращающем `ai: AIInvokeResult` обязан ветвить `if (!res.data.ai?.ok)` → переводить `rejectReason` в сообщение, НИКОГДА не падать в generic-empty-state.

### 2026-04-19 — Версии не бампались между сессиями

**Что произошло.** Артём после серии правок (Stage 1 + Stage 2 + Stage 3 + русификация админки + CHIP_UI_KIT sweep) зашёл на login, увидел `v3.4.7` — ту же что вчера — и разозлился: «ни хрена версия все то же самое». По факту versions.json не бампались ни на одной из 4 сессий подряд, хотя был смердж десятка файлов.

**Почему.** Я (Claude) правил код, проверял tsc и коммитил — без запуска `npm run build`, который единственный триггерит `scripts/bump-version.mjs`. В рабочем процессе dev-mode (Vite HMR) билд не нужен, поэтому bump-скрипт не стрелял. То есть версия у меня в голове была «дев-артефакт», а для Артёма это главный UX-маркер «работа идёт».

**Правило.** См. секцию «Версионирование — ЖЁСТКОЕ ПРАВИЛО» выше. Каждая сессия, которая правит код → заканчивается bump'ом всех трёх мест + sanity-grep'ом. Без исключений, даже если «это только одна строчка в комментарии».

### 2026-04-19 — Сломал Stage 1 пока наращивал Stage 2/3

**Что произошло.** Артём нажал «Извлечь паттерны» на Stage 1 → «ни хрена ничего не происходит». Регресс: кнопка визуально молчит. При этом backend возвращает 201, DOM рендерит черновик — технически работает.

**Корневая причина.** Не функциональная, а UX'овая: после правок на Stage 2/3 страница Stage 1 осталась длинной (~2000+px), черновик рендерился ниже кнопки submit за пределами viewport, backend отдавал cache-hit за ~15мс, loading state даже не успевал моргнуть. Для маркетолога: нажал → ничего не видно → кнопка сломана. Я этот регресс не поймал потому что проверял Stage 1 через curl (payload приходит → значит работает), а не через реальный UI-flow.

**Что починил.** `Stage1Page.tsx`: `useRef` на блок черновика + `requestAnimationFrame(() => draftRef.current?.scrollIntoView({behavior:'smooth', block:'start'}))` в `runInterview` после `setResult`. Теперь после успеха страница сама прокручивается к черновику — маркетолог видит результат.

**Правило.** Когда трогаю Stage N, обязательно прохожу CJM предыдущих Stage 1..N-1 через Preview MCP (не curl) — клик по главным CTA, визуальная проверка что результат попадает в viewport. «Незатронутый код не значит незатронутое поведение»: длина страницы, cache-hit timing, viewport position — всё это меняется от соседних правок.

### Шаблон для следующих записей

```markdown
### YYYY-MM-DD — краткое имя ошибки

**Что произошло.** Симптом глазами Артёма.
**Корневая причина.** Техническое объяснение.
**Что починил.** Файл:строка + что изменил.
**Правило.** Конкретная проверка, которую впредь делаю до заявки «готово».
```

Не стирать старые записи — это history. Новые добавлять сверху (свежие первыми).

---

## Где что лежит

```
/Users/techno/Desktop/AI/BP/
├── PLAN.md                      # Архитектурный план (8 разделов)
├── BUSINESS_LOGIC.md            # Бизнес-логика без техники
├── INSIGHTS.md                  # Выжимка из 28 материалов
├── CLAUDE.md                    # ← этот файл
├── CHANGELOG.md                 # История изменений
├── backend/                     # NestJS 10 API
│   ├── src/
│   │   ├── ai/                  # AIService + VendorRouter + GlobalLLMQueue + ProjectBusyService
│   │   │   └── providers/       # LLMProvider interface + Anthropic/OpenAI/OpenAICompat adapters
│   │   ├── security/            # BriefSanitizer, PII redactor, sandbox
│   │   ├── wizard/              # stage orchestrator + 4 stages
│   │   ├── validator/           # 3-level validator
│   │   ├── golden-set/          # regression runner
│   │   ├── billing/             # reseller engine + anthropic_cost_factor
│   │   ├── observability/       # prompt_run + audit + metrics
│   │   ├── exporter/            # DOCX/XLSX contract
│   │   ├── integrations/        # Post-MVP stubs (ElevenLabs, Fireflies, Telegram)
│   │   ├── prompts/             # 11 промпт-шаблонов с YAML-frontmatter
│   │   ├── knowledge/
│   │   │   ├── industry_context/  # per индустрия
│   │   │   └── industry_gotchas/  # стоп-слова per индустрия
│   │   └── auth/                # JWT + guards + RBAC
│   └── test/
│       └── golden-set/          # Белая Линия + будущие эталоны
├── frontend/
│   ├── src/
│   │   ├── components/          # Sidebar, Layout, Tooltip (из CHIP_UI_KIT)
│   │   ├── pages/               # Login, Dashboards, Wizard
│   │   ├── wizard/              # 4 стадии
│   │   └── config/platform.ts   # единственное место с текстами
│   └── public/brand/            # logo-white.png, logo-dark.png
├── docx-exporter/               # отдельный сервис
├── infra/
│   ├── nginx/                   # TLS 1.3 + mTLS
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── Dockerfile.*
├── ci/
│   ├── semgrep.yml              # SAST
│   ├── zap-baseline.conf        # DAST
│   ├── playwright.config.ts     # UI smoke
│   └── golden-set.yml           # regression gate
└── docs/
    ├── shadow-ai-policy.md      # для marketer-подрядчиков
    ├── RBAC.md                   # почему 3 роли, не больше не меньше
    └── ADR/
        ├── 0001-multi-vendor-llm.md     # антихрупкость через 3 вендора
        └── 0002-no-low-code-wizard-builder.md  # почему wizard линейный
```
