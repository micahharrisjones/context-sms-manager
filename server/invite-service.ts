import { storage } from "./storage";
import { log } from "./vite";
import type { Invite, InsertInvite } from "@shared/schema";

export class InviteService {
  /**
   * Generate a unique 5-character invite code (alphanumeric)
   */
  static generateInviteCode(): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
  }

  /**
   * Create a new invite and return the code
   */
  static async createInvite(userId: number, type: 'sms_link' | 'web' | 'qr' = 'sms_link'): Promise<Invite> {
    try {
      // Generate unique code (retry if collision)
      let code = this.generateInviteCode();
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const existing = await storage.getInviteByCode(code);
        if (!existing) {
          break; // Code is unique
        }
        code = this.generateInviteCode();
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique invite code");
      }

      const inviteData: InsertInvite = {
        code,
        invitedBy: userId,
        type,
      };

      const invite = await storage.createInvite(inviteData);
      log(`✉️ Created invite code "${code}" for user ${userId} (type: ${type})`);
      
      return invite;
    } catch (error) {
      log(`Error creating invite: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get invite by code
   */
  static async getInviteByCode(code: string): Promise<Invite | null> {
    try {
      return await storage.getInviteByCode(code);
    } catch (error) {
      log(`Error getting invite by code: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Track invite conversion when a user signs up via invite link
   */
  static async trackConversion(inviteCode: string, newUserId: number): Promise<void> {
    try {
      const invite = await this.getInviteByCode(inviteCode);
      
      if (!invite) {
        log(`Warning: Invite code "${inviteCode}" not found for conversion tracking`);
        return;
      }

      // Increment conversion count
      await storage.incrementInviteConversions(invite.id);
      
      // Update user's referral information
      await storage.updateUserReferral(newUserId, inviteCode, 'invite_link');
      
      log(`🎉 Conversion tracked: User ${newUserId} signed up via invite "${inviteCode}" from user ${invite.invitedBy}`);
    } catch (error) {
      log(`Error tracking invite conversion: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get invite URL for a code
   */
  static getInviteUrl(code: string): string {
    const baseUrl = process.env.REPL_SLUG 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'https://textaside.app';
    
    return `${baseUrl}/join/${code}`;
  }

  /**
   * Generate shareable invite message for SMS
   */
  static getInviteMessage(code: string): string {
    const url = this.getInviteUrl(code);
    
    return `Hey! I've been using Aside to save links and ideas by texting. Super simple - no app needed.

Try it: ${url}`;
  }
}

export const inviteService = InviteService;
