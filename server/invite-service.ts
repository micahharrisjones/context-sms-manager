import { log } from "./vite";

/**
 * InviteService - Simplified for standard /join page
 * No longer generates unique codes - everyone uses textaside.app/join
 */
export class InviteService {
  /**
   * Get standard invite URL (no unique codes)
   */
  static getInviteUrl(): string {
    return 'https://textaside.app/join';
  }

  /**
   * Generate standard invite message for SMS
   */
  static getInviteMessage(): string {
    return `Try Aside! Save links and ideas by text - no app needed. Sign up here: ${this.getInviteUrl()}`;
  }
}

export const inviteService = InviteService;
