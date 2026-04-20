import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema for Brand Platform.
 * Covers entities: users, clients, projects, project_roles, rows, drafts, approvals,
 *                 prompt_runs, audit_events, security_events, golden_set_runs,
 *                 marketer_quality_scores, billing_configs, invoices, wizard_step_events.
 */
export class InitialSchema1713369600000 implements MigrationInterface {
  name = 'InitialSchema1713369600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" varchar(255) NOT NULL,
        "full_name" varchar(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "global_role" varchar(32),
        "refresh_token_hash" varchar(255),
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "clients" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "legal_form" varchar(32) NOT NULL,
        "inn" varchar(20),
        "ogrn" varchar(20),
        "legal_address" varchar(500),
        "with_vat" boolean NOT NULL DEFAULT false,
        "contact_email" varchar(255),
        "contact_phone" varchar(32),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "industry" varchar(32) NOT NULL,
        "tariff" varchar(16) NOT NULL DEFAULT 'standard',
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "current_stage" integer NOT NULL DEFAULT 1,
        "budget_usd" decimal(10,4) NOT NULL DEFAULT 5.0,
        "spent_usd" decimal(10,4) NOT NULL DEFAULT 0,
        "started_at" timestamptz,
        "finalized_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_projects_client" ON "projects"("client_id");
      CREATE INDEX "idx_projects_status" ON "projects"("status");
    `);

    await queryRunner.query(`
      CREATE TABLE "project_roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "role" varchar(32) NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        UNIQUE ("user_id", "project_id", "role")
      );
      CREATE INDEX "idx_project_roles_user" ON "project_roles"("user_id");
      CREATE INDEX "idx_project_roles_project" ON "project_roles"("project_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "rows" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "sheet" integer NOT NULL,
        "type" varchar(32) NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "status" varchar(16) NOT NULL DEFAULT 'planned',
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "finalized" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_rows_project" ON "rows"("project_id");
      CREATE INDEX "idx_rows_sheet" ON "rows"("sheet");
    `);

    await queryRunner.query(`
      CREATE TABLE "prompt_runs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
        "kind" varchar(48) NOT NULL,
        "model" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'planned',
        "input_hash" varchar(64) NOT NULL,
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "cache_read_input_tokens" integer NOT NULL DEFAULT 0,
        "cache_creation_input_tokens" integer NOT NULL DEFAULT 0,
        "stop_reason" varchar(32),
        "provider_latency_ms" integer NOT NULL DEFAULT 0,
        "retry_count" integer NOT NULL DEFAULT 0,
        "error_code" varchar(64),
        "routing_decision" varchar(64),
        "permission_denied" boolean NOT NULL DEFAULT false,
        "crash_reason" varchar(255),
        "cost_usd" decimal(12,6) NOT NULL DEFAULT 0,
        "output_text" text,
        "output_json" jsonb,
        "cache_hit" boolean NOT NULL DEFAULT false,
        "initiated_by" varchar(64),
        "roundtrip" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz
      );
      CREATE INDEX "idx_prompt_runs_project" ON "prompt_runs"("project_id");
      CREATE INDEX "idx_prompt_runs_kind" ON "prompt_runs"("kind");
      CREATE INDEX "idx_prompt_runs_status" ON "prompt_runs"("status");
      CREATE INDEX "idx_prompt_runs_created" ON "prompt_runs"("created_at");
    `);

    await queryRunner.query(`
      CREATE TABLE "drafts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "row_id" uuid NOT NULL REFERENCES "rows"("id") ON DELETE CASCADE,
        "version" integer NOT NULL,
        "source" varchar(16) NOT NULL,
        "content" jsonb NOT NULL,
        "traffic_light" varchar(8),
        "prompt_run_id" uuid REFERENCES "prompt_runs"("id") ON DELETE SET NULL,
        "validator_passed" boolean NOT NULL DEFAULT false,
        "validator_report" jsonb,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_drafts_row" ON "drafts"("row_id");
      CREATE INDEX "idx_drafts_prompt_run" ON "drafts"("prompt_run_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "approvals" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
        "artifact" varchar(32) NOT NULL,
        "snapshot_content" jsonb NOT NULL,
        "snapshot_hash" varchar(128) NOT NULL,
        "s3_uri" varchar(512) NOT NULL,
        "approved_by" uuid NOT NULL,
        "is_self_approval" boolean NOT NULL DEFAULT false,
        "generated_by" uuid,
        "modified_by" uuid,
        "responsible_user_id" uuid NOT NULL,
        "approved_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_approvals_project" ON "approvals"("project_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(64) NOT NULL,
        "project_id" uuid,
        "user_id" uuid,
        "responsible_user_id" uuid,
        "generated_by" varchar(128),
        "modified_by" uuid,
        "approved_by" uuid,
        "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "ip_address" varchar(64),
        "user_agent" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_audit_type" ON "audit_events"("type");
      CREATE INDEX "idx_audit_project" ON "audit_events"("project_id");
      CREATE INDEX "idx_audit_user" ON "audit_events"("user_id");
      CREATE INDEX "idx_audit_created" ON "audit_events"("created_at");
    `);

    await queryRunner.query(`
      CREATE TABLE "security_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(48) NOT NULL,
        "severity" varchar(16) NOT NULL,
        "project_id" uuid,
        "user_id" uuid,
        "matched_pattern" varchar(255),
        "offset" integer,
        "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "detected_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_security_type" ON "security_events"("type");
      CREATE INDEX "idx_security_severity" ON "security_events"("severity");
      CREATE INDEX "idx_security_project" ON "security_events"("project_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "golden_set_runs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "prompt_version" varchar(128) NOT NULL,
        "model" varchar(64) NOT NULL,
        "status" varchar(16) NOT NULL,
        "scores" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "aggregate_regression" decimal(4,3) NOT NULL DEFAULT 0,
        "threshold" decimal(4,3) NOT NULL DEFAULT 0.15,
        "commit_sha" text,
        "triggered_by" varchar(255),
        "started_at" timestamptz NOT NULL DEFAULT now(),
        "finished_at" timestamptz
      );
      CREATE INDEX "idx_golden_version" ON "golden_set_runs"("prompt_version");
    `);

    await queryRunner.query(`
      CREATE TABLE "marketer_quality_scores" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "marketer_user_id" uuid NOT NULL,
        "project_id" uuid,
        "validator_kind" varchar(48) NOT NULL,
        "score" decimal(4,3) NOT NULL,
        "regex_violations" integer NOT NULL DEFAULT 0,
        "llm_judge_flags" integer NOT NULL DEFAULT 0,
        "methodology_violations" integer NOT NULL DEFAULT 0,
        "human_override_count" integer NOT NULL DEFAULT 0,
        "recorded_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_marketer_score_user" ON "marketer_quality_scores"("marketer_user_id");
    `);

    await queryRunner.query(`
      CREATE TABLE "billing_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "key" varchar(32) NOT NULL UNIQUE DEFAULT 'default',
        "anthropic_cost_factor" decimal(6,3) NOT NULL DEFAULT 1.0,
        "markup_percent" decimal(5,2) NOT NULL DEFAULT 50,
        "currency_rate_usd_rub" decimal(8,4) NOT NULL DEFAULT 95,
        "token_pricing" jsonb NOT NULL,
        "tariffs" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "kind" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'draft',
        "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL,
        "client_id" uuid NOT NULL,
        "amount_rub" decimal(12,2) NOT NULL,
        "raw_cost_usd" decimal(12,6) NOT NULL DEFAULT 0,
        "markup_percent" decimal(5,2) NOT NULL DEFAULT 50,
        "anthropic_cost_factor" decimal(6,3) NOT NULL DEFAULT 1.0,
        "with_vat" boolean NOT NULL DEFAULT false,
        "payment_ref" varchar(128),
        "breakdown" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "paid_at" timestamptz
      );
      CREATE INDEX "idx_invoices_status" ON "invoices"("status");
    `);

    await queryRunner.query(`
      CREATE TABLE "wizard_step_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "stage" integer NOT NULL,
        "sheet" varchar(48) NOT NULL,
        "event" varchar(48) NOT NULL,
        "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "recorded_at" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_wizard_step_project" ON "wizard_step_events"("project_id");
      CREATE INDEX "idx_wizard_step_user" ON "wizard_step_events"("user_id");
      CREATE INDEX "idx_wizard_step_event" ON "wizard_step_events"("event");
    `);

    // Seed default billing config.
    await queryRunner.query(`
      INSERT INTO "billing_configs" (key, token_pricing, tariffs)
      VALUES (
        'default',
        '{"claude-opus-4-7": {"input": 15, "output": 75, "cache_write": 18.75, "cache_read": 1.5}, "claude-haiku-4": {"input": 0.8, "output": 4}}'::jsonb,
        '{"economy": {"monthly_rub": 5000, "included_projects": 1, "markup_percent": 40, "sla_hours": 48, "manual_review_hours": 0}, "standard": {"monthly_rub": 12000, "included_projects": 1, "markup_percent": 50, "sla_hours": 24, "manual_review_hours": 2}, "premium": {"monthly_rub": 28000, "included_projects": 1, "markup_percent": 60, "sla_hours": 4, "manual_review_hours": -1, "includes_offline_meeting": true}}'::jsonb
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "wizard_step_events" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "invoices" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_configs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "marketer_quality_scores" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "golden_set_runs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "security_events" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approvals" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drafts" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prompt_runs" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rows" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "project_roles" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "projects" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clients" CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE;`);
  }
}
