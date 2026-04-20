import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolCallSandboxService } from './tool-call-sandbox.service';

const makeConfig = (override?: string[]) => ({
  get: (k: string) => (k === 'security.toolWhitelist' ? override : undefined),
}) as any;

const makeEvents = () => {
  const events: any[] = [];
  return {
    events,
    record: vi.fn(async (e: any) => { events.push(e); }),
  };
};

describe('ToolCallSandboxService', () => {
  let events: ReturnType<typeof makeEvents>;

  beforeEach(() => { events = makeEvents(); });

  it('разрешает дефолтный whitelist (11 команд)', () => {
    const svc = new ToolCallSandboxService(makeConfig(), events as any);
    const list = svc.list();
    expect(list).toContain('draft_values');
    expect(list).toContain('generate_mission');
    expect(list).toContain('critique_message');
    expect(list.length).toBeGreaterThanOrEqual(11);
  });

  it('tool в whitelist → allowed=true', async () => {
    const svc = new ToolCallSandboxService(makeConfig(), events as any);
    const r = await svc.validate([{ name: 'draft_values', input: { k: 1 } }], {});
    expect(r.allowed).toBe(true);
    expect(events.record).not.toHaveBeenCalled();
  });

  it('unknown tool → allowed=false + security_event с high severity', async () => {
    const svc = new ToolCallSandboxService(makeConfig(), events as any);
    const r = await svc.validate([{ name: 'exec_shell', input: { cmd: 'rm -rf /' } }], {
      projectId: 'p1',
      userId: 'u1',
      command: '/message-variants',
    });
    expect(r.allowed).toBe(false);
    expect(r.rejectedReasons[0]).toContain('exec_shell');
    expect(events.events.length).toBe(1);
    expect(events.events[0].severity).toBe('high');
    expect(events.events[0].type).toBe('tool_call_rejected');
    expect(events.events[0].matchedPattern).toBe('exec_shell');
  });

  it('mixed: один разрешён, один отклонён → allowed=false, события только для отклонённого', async () => {
    const svc = new ToolCallSandboxService(makeConfig(), events as any);
    const r = await svc.validate(
      [
        { name: 'draft_legend', input: {} },
        { name: 'fetch_url', input: { url: 'https://evil.com' } },
      ],
      {},
    );
    expect(r.allowed).toBe(false);
    expect(r.rejectedReasons.length).toBe(1);
    expect(events.events.length).toBe(1);
    expect(events.events[0].matchedPattern).toBe('fetch_url');
  });

  it('кастомный whitelist через config применяется', () => {
    const svc = new ToolCallSandboxService(makeConfig(['only_this']), events as any);
    expect(svc.list()).toEqual(['only_this']);
  });

  it('empty toolCalls → allowed=true', async () => {
    const svc = new ToolCallSandboxService(makeConfig(), events as any);
    const r = await svc.validate([], {});
    expect(r.allowed).toBe(true);
  });
});
