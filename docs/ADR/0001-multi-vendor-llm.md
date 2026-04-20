# ADR-0001. Multi-vendor LLM layer (антихрупкость)

- **Статус:** accepted, 2026-04-18
- **Автор:** Чирков + Claude Code (на основе ВВ Вани Смирнова от 17.04.2026)
- **Касается:** `backend/src/ai/*`, `backend/src/config/configuration.ts`, `.env*`

## Контекст

BP — reseller LLM для 10-30 клиентов (по плану). Первоначально AIService
дёргал Anthropic напрямую через `@anthropic-ai/sdk`. Это даёт отличное
качество для judgment-heavy задач (легенда, ценности, миссия, позиционирование,
месседж), но создаёт три серьёзных риска:

1. **Политический/юридический риск (РФ).** Anthropic заблокирован для РФ
   по IP / платежам карт РФ. Чирков использует прокси (Stripe через
   нерезидента) — это хрупкая конструкция: Anthropic TOS, смена правил,
   заморозка аккаунта и т.п. Если завтра канал обрывается — BP встаёт.
2. **Rate-limit риск.** Anthropic Tier 3-4 отсекает на 400k TPM. 10 клиентов
   × 2 маркетолога × Stage 1 (~30k input) = 600k TPM. Первый серьёзный
   инцидент эксплуатации.
3. **Cost-lock-in.** Opus 4.7 — $15/MTok input / $75/MTok output. Вариантов
   удешевить на границе (judge / classify / sanity-check) без потери
   качества нет, если мы намертво пришиты к одному вендору.

ВВ Вани от 17.04.2026: «Если у тебя садится работать несколько клиентов,
сколько промтов можно гонять за раз… В рамках одного API-ключа, сколько
сессий возможно за единицу времени». И отдельно — владельцу нужно иметь
возможность поменять ключ Anthropic на OpenAI или дешёвый китайский LLM
(DeepSeek / Qwen / GLM), не пересобирая продукт.

## Решение

Вводим **multi-vendor LLM-слой с политикой per-stage**.

### Роли вендоров

| Роль | Вендор | Модель по умолчанию | Где используется |
|---|---|---|---|
| primary | Anthropic | `claude-opus-4-7` | Stage 2/3/4 (legend/values/mission/positioning/message, critique) |
| secondary | OpenAI | `gpt-4.1` | fallback primary; опционально принуждение через `forceRole=secondary` |
| tertiary | OpenAI-compatible (DeepSeek / Qwen / GLM) | `deepseek-chat` | `/review-classify`, `/methodology-compliance-check`, sanity-check брифа, borderline classifier |

Все три — на выбор chip_admin через env: `LLM_PRIMARY`, `LLM_SECONDARY`,
`LLM_TERTIARY` + соответствующие `*_API_KEY`. Выбор модели внутри вендора —
через `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `OPENAI_COMPAT_MODEL` (+ judge).

### Per-stage / per-kind политика

`LLM_STAGE_POLICY=1:primary,2:primary,3:primary,4:primary` — судьба-тяжёлые
стадии на primary (качество > стоимость). Можно переназначить, например,
Stage 1 на tertiary, если бюджет сжимает.

`LLM_JUDGE_POLICY=tertiary`, `LLM_CLASSIFY_POLICY=tertiary` — «разметочные»
вызовы на дешёвый. На этих задачах Haiku / DeepSeek-chat дают сопоставимое
качество.

Промпт-агностика: все шаблоны в `backend/src/prompts/*.md` написаны
в нейтральном стиле без vendor-specific синтаксиса (нет `<thinking>`-блоков
Anthropic, нет `[INST]` Llama-стиля). Moat BP = методология + golden set +
industry_context, не вендор.

### Fallback chain

`LLM_FALLBACK_CHAIN=anthropic,openai,openai_compat`. Срабатывает на:
- `auth` (401/403 — кончился/невалиден ключ)
- `rate_limited` после исчерпания retries (провайдер сам ретраит 3 раза)
- `transient` (5xx / network) после исчерпания retries
- `content_filter` (policy триггер у конкретного вендора)
- `fatal` (остальное)

Не триггерит fallback:
- `bad_request` (400 — проблема в промпте / params, другой вендор тоже
  завалится, ухудшит UX)
- `context_too_long` (413 — клиент должен сократить input)

Каждый fallback пишет `vendor_fallback_triggered` в `audit_events` +
`security_events` (severity=medium) с meta `{from, to, reason, hop}`.

### Rate governor: `GlobalLLMQueueService`

Per-vendor token-bucket (rolling 60s RPM + TPM windows) + глобальный
cap одновременных запросов (`LLM_GLOBAL_MAX_CONCURRENT=20`). In-memory
(BP — 1 backend-инстанс, Redis не нужен).

Каждый вендор декларирует свои лимиты: `rateLimits(): { rpm, tpm }`.
Если слот не освобождается за 60 секунд — `Error("LLM queue timeout")`,
клиент получает graceful-degradation payload (wizard продолжает вручную).

UI-баннер «сколько впереди в очереди» (компонент `QueueBanner`)
опрашивает `/api/ai/queue/depth` раз в 5 секунд, показывается только
при depth > 0.

### Per-project mutex: `ProjectBusyService`

`pg_try_advisory_xact_lock(hash(projectId))` — запрещает два одновременных
AI-вызова в рамках одного проекта. Причина методологическая: Stage 2
«ценности» и Stage 2 «миссия» не должны стартовать параллельно — миссия
строится на основе утверждённых ценностей, race condition даст миссию
на стоке черновика ценностей.

Если lock занят — `ConflictException { error: 'PROJECT_BUSY' }` (HTTP 409),
UI показывает подсказку «в этом проекте уже идёт генерация, обычно 10-60с».

### Observability

- `prompt_run.routingDecision` = `${role}:${vendor}:${reason}` (пример:
  `primary:anthropic:stage_2_policy:primary` / `tertiary:openai_compat:judge_policy:tertiary`).
- `prompt_run.model` теперь может быть любой из 5+ моделей (gpt-4.1,
  deepseek-chat, qwen3-max, glm-4.6, claude-opus-4-7). Grafana-дашборды
  фильтруют по модели — vendor выводится из модели.
- `audit_events.generatedBy` = `${vendor}:${model}` для обратной
  трассируемости каждого артефакта.
- `audit_events.type = 'vendor_fallback_triggered'` — новый тип события
  для SLO алертов («если >10% вызовов идут через fallback — primary
  деградирует»).

## Последствия (честно)

### Плюсы
- **Бизнес-continuity** при сбое Anthropic / смене правил РФ.
- **Удешевление «разметочных» вызовов** в 10-30x (DeepSeek V3.5 vs Opus).
- **A/B внутренние тесты** — golden set прогоняется через `forceVendor`.
- **Честность пайплайна**: CLAUDE.md не врёт, что мы привязаны к одному
  вендору. Moat = методология, как и должно быть.

### Минусы (принятые)
- **Golden set становится per-vendor.** Эталон «Белая Линия» на Opus
  и на DeepSeek — это _разные_ эталоны. CI gate срабатывает для
  `(vendor, prompt_version)` пары, а не только `prompt_version`. Это
  х3 прогоны в CI, но лучше, чем переобучение на одном вендоре.
- **Cheap ≠ always better overall.** DeepSeek / Qwen на judgment-heavy
  стадиях может потребовать 2-3 критических итерации вместо 1 на Opus.
  Net-cost может оказаться выше. Поэтому stage-policy по умолчанию
  ставит primary на Stage 2/3/4 — не включаем tertiary туда без
  golden-set проверки.
- **Vendor quirks в кэше.** Anthropic — explicit `cache_control`, OpenAI —
  auto-prefix, DeepSeek — отдельное поле `prompt_cache_hit_tokens`.
  Код OpenAICompatProvider читает оба пути. Reporting cache-hit %
  по-прежнему сравним между вендорами.
- **Поддержка adapter'ов.** 3 файла (`anthropic.provider.ts` / `openai.provider.ts`
  / `openai-compat.provider.ts`) вместо одного SDK. Это цена антихрупкости,
  не считаем её избыточной.

### Что НЕ делаем (сознательно)
- **Распределённый Redis queue.** BP — 1 инстанс. In-memory достаточно.
  При масштабировании 2+ инстансов переключимся на bullmq — не в MVP.
- **Priority queue по тарифу.** Premium=Чирков-offline, а не «быстрее-в-очереди».
  В очереди все равны.
- **Собственный хостинг моделей (Ollama / self-hosted Llama).** Противоречит
  reseller-модели + не окупится на 10-30 клиентах. Если когда-нибудь
  добавим — это _после_ успешной эксплуатации API-варианта в 20+ проектах.

## Связанные решения

- ADR-0002: why no low-code wizard builder (Vanya rec #2 отклонён).
- `docs/SECURITY.md`: дельта к `PLAN.md §8` — добавили tool-sandbox
  whitelist (чтобы fallback на чужой вендор не расширял tool surface).
- `backend/src/billing/billing-config.service.ts`: поле `anthropic_cost_factor`
  переименовывается логически в `llm_cost_factor`, но мы оставляем
  старое имя для обратной совместимости env (пересмотр ежеквартально).

## Реализация (что уже сделано)

- `src/ai/providers/llm-provider.interface.ts` — нормализованный контракт.
- `src/ai/providers/anthropic.provider.ts` — тонкий адаптер над `AnthropicClient`.
- `src/ai/providers/openai.provider.ts` — native fetch, chat.completions.
- `src/ai/providers/openai-compat.provider.ts` — native fetch, DeepSeek/Qwen/GLM.
- `src/ai/vendor-router.service.ts` — per-stage policy + fallback chain.
- `src/ai/global-llm-queue.service.ts` — per-vendor token bucket.
- `src/ai/project-busy.service.ts` — `pg_try_advisory_xact_lock`.
- `src/ai/ai.service.ts` — интегрировано (router → lock → queue → provider).
- `src/ai/ai.controller.ts` — `/api/ai/queue/depth`, `/api/ai/queue/snapshot`
  (chip_admin), `/api/ai/projects/:id/busy`, `/api/ai/vendors`.
- `frontend/src/components/QueueBanner.tsx` — UI-баннер.

## Что ещё нужно (post-MVP)

- `chip_admin` UI `/admin/llm-config`: смена primary/secondary/tertiary
  в рантайме без рестарта (audit event `admin.llm_config_changed`).
- Per-vendor golden set прогон в CI (3 прогона вместо 1).
- Grafana dashboard «LLM vendor health» — latency p95 per vendor, fallback
  rate, cache hit %, spend per vendor.
- Telegram-алёрт chip_admin на `vendor_fallback_triggered rate > 10%` за 1h.
