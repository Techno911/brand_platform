// Shared API types, aligned 1:1 with backend entities.
// Regenerated manually — keep in sync with NestJS DTOs.

export type GlobalRole = 'chip_admin' | 'tracker' | null;
export type ProjectRole = 'marketer' | 'owner_viewer';

/** True для обеих global-ролей. Используется на страницах, где обе имеют доступ. */
export function isGlobalAdminRole(role: GlobalRole | undefined): role is 'chip_admin' | 'tracker' {
  return role === 'chip_admin' || role === 'tracker';
}

/** True только для полного админа (билинг, client CRUD, metrics scrape). */
export function isChipAdmin(role: GlobalRole | undefined): role is 'chip_admin' {
  return role === 'chip_admin';
}

export type Industry =
  | 'stomatology'
  | 'furniture'
  | 'restaurant'
  | 'salon'
  | 'kids_center'
  | 'auto_service'
  | 'other';

export type ProjectTariff = 'economy' | 'standard' | 'premium';

export type ProjectStatus =
  | 'draft'
  | 'stage_1'
  | 'stage_2'
  | 'stage_3'
  | 'stage_4'
  | 'finalized'
  | 'archived'
  | 'abandoned';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  globalRole: GlobalRole;
  projectRoles?: Array<{ projectId: string; role: ProjectRole; isPrimary: boolean }>;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  industry: Industry;
  tariff: ProjectTariff;
  status: ProjectStatus;
  currentStage: 1 | 2 | 3 | 4;
  budgetUsd: string;
  spentUsd: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finalizedAt?: string | null;
  client?: { id: string; name: string };
}

export interface Row {
  id: string;
  projectId: string;
  sheet: 1 | 2 | 3 | 4 | 5 | 6;
  type: string;
  payload: Record<string, any>;
  status: 'planned' | 'executing' | 'completed' | 'failed';
  orderIndex: number;
  finalized?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  rowId: string;
  version: number;
  source: 'ai' | 'marketer' | 'owner' | 'critic';
  content: Record<string, any>;
  promptRunId?: string | null;
  validatorPassed: boolean;
  trafficLight?: 'green' | 'yellow' | 'red' | null;
  validatorReport?: any;
  createdBy?: string | null;
  createdAt: string;
}

export interface ValidationIssue {
  severity: 'high' | 'medium' | 'low';
  category: string;
  text: string;
}

export interface ValidationReport {
  trafficLight: 'green' | 'yellow' | 'red';
  validatorPassed: boolean;
  blockedAtLevel: 'none' | 'regex' | 'llm_judge' | 'methodology' | 'borderline_red';
  regex: { passed: boolean; errors: string[]; warnings: string[] };
  judge?: { passed: boolean; score: number; issues: ValidationIssue[] };
  methodology?: { passed: boolean; violations: any[] };
  reasons: string[];
  suggestions: string[];
  artifact: string;
  timestamp: string;
}

export interface AIResult<T = any> {
  promptRunId: string;
  status: 'ok' | 'degraded' | 'blocked';
  text?: string;
  json?: T;
  costUsd?: number;
  degraded?: boolean;
  reason?: string;
}

/**
 * Реальный shape ответа AIService.invoke (backend `AIInvokeResult`).
 * Wizard-контроллеры оборачивают это в `{ row, ai }`: row — созданная запись
 * в sheet (если ok), ai — метаданные + результат генерации.
 *
 * Frontend ориентируется на: `ai.ok` (а НЕ устаревшее `status`), `ai.runId`,
 * `ai.json` (структурированный ответ) или `ai.text` (plain-text fallback).
 */
export interface AIInvokeResult<T = any> {
  ok: boolean;
  kind: string;
  runId: string;
  text: string | null;
  json: T | null;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
  };
  costUsd: number;
  costAdjustedUsd: number;
  costRawUsd: number;
  latencyMs: number;
  retries: number;
  cached: boolean;
  degraded: boolean;
  vendor?: string;
  model?: string;
  fallbackCount?: number;
  rejectReason?: string;
  /**
   * ISO-8601 момент, когда LLM фактически сгенерировал этот контент.
   * Если `cached:true` — это дата первого (живого) вызова в прошлом.
   * Если `cached:false` — момент «сейчас». Фронт использует это, чтобы
   * показать «Результат из кэша от {date}» вместо обманчивого чипа «за 1 сек»
   * на HTTP round-trip'е по закэшированной строке.
   */
  generatedAt?: string;
}

/**
 * Stage-1 «interview-patterns» — извлечение голоса клиента по канону
 * «Бренд-платформа 3.2» (Стадия 1 = Лист 1 в старом стандарте 3.1).
 *
 * Версии промпта:
 *  · v1.x (legacy): плоские массивы строк или объекты `{ pattern, frequency, quotes }`.
 *  · v2.0 (current): структурированный объект с `interviews_count`, `key_insight`,
 *    `top_praise/top_criticism`, JTBD в формате `when/want/so_that`, `segment_signals`
 *    разбит на 4 подкатегории (demography / acquisition_channels / price_markers /
 *    behavior_patterns).
 *
 * Фронт-рендер нормализует оба формата — см. Stage1DraftView + хелперы.
 */
export interface PatternWithQuotes {
  pattern: string;
  occurrences?: number;
  /** legacy: промпт v1.x возвращал frequency */
  frequency?: number;
  quotes_for_owner_session?: string[];
}

export interface RepeatedPhrase {
  phrase: string;
  occurrences?: number;
  quotes_for_owner_session?: string[];
}

export interface EmotionalMarker {
  marker: string;
  occurrences?: number;
  quotes_for_owner_session?: string[];
}

export interface SegmentSignal {
  signal: string;
  occurrences?: number;
  quotes_for_owner_session?: string[];
}

/** JTBD в каноническом формате «when → want → so_that». */
export interface JobToBeDone {
  when: string;
  want: string;
  so_that: string;
  occurrences?: number;
  quotes_for_owner_session?: string[];
}

export interface TopFormulation {
  formulation: string;
  occurrences?: number;
  quote?: string;
}

export interface SegmentSignalsBuckets {
  demography?: SegmentSignal[];
  acquisition_channels?: SegmentSignal[];
  price_markers?: SegmentSignal[];
  behavior_patterns?: SegmentSignal[];
}

// legacy-совместимый alias для старого одного-типа записи
export interface InterviewPatternItem {
  pattern: string;
  frequency?: number;
  occurrences?: number;
  quotes_for_owner_session?: string[];
}
export type InterviewPatternEntry =
  | string
  | InterviewPatternItem
  | PatternWithQuotes
  | RepeatedPhrase
  | EmotionalMarker
  | SegmentSignal;

export interface InterviewPatterns {
  /** v2.0+: количество проанализированных интервью. */
  interviews_count?: number;
  /** v2.0+: главный инсайт одной фразой (канон 3.1 — «ключевой инсайт»). */
  key_insight?: string;
  /** v2.0+: топ-3 похвалы (канон 3.1). */
  top_praise?: TopFormulation[];
  /** v2.0+: топ-3 нарекания (канон 3.1). */
  top_criticism?: TopFormulation[];

  pains?: PatternWithQuotes[] | InterviewPatternEntry[];
  gains?: PatternWithQuotes[] | InterviewPatternEntry[];
  jobs_to_be_done?: JobToBeDone[] | InterviewPatternEntry[];
  repeated_phrases?: RepeatedPhrase[] | InterviewPatternEntry[];
  emotional_markers?: EmotionalMarker[] | InterviewPatternEntry[];

  /** v2.0+: объект с 4 подкатегориями. v1: плоский массив. Нормализуется рендером. */
  segment_signals?: SegmentSignalsBuckets | InterviewPatternEntry[];

  /** legacy: для старых row.payload. */
  quotes_for_owner_session?: InterviewPatternEntry[];
}

export interface Stage1InterviewPatternsResponse {
  row: Row | null;
  ai: AIInvokeResult<InterviewPatterns>;
}

export interface ApprovalRecord {
  id: string;
  projectId: string;
  artifact: string;
  approvedBy: string;
  responsibleUserId: string;
  generatedBy?: string | null;
  modifiedBy?: string | null;
  snapshotContent?: Record<string, any> | null;
  snapshotHash: string;
  s3Uri?: string | null;
  approvedAt: string;
}
