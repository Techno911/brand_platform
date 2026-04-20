import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Post-MVP, INSIGHTS §11 B-3: pre-session voice agent for owner interview.
 * Stub: returns a signed URL for an ElevenLabs conversational agent.
 */
@Injectable()
export class ElevenLabsService {
  private readonly logger = new Logger('ElevenLabsService');
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('integrations.elevenlabsApiKey') ?? '';
    this.enabled = Boolean(this.apiKey);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async generatePreSessionLink(projectId: string, ownerName: string): Promise<{
    enabled: boolean;
    url?: string;
    sessionId?: string;
    reason?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false, reason: 'integration disabled (no ELEVENLABS_API_KEY)' };
    }
    // Real implementation would call ElevenLabs Agent API. For now we return a deterministic stub link.
    const sessionId = `${projectId}-${Date.now()}`;
    const url = `https://elevenlabs.io/app/conversation/${encodeURIComponent(sessionId)}?name=${encodeURIComponent(ownerName)}`;
    this.logger.log(`pre-session link generated for project ${projectId}`);
    return { enabled: true, url, sessionId };
  }
}
