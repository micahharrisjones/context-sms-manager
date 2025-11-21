import { log } from "./vite";
import type { IStorage } from "./storage";

interface PendoTrackEventPayload {
  type: 'track';
  event: string;
  visitorId: string;
  accountId: string;
  timestamp: number;
  properties?: Record<string, any>;
}

interface PendoIdentifyPayload {
  type: 'identify';
  visitorId: string;
  accountId: string;
  timestamp: number;
  visitor?: Record<string, any>;
  account?: Record<string, any>;
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

  async trackUserCreated(
    phoneNumber: string
  ): Promise<void> {
    await this.trackEvent(
      'User Created',
      phoneNumber,
      'aside',
      {
        signupMethod: 'SMS',
        timestamp: new Date().toISOString()
      }
    );
  }

  async trackSharedBoardCreated(
    phoneNumber: string,
    boardName: string
  ): Promise<void> {
    await this.trackEvent(
      'Shared Board Created',
      phoneNumber,
      'aside',
      {
        boardName,
        creationMethod: 'Web UI'
      }
    );
  }

  async trackInviteCommandSent(
    phoneNumber: string
  ): Promise<void> {
    await this.trackEvent(
      'Invite Command Sent',
      phoneNumber,
      'aside',
      {
        method: 'SMS'
      }
    );
  }

  async trackInviteLinkSent(
    phoneNumber: string,
    inviteCode: string
  ): Promise<void> {
    await this.trackEvent(
      'Invite Link Sent',
      phoneNumber,
      'aside',
      {
        inviteCode,
        method: 'SMS'
      }
    );
  }

  async trackInviteOptInSent(
    phoneNumber: string,
    inviteCode: string
  ): Promise<void> {
    await this.trackEvent(
      'Invite Opt-In Sent',
      phoneNumber,
      'aside',
      {
        inviteCode,
        method: 'SMS'
      }
    );
  }

  async trackInviteConversionCompleted(
    phoneNumber: string,
    inviteCode: string,
    userId: number
  ): Promise<void> {
    await this.trackEvent(
      'Invite Conversion Completed',
      phoneNumber,
      'aside',
      {
        inviteCode,
        userId,
        signupMethod: 'invite_link'
      }
    );
  }

  async trackContentAddedViaSMS(
    phoneNumber: string,
    contentId: number,
    tags: string[],
    timestamp: Date
  ): Promise<void> {
    const nonUntaggedTags = tags.filter(tag => tag !== 'untagged');
    const boardName = nonUntaggedTags.length > 0 ? nonUntaggedTags[0] : 'untagged';
    
    await this.trackEvent(
      'Content Added via SMS',
      phoneNumber,
      'aside',
      {
        contentId,
        boardName,
        boardType: 'private',
        tagCount: tags.length,
        tags: tags.join(', '),
        timestamp: timestamp.toISOString()
      }
    );
  }

  /**
   * Identify a visitor with metadata for Pendo visitor profiles
   * This updates the visitor profile with all the metadata fields
   */
  async identifyVisitor(
    visitorId: string,
    visitorData: Record<string, any>,
    accountId: string = 'aside'
  ): Promise<boolean> {
    if (!this.trackSecretKey) {
      log("⚠️  Pendo identify visitor skipped (no secret key):", visitorId);
      return false;
    }

    const payload: PendoIdentifyPayload = {
      type: 'identify',
      visitorId,
      accountId,
      timestamp: Date.now(),
      visitor: visitorData
    };

    try {
      log(`📤 Sending Pendo identify for ${visitorId} with ${Object.keys(visitorData).length} fields`);
      log(`   Fields: ${Object.keys(visitorData).slice(0, 10).join(', ')}${Object.keys(visitorData).length > 10 ? '...' : ''}`);
      
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
        log(`❌ Pendo identify visitor failed for ${visitorId}: ${response.status} - ${errorText}`);
        log(`   Payload was:`, JSON.stringify(payload, null, 2));
        return false;
      }

      log(`✅ Pendo visitor identified successfully: ${visitorId}`);
      return true;
    } catch (error) {
      log(`❌ Pendo identify visitor error for ${visitorId}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Get SMS activity statistics for a user
   * @param storage - Storage interface for database queries
   * @param userId - User ID
   * @returns SMS activity stats
   */
  async getSMSActivityStats(storage: IStorage, userId: number): Promise<{
    totalMessages: number;
    last7Days: number;
    last30Days: number;
    lastMessageDate: Date | null;
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get all messages for the user
      const allMessages = await storage.getMessages(userId);
      
      // Calculate counts
      const totalMessages = allMessages.length;
      const last7Days = allMessages.filter(m => new Date(m.createdAt) >= sevenDaysAgo).length;
      const last30Days = allMessages.filter(m => new Date(m.createdAt) >= thirtyDaysAgo).length;
      
      // Find last message date
      const lastMessage = allMessages.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      return {
        totalMessages,
        last7Days,
        last30Days,
        lastMessageDate: lastMessage ? new Date(lastMessage.createdAt) : null
      };
    } catch (error) {
      log('Error getting SMS activity stats:', error instanceof Error ? error.message : String(error));
      return {
        totalMessages: 0,
        last7Days: 0,
        last30Days: 0,
        lastMessageDate: null
      };
    }
  }

  /**
   * Calculate user engagement level based on activity
   * @param smsLast30Days - SMS messages in last 30 days
   * @param daysSinceLastWebVisit - Days since last web visit (null if never visited)
   * @returns Engagement level
   */
  calculateEngagementLevel(smsLast30Days: number, daysSinceLastWebVisit: number | null): string {
    // Consider both SMS and web activity
    const recentWebActivity = daysSinceLastWebVisit !== null && daysSinceLastWebVisit < 30;

    if (smsLast30Days >= 10 || (smsLast30Days >= 5 && recentWebActivity)) {
      return 'power_user';
    } else if (smsLast30Days >= 3 || recentWebActivity) {
      return 'active';
    } else if (smsLast30Days >= 1) {
      return 'casual';
    } else {
      return 'dormant';
    }
  }

  /**
   * Calculate platform preference based on SMS vs web activity
   * @param smsLast30Days - SMS messages in last 30 days
   * @param webVisitsLast30Days - Web visits in last 30 days (estimated from daysSinceLastWebVisit)
   * @returns Platform preference data
   */
  calculatePlatformPreference(smsLast30Days: number, webVisitsLast30Days: number): {
    primaryPlatform: string;
    smsPercentage: number;
  } {
    const totalActivity = smsLast30Days + webVisitsLast30Days;
    const smsPercentage = totalActivity > 0
      ? Math.round((smsLast30Days / totalActivity) * 100)
      : 100;

    let primaryPlatform: string;
    if (smsPercentage > 70) {
      primaryPlatform = 'sms';
    } else if (smsPercentage < 30) {
      primaryPlatform = 'web';
    } else {
      primaryPlatform = 'balanced';
    }

    return {
      primaryPlatform,
      smsPercentage
    };
  }
}

export const pendoServerService = new PendoServerService();
