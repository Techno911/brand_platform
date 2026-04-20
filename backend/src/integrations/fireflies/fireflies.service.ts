import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Post-MVP: automatic owner-session transcript sync (Mingalieva, Chernobrovkina). */
@Injectable()
export class FirefliesService {
  private readonly logger = new Logger('FirefliesService');
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('integrations.firefliesApiKey') ?? '';
    this.enabled = Boolean(this.apiKey);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async fetchTranscript(meetingId: string): Promise<{
    enabled: boolean;
    transcript?: string;
    reason?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false, reason: 'integration disabled (no FIREFLIES_API_KEY)' };
    }
    // TODO: real Fireflies GraphQL API call.
    this.logger.log(`fireflies transcript requested for meeting ${meetingId}`);
    return { enabled: true, transcript: '' };
  }
}
