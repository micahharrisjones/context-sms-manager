import crypto from "crypto";
import { storage } from "./storage";
import { log } from "./vite";

/**
 * MagicLinkService - Generates secure, time-limited, one-time use magic links
 * Replaces the insecure phone-based auto-login with cryptographic tokens
 */
export class MagicLinkService {
  private static readonly TOKEN_EXPIRY_MINUTES = 30;
  private static readonly TOKEN_LENGTH = 32; // 32 bytes = 64 hex characters
  private static readonly MAX_TOKENS_PER_HOUR = 5; // Rate limit: max 5 tokens per user per hour
  private static readonly RATE_LIMIT_WINDOW_MINUTES = 60;

  /**
   * Generate a cryptographically secure random token
   */
  private static generateSecureToken(): string {
    return crypto.randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Create a magic link for a user
   * @param userId - The user ID to create the magic link for
   * @returns The full magic link URL and the token
   * @throws Error if rate limit exceeded
   */
  static async createMagicLink(userId: number): Promise<{ url: string; token: string }> {
    try {
      // Rate limiting: Check if user has exceeded token generation limit
      const recentTokenCount = await storage.getRecentTokenCount(userId, this.RATE_LIMIT_WINDOW_MINUTES);
      
      if (recentTokenCount >= this.MAX_TOKENS_PER_HOUR) {
        log(`Rate limit exceeded for user ${userId}: ${recentTokenCount} tokens in last hour`);
        throw new Error("Too many magic links generated. Please try again later.");
      }
      
      // Generate secure token
      const token = this.generateSecureToken();
      
      // Calculate expiry time
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY_MINUTES * 60 * 1000);
      
      // Store in database
      await storage.createMagicLinkToken({
        token,
        userId,
        expiresAt,
        used: "false"
      });
      
      // Construct the URL
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : 'https://textaside.app';
      
      const url = `${baseUrl}/auth/${token}`;
      
      log(`Created magic link for user ${userId}: expires at ${expiresAt.toISOString()}`);
      
      return { url, token };
    } catch (error) {
      log("Error creating magic link:", error instanceof Error ? error.message : String(error));
      throw new Error("Failed to create magic link");
    }
  }

  /**
   * Validate and consume a magic link token
   * @param token - The token to validate
   * @returns The user ID if valid, undefined if invalid/expired/used
   */
  static async validateAndConsumeToken(token: string): Promise<number | undefined> {
    try {
      // Get the token from database
      const magicToken = await storage.getValidMagicLinkToken(token);
      
      if (!magicToken) {
        log(`Invalid or expired magic link token: ${token.substring(0, 10)}...`);
        return undefined;
      }
      
      // Mark token as used (one-time use)
      await storage.markTokenAsUsed(magicToken.id);
      
      log(`Magic link token validated and consumed for user ${magicToken.userId}`);
      
      return magicToken.userId;
    } catch (error) {
      log("Error validating magic link token:", error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  /**
   * Clean up expired and used tokens
   * Should be called periodically (e.g., via cron job)
   */
  static async cleanupExpiredTokens(): Promise<void> {
    try {
      await storage.cleanupExpiredTokens();
      log("Successfully cleaned up expired magic link tokens");
    } catch (error) {
      log("Error cleaning up expired tokens:", error instanceof Error ? error.message : String(error));
    }
  }
}
