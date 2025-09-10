import Mixpanel from 'mixpanel';
import { createHash } from 'crypto';
import { log } from './vite';

class MixpanelService {
  private mixpanel: Mixpanel.Mixpanel | null = null;

  constructor() {
    const token = process.env.MIXPANEL_TOKEN;
    
    if (token) {
      this.mixpanel = Mixpanel.init(token, {
        debug: process.env.NODE_ENV === 'development'
      });
      log('Mixpanel initialized successfully');
    } else {
      log('Warning: MIXPANEL_TOKEN not found. Server-side analytics will not be tracked.');
    }
  }

  // Track server-side events
  track(eventName: string, properties?: Record<string, any>, userId?: string) {
    if (!this.mixpanel) return;

    try {
      const eventData = {
        distinct_id: userId || 'anonymous',
        ...properties,
        server_side: true,
        timestamp: new Date().toISOString()
      };

      this.mixpanel.track(eventName, eventData);
      log(`Mixpanel event tracked: ${eventName}`);
    } catch (error) {
      log(`Error tracking Mixpanel event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Hash phone number for privacy
  private hashPhoneNumber(phoneNumber: string): string {
    return createHash('sha256').update(phoneNumber).digest('hex');
  }

  // Set user properties
  setUserProperties(userId: string, properties: Record<string, any>) {
    if (!this.mixpanel) return;

    try {
      // Hash phone number for privacy if present
      const sanitizedProperties = { ...properties };
      if (sanitizedProperties.$phone) {
        const phoneNumber = sanitizedProperties.$phone;
        sanitizedProperties.$phone = this.hashPhoneNumber(phoneNumber);
        sanitizedProperties.phone_last4 = phoneNumber.slice(-4); // Keep last 4 as separate property
      }
      
      this.mixpanel.people.set(userId, sanitizedProperties);
      log(`Mixpanel user properties set for ${userId}`);
    } catch (error) {
      log(`Error setting Mixpanel user properties: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Track user signup
  trackSignup(userId: string, phoneNumber: string, source: string = 'sms') {
    this.track('User Signup', {
      user_id: userId,
      phone_last4: phoneNumber.slice(-4), // Only last 4 digits for privacy
      signup_source: source,
      signup_method: source === 'squarespace' ? 'website_form' : 'sms_direct'
    }, userId);

    // Set user properties
    this.setUserProperties(userId, {
      $phone: phoneNumber, // Will be hashed by setUserProperties
      $created: new Date().toISOString(),
      signup_source: source
    });
  }

  // Track user login
  trackLogin(userId: string, phoneNumber: string) {
    this.track('User Login Success', {
      user_id: userId,
      phone_last4: phoneNumber.slice(-4),
      login_method: 'sms_verification'
    }, userId);
  }

  // Track message events
  trackMessageSent(userId: string, messageData: {
    hasHashtags: boolean;
    hashtagCount: number;
    hasUrl: boolean;
    messageLength: number;
    source: string;
  }) {
    this.track('Message Created', {
      user_id: userId,
      has_hashtags: messageData.hasHashtags,
      hashtag_count: messageData.hashtagCount,
      has_url: messageData.hasUrl,
      message_length: messageData.messageLength,
      message_source: messageData.source
    }, userId);
  }

  // Track board creation
  trackBoardCreated(userId: string, boardName: string, isPrivate: boolean) {
    this.track('Board Created', {
      user_id: userId,
      board_name: boardName,
      is_private: isPrivate,
      board_type: isPrivate ? 'private' : 'shared'
    }, userId);
  }

  // Track board sharing
  trackBoardShared(userId: string, boardName: string, inviteCount: number) {
    this.track('Board Shared', {
      user_id: userId,
      board_name: boardName,
      invite_count: inviteCount
    }, userId);
  }
}

// Export singleton instance
export const mixpanelService = new MixpanelService();
export default mixpanelService;