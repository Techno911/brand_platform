import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  // AI calls
  readonly anthropicCalls = new Counter({
    name: 'bp_anthropic_calls_total',
    help: 'Total Anthropic API calls',
    labelNames: ['command', 'model', 'status'] as const,
    registers: [this.registry],
  });

  readonly anthropicLatency = new Histogram({
    name: 'bp_anthropic_latency_seconds',
    help: 'Anthropic API latency',
    labelNames: ['command', 'model'] as const,
    buckets: [0.5, 1, 2, 5, 10, 20, 40, 60, 120],
    registers: [this.registry],
  });

  readonly anthropicCost = new Counter({
    name: 'bp_anthropic_cost_usd_total',
    help: 'Cumulative Anthropic cost USD',
    labelNames: ['command', 'model'] as const,
    registers: [this.registry],
  });

  readonly anthropicTokens = new Counter({
    name: 'bp_anthropic_tokens_total',
    help: 'Total tokens (by kind)',
    labelNames: ['command', 'model', 'kind'] as const,
    registers: [this.registry],
  });

  readonly anthropicRetries = new Counter({
    name: 'bp_anthropic_retries_total',
    help: 'Number of retries',
    labelNames: ['command', 'reason'] as const,
    registers: [this.registry],
  });

  readonly budgetRejections = new Counter({
    name: 'bp_budget_rejections_total',
    help: 'Pre-flight budget kill-switch rejections',
    labelNames: ['command'] as const,
    registers: [this.registry],
  });

  readonly promptInjections = new Counter({
    name: 'bp_prompt_injections_detected_total',
    help: 'Prompt injection detections in brief sanitizer',
    labelNames: ['severity'] as const,
    registers: [this.registry],
  });

  readonly toolCallRejected = new Counter({
    name: 'bp_tool_call_rejected_total',
    help: 'LLM tool calls rejected by whitelist',
    labelNames: ['tool'] as const,
    registers: [this.registry],
  });

  readonly validatorBlocks = new Counter({
    name: 'bp_validator_blocks_total',
    help: 'Output validator blocks',
    labelNames: ['level', 'reason'] as const,
    registers: [this.registry],
  });

  readonly wizardEvents = new Counter({
    name: 'bp_wizard_events_total',
    help: 'Wizard UX events (step enter/leave/back/help)',
    labelNames: ['event', 'stage'] as const,
    registers: [this.registry],
  });

  readonly goldenSetRegression = new Gauge({
    name: 'bp_golden_set_regression_ratio',
    help: 'Latest golden-set regression ratio (0..1)',
    labelNames: ['prompt_version'] as const,
    registers: [this.registry],
  });

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  async scrape(): Promise<string> {
    return this.registry.metrics();
  }
}
