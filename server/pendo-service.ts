import { log } from "./vite";

interface PendoTrackEventPayload {
  type: 'track';
  event: string;
  visitorId: string;
  accountId: string;
  timestamp: number;
  properties?: Record<string, any>;
}

class PendoServerService {
  private trackSecretKey: string;
  private apiEndpoint = 'https://app.pendo.io/data/track';

  constructor() {
    this.trackSecretKey = process.env.PENDO_TRACK_SECRET_KEY || '';
    
    if (!this.trackSecretKey) {
      log("Warning: PENDO_TRACK_SECRET_KEY not configured - server-side tracking disabled");
    }
  }

  async trackEvent(
    eventName: string,
    visitorId: string,
    accountId: string = 'aside',
    properties: Record<string, any> = {}
  ): Promise<boolean> {
    if (!this.trackSecretKey) {
      log("Pendo track event skipped (no secret key):", eventName);
      return false;
    }

    const payload: PendoTrackEventPayload = {
      type: 'track',
      event: eventName,
      visitorId,
      accountId,
      timestamp: Date.now(),
      properties: {
        ...properties,
        source: 'server-side',
        environment: process.env.NODE_ENV || 'development'
      }
    };

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pendo-integration-key': this.trackSecretKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`Pendo track event failed: ${response.status} - ${errorText}`);
        return false;
      }

      log(`Pendo track event sent: ${eventName} for visitor ${visitorId}`);
      return true;
    } catch (error) {
      log('Pendo track event error:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async trackSMSMessageReceived(
    phoneNumber: string,
    messageContent: string,
    tags: string[],
    hasMedia: boolean = false
  ): Promise<void> {
    await this.trackEvent(
      'SMS Message Received',
      phoneNumber,
      'aside',
      {
        messageLength: messageContent.length,
        tagCount: tags.length,
        tags: tags.join(', '),
        hasMedia,
        messageType: hasMedia ? 'MMS' : 'SMS'
      }
    );
  }

  async trackNewBoardCreatedViaSMS(
    phoneNumber: string,
    boardName: string,
    boardType: 'private' | 'shared'
  ): Promise<void> {
    await this.trackEvent(
      'New Board Created via SMS',
      phoneNumber,
      'aside',
      {
        boardName,
        boardType,
        creationMethod: 'SMS'
      }
    );
  }
}

export const pendoServerService = new PendoServerService();
