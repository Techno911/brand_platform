/**
 * Centralised strongly-typed config. Loaded via @nestjs/config.
 * Invariant: never return a secret from a DTO. Only boolean flags/numbers.
 */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT) || 3000,
  // Базовый URL админки — используется в telegram digest'е для deep-link'а в /admin/security.
  frontendUrl: process.env.FRONTEND_URL ?? 'https://bp.chirkov.info',

  db: {
    host: process.env.DATABASE_HOST ?? 'bp-postgres',
    port: Number(process.env.DATABASE_PORT) || 5432,
    user: process.env.DATABASE_USER ?? 'bp',
    password: process.env.DATABASE_PASSWORD ?? 'bp',
    name: process.env.DATABASE_NAME ?? 'bp',
    ssl: process.env.DATABASE_SSL === 'true',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7',
    judgeModel: process.env.ANTHROPIC_JUDGE_MODEL ?? 'claude-haiku-4',
    maxOutputTokens: Number(process.env.ANTHROPIC_MAX_OUTPUT_TOKENS) || 4096,
    timeoutMs: Number(process.env.ANTHROPIC_TIMEOUT_MS) || 120_000,
  },

  // Multi-vendor LLM layer (антихрупкость: Anthropic primary, GPT fallback,
  // DeepSeek/Qwen/GLM — tertiary на дешёвые шаги). Moat BP не в том, какой
  // LLM гоняем, а в методологии + golden set — поэтому провайдер выбирается
  // политикой на уровне стадии, а не хардкодом в AIService.
  llm: {
    primary: process.env.LLM_PRIMARY ?? 'anthropic',
    secondary: process.env.LLM_SECONDARY ?? 'openai',
    tertiary: process.env.LLM_TERTIARY ?? 'openai_compat',
    // Per-stage vendor policy. Stage 2/3 (judgment-heavy: legend, values,
    // mission, positioning) идут на primary. Stage 1 (паттерны интервью)
    // и LLM-judge / classify / critique — допускают tertiary для экономии.
    // Формат: CSV "stage:vendor", пусто = primary.
    stagePolicy: (process.env.LLM_STAGE_POLICY ?? '1:primary,2:primary,3:primary,4:primary').trim(),
    judgePolicy: process.env.LLM_JUDGE_POLICY ?? 'tertiary',
    classifyPolicy: process.env.LLM_CLASSIFY_POLICY ?? 'tertiary',
    // Fallback chain на провайдер-down (429 после retries / 5xx / auth_fail).
    // Примеры: "anthropic,openai,openai_compat" — если Anthropic упал,
    // молча продолжить на GPT, потом на DeepSeek.
    fallbackChain: (process.env.LLM_FALLBACK_CHAIN ?? 'anthropic,openai,openai_compat').trim(),
    // Global rate limiter (верхняя планка над per-vendor limits).
    globalMaxConcurrent: Number(process.env.LLM_GLOBAL_MAX_CONCURRENT) || 20,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL ?? 'gpt-4.1',
    judgeModel: process.env.OPENAI_JUDGE_MODEL ?? 'gpt-4.1-mini',
    maxOutputTokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 4096,
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS) || 120_000,
    // tier 2-3: 10k RPM / 2M TPM — для нас tight cap 1000/400k.
    rpmCap: Number(process.env.OPENAI_RPM_CAP) || 1000,
    tpmCap: Number(process.env.OPENAI_TPM_CAP) || 400_000,
  },

  openaiCompat: {
    // Дешёвые OpenAI-совместимые вендоры: DeepSeek, Qwen (Dashscope),
    // GLM (Zhipu). Все они поддерживают OpenAI chat.completions формат,
    // поэтому один адаптер покрывает троих. Выбор вендора — через
    // OPENAI_COMPAT_VENDOR (для метрик/аудита) + baseUrl + apiKey + model.
    vendor: process.env.OPENAI_COMPAT_VENDOR ?? 'deepseek',
    apiKey: process.env.OPENAI_COMPAT_API_KEY ?? '',
    baseUrl: process.env.OPENAI_COMPAT_BASE_URL ?? 'https://api.deepseek.com/v1',
    model: process.env.OPENAI_COMPAT_MODEL ?? 'deepseek-chat',
    judgeModel: process.env.OPENAI_COMPAT_JUDGE_MODEL ?? 'deepseek-chat',
    maxOutputTokens: Number(process.env.OPENAI_COMPAT_MAX_OUTPUT_TOKENS) || 4096,
    timeoutMs: Number(process.env.OPENAI_COMPAT_TIMEOUT_MS) || 120_000,
    rpmCap: Number(process.env.OPENAI_COMPAT_RPM_CAP) || 300,
    tpmCap: Number(process.env.OPENAI_COMPAT_TPM_CAP) || 200_000,
  },

  anthropicLimits: {
    // tier 3-4: 2000 RPM / 400k input TPM. Держим tight cap чтобы оставить
    // головы для golden-set прогонов + panic-scenario.
    rpmCap: Number(process.env.ANTHROPIC_RPM_CAP) || 1500,
    tpmCap: Number(process.env.ANTHROPIC_TPM_CAP) || 300_000,
  },

  billing: {
    anthropicCostFactor: Number(process.env.ANTHROPIC_COST_FACTOR) || 1.0,
    markupPercent: Number(process.env.MARKUP_PERCENT) || 50,
    currencyRateUsdRub: Number(process.env.CURRENCY_RATE_USD_RUB) || 95,
  },

  ai: {
    projectDefaultBudgetUsd: Number(process.env.PROJECT_DEFAULT_BUDGET_USD) || 5.0,
    dailyBudgetHardCapUsd: Number(process.env.DAILY_BUDGET_HARD_CAP_USD) || 50.0,
    maxAgentRoundtripsPerStage: Number(process.env.MAX_AGENT_ROUNDTRIPS_PER_STAGE) || 5,
  },

  security: {
    briefSanitizerMaxLen: Number(process.env.BRIEF_SANITIZER_MAX_LEN) || 500_000,
    briefSanitizerFieldMaxLen: Number(process.env.BRIEF_SANITIZER_FIELD_MAX_LEN) || 30_000,
  },

  goldenSet: {
    regressionThreshold: Number(process.env.GOLDEN_SET_REGRESSION_THRESHOLD) || 0.15,
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://bp-minio:9000',
    // Поддерживаем оба варианта имён: BP-alias (S3_ACCESS_KEY/S3_SECRET_KEY)
    // и стандартные AWS (S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY). В dev .env и
    // docker-compose используем AWS-вариант (совместим с aws-cli и boto).
    accessKey:
      process.env.S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY_ID ?? '',
    secretKey:
      process.env.S3_SECRET_KEY ?? process.env.S3_SECRET_ACCESS_KEY ?? '',
    immutableBucket: process.env.S3_IMMUTABLE_BUCKET ?? 'bp-immutable',
    assetsBucket: process.env.S3_ASSETS_BUCKET ?? 'bp-assets',
  },

  docxExporter: {
    url: process.env.DOCX_EXPORTER_URL ?? 'http://bp-docx-exporter:4000',
    clientCert: process.env.DOCX_EXPORTER_CLIENT_CERT ?? '',
    clientKey: process.env.DOCX_EXPORTER_CLIENT_KEY ?? '',
    caCert: process.env.DOCX_EXPORTER_CA_CERT ?? '',
  },

  observability: {
    logLevel: process.env.LOG_LEVEL ?? 'info',
    logRetentionDays: Number(process.env.LOG_RETENTION_DAYS) || 14,
    pushgatewayUrl: process.env.GRAFANA_PUSHGATEWAY_URL ?? '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    telegramAdminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID ?? '',
  },

  integrations: {
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY ?? '',
    firefliesApiKey: process.env.FIREFLIES_API_KEY ?? '',
  },
});

export type AppConfig = ReturnType<typeof import('./configuration').default>;
