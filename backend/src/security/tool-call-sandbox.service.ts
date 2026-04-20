import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecurityEventsService } from './security-events.service';

export interface ToolCall {
  name: string;
  input: Record<string, any>;
}

export interface ToolCallValidation {
  allowed: boolean;
  rejectedReasons: string[];
}

/**
 * ToolCallSandboxService — INSIGHTS §5 delta-5.
 * LLM responses with `tool_use` must only contain whitelisted tools.
 * Anything else => reject + log + kill the call.
 */
@Injectable()
export class ToolCallSandboxService {
  private readonly whitelist: Set<string>;

  // Default whitelist covers the 6 wizard commands + 5 helper commands.
  private static readonly DEFAULT_WHITELIST = [
    'draft_values',
    'draft_legend',
    'generate_mission',
    'generate_positioning',
    'generate_message_variants',
    'classify_message_border',
    'critique_message',
    'challenge_owner_response',
    'plan_mode_15_questions',
    'methodology_compliance_check',
    'interview_patterns',
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly events: SecurityEventsService,
  ) {
    const configured = this.config.get<string[]>('security.toolWhitelist');
    const list = configured && configured.length > 0
      ? configured
      : ToolCallSandboxService.DEFAULT_WHITELIST;
    this.whitelist = new Set(list);
  }

  list(): string[] {
    return Array.from(this.whitelist);
  }

  async validate(
    toolCalls: ToolCall[],
    ctx: { projectId?: string | null; userId?: string | null; command?: string },
  ): Promise<ToolCallValidation> {
    const rejected: string[] = [];
    for (const tc of toolCalls) {
      if (!this.whitelist.has(tc.name)) {
        rejected.push(tc.name);
        await this.events.record({
          type: 'tool_call_rejected',
          severity: 'high',
          projectId: ctx.projectId ?? null,
          userId: ctx.userId ?? null,
          source: 'tool_call_sandbox',
          matchedPattern: tc.name,
          excerpt: JSON.stringify(tc.input).slice(0, 200),
          meta: { command: ctx.command ?? null, whitelist: Array.from(this.whitelist) },
        });
      }
    }
    return {
      allowed: rejected.length === 0,
      rejectedReasons: rejected.map((n) => `tool "${n}" not in whitelist`),
    };
  }
}
