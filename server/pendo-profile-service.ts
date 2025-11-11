import { log } from "./vite";
import type { IStorage } from "./storage";

/**
 * SMS Activity Statistics Interface
 */
export interface SMSActivityStats {
  totalMessages: number;
  last7Days: number;
  last30Days: number;
  lastMessageDate: Date | null;
  daysSinceLastSms: number | null;
}

/**
 * Platform Preference Data
 */
export interface PlatformPreference {
  primaryPlatform: 'sms' | 'web' | 'balanced';
  smsPercentage: number;
}

/**
 * Engagement Level Type
 */
export type EngagementLevel = 'power_user' | 'active' | 'casual' | 'dormant';

/**
 * Content Statistics
 */
export interface ContentStats {
  totalBoards: number;
  privateBoardCount: number;
  sharedBoardCount: number;
  hasSharedBoards: boolean;
  hasCreatedBoard: boolean;
  hasJoinedSharedBoard: boolean;
}

/**
 * Complete Pendo Visitor Metadata
 */
export interface PendoVisitorMetadata {
  // Basic user info
  phone: string;
  firstName: string | null;
  lastName: string | null;
  
  // Signup info
  signupDate: string;
  signupMethod: string;
  daysSinceSignup: number;
  
  // SMS activity metadata
  lastSmsDate: string | null;
  totalSmsMessages: number;
  smsMessagesLast7Days: number;
  smsMessagesLast30Days: number;
  daysSinceLastSms: number | null;
  
  // Web activity metadata
  daysSinceLastWebVisit: number | null;
  
  // Platform preference
  primaryPlatform: 'sms' | 'web' | 'balanced';
  smsActivityPercentage: number;
  
  // Engagement level
  engagementLevel: EngagementLevel;
  
  // Content stats
  totalBoards: number;
  privateBoardCount: number;
  sharedBoardCount: number;
  hasSharedBoards: boolean;
  hasCreatedBoard: boolean;
  hasJoinedSharedBoard: boolean;
  
  // System
  profileLastUpdated: string;
}

/**
 * PendoProfileService - Calculates visitor metadata for Pendo profiles
 * 
 * This service handles all the logic for computing SMS activity statistics,
 * engagement levels, and platform preferences for Pendo visitor profiles.
 */
export class PendoProfileService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Get SMS activity statistics for a user
   * Calculates message counts for different time windows
   */
  async getSMSActivityStats(phoneNumber: string): Promise<SMSActivityStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    try {
      // Get user first (messages are user-scoped)
      const user = await this.storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          totalMessages: 0,
          last7Days: 0,
          last30Days: 0,
          lastMessageDate: null,
          daysSinceLastSms: null
        };
      }

      // Get all messages for this user
      const allMessages = await this.storage.getMessages(user.id);
      
      // Calculate total messages
      const totalMessages = allMessages.length;
      
      // Calculate messages in last 7 days
      const last7Days = allMessages.filter((msg: any) => 
        new Date(msg.createdAt) >= sevenDaysAgo
      ).length;
      
      // Calculate messages in last 30 days
      const last30Days = allMessages.filter((msg: any) => 
        new Date(msg.createdAt) >= thirtyDaysAgo
      ).length;
      
      // Get most recent message
      const sortedMessages = [...allMessages].sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const lastMessage = sortedMessages.length > 0 ? sortedMessages[0] : null;
      const lastMessageDate = lastMessage ? new Date(lastMessage.createdAt) : null;
      
      // Calculate days since last SMS
      const daysSinceLastSms = lastMessageDate 
        ? Math.floor((now.getTime() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        totalMessages,
        last7Days,
        last30Days,
        lastMessageDate,
        daysSinceLastSms
      };
    } catch (error) {
      log(`Error getting SMS activity stats for ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
      // Return empty stats on error
      return {
        totalMessages: 0,
        last7Days: 0,
        last30Days: 0,
        lastMessageDate: null,
        daysSinceLastSms: null
      };
    }
  }

  /**
   * Calculate platform preference based on SMS and web activity
   * Returns 'sms', 'web', or 'balanced' based on activity ratio
   */
  calculatePlatformPreference(
    smsLast30Days: number,
    daysSinceLastWebVisit: number | null
  ): PlatformPreference {
    // Estimate web visits (if they visited recently, count it)
    // This is a simplification since we don't track all web sessions
    const webVisits = daysSinceLastWebVisit !== null && daysSinceLastWebVisit < 30 ? 10 : 0;
    
    const totalActivity = smsLast30Days + webVisits;
    const smsPercentage = totalActivity > 0
      ? Math.round((smsLast30Days / totalActivity) * 100)
      : 100; // Default to 100% if no activity

    let primaryPlatform: 'sms' | 'web' | 'balanced';
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

  /**
   * Calculate user engagement level based on activity
   * Returns 'power_user', 'active', 'casual', or 'dormant'
   */
  calculateEngagementLevel(
    smsLast30Days: number,
    daysSinceLastWebVisit: number | null
  ): EngagementLevel {
    // Check if they've visited web recently (within 30 days)
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
   * Get content statistics for a user
   * Calculates board counts and feature adoption
   */
  async getContentStats(phoneNumber: string): Promise<ContentStats> {
    try {
      // Get user first
      const user = await this.storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        return {
          totalBoards: 0,
          privateBoardCount: 0,
          sharedBoardCount: 0,
          hasSharedBoards: false,
          hasCreatedBoard: false,
          hasJoinedSharedBoard: false
        };
      }

      // Get all tags for this user (represents private boards/hashtags)
      const tags = await this.storage.getTags(user.id);
      
      // Get shared boards where user is a member
      const sharedBoards = await this.storage.getUserBoardMemberships(user.id);
      
      const privateBoardCount = tags.length;
      const sharedBoardCount = sharedBoards.length;
      const totalBoards = privateBoardCount + sharedBoardCount;

      return {
        totalBoards,
        privateBoardCount,
        sharedBoardCount,
        hasSharedBoards: sharedBoardCount > 0,
        hasCreatedBoard: privateBoardCount > 0,
        hasJoinedSharedBoard: sharedBoardCount > 0
      };
    } catch (error) {
      log(`Error getting content stats for ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
      // Return empty stats on error
      return {
        totalBoards: 0,
        privateBoardCount: 0,
        sharedBoardCount: 0,
        hasSharedBoards: false,
        hasCreatedBoard: false,
        hasJoinedSharedBoard: false
      };
    }
  }

  /**
   * Calculate days since last web visit
   * Uses lastLoginAt from user record as proxy for web activity
   */
  async getDaysSinceLastWebVisit(phoneNumber: string): Promise<number | null> {
    try {
      const user = await this.storage.getUserByPhoneNumber(phoneNumber);
      if (!user || !user.lastLoginAt) {
        return null;
      }

      const now = new Date();
      const lastLogin = new Date(user.lastLoginAt);
      const daysSince = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
      
      return daysSince;
    } catch (error) {
      log(`Error getting days since last web visit for ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Build complete Pendo visitor metadata for a user
   * This is the main function that combines all stats
   */
  async buildVisitorMetadata(phoneNumber: string): Promise<PendoVisitorMetadata | null> {
    try {
      // Get user record
      const user = await this.storage.getUserByPhoneNumber(phoneNumber);
      if (!user) {
        log(`User not found for phone ${phoneNumber}`);
        return null;
      }

      // Get SMS activity stats
      const smsStats = await this.getSMSActivityStats(phoneNumber);
      
      // Get web activity
      const daysSinceLastWebVisit = await this.getDaysSinceLastWebVisit(phoneNumber);
      
      // Calculate platform preference
      const platformPref = this.calculatePlatformPreference(
        smsStats.last30Days,
        daysSinceLastWebVisit
      );
      
      // Calculate engagement level
      const engagementLevel = this.calculateEngagementLevel(
        smsStats.last30Days,
        daysSinceLastWebVisit
      );
      
      // Get content stats
      const contentStats = await this.getContentStats(phoneNumber);
      
      // Calculate days since signup
      const daysSinceSignup = Math.floor(
        (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Build complete metadata object
      const metadata: PendoVisitorMetadata = {
        // Basic user info
        phone: phoneNumber,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        
        // Signup info
        signupDate: new Date(user.createdAt).toISOString(),
        signupMethod: user.signupMethod || 'direct',
        daysSinceSignup,
        
        // SMS activity metadata
        lastSmsDate: smsStats.lastMessageDate ? smsStats.lastMessageDate.toISOString() : null,
        totalSmsMessages: smsStats.totalMessages,
        smsMessagesLast7Days: smsStats.last7Days,
        smsMessagesLast30Days: smsStats.last30Days,
        daysSinceLastSms: smsStats.daysSinceLastSms,
        
        // Web activity metadata
        daysSinceLastWebVisit,
        
        // Platform preference
        primaryPlatform: platformPref.primaryPlatform,
        smsActivityPercentage: platformPref.smsPercentage,
        
        // Engagement level
        engagementLevel,
        
        // Content stats
        ...contentStats,
        
        // System
        profileLastUpdated: new Date().toISOString()
      };

      return metadata;
    } catch (error) {
      log(`Error building visitor metadata for ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}

export const createPendoProfileService = (storage: IStorage) => {
  return new PendoProfileService(storage);
};
