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
   * @param redirectUrl - Optional URL to redirect to after login (internal paths only)
   * @returns The full magic link URL and the token
   * @throws Error if rate limit exceeded or invalid redirect URL
   */
  static async createMagicLink(userId: number, redirectUrl?: string): Promise<{ url: string; token: string }> {
    try {
      // Validate redirect URL if provided (security: only allow internal paths)
      if (redirectUrl && !this.isValidRedirectUrl(redirectUrl)) {
        log(`Invalid redirect URL rejected: ${redirectUrl}`);
        throw new Error("Invalid redirect URL");
      }
      
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
      
      // Store in database with optional redirect URL
      await storage.createMagicLinkToken({
        token,
        userId,
        expiresAt,
        used: "false",
        redirectUrl: redirectUrl || null
      });
      
      // Construct the URL
      const baseUrl = 'https://textaside.app';
      const url = `${baseUrl}/auth/${token}`;
      
      log(`Created magic link for user ${userId}${redirectUrl ? ` with redirect to ${redirectUrl}` : ''}: expires at ${expiresAt.toISOString()}`);
      
      return { url, token };
    } catch (error) {
      log("Error creating magic link:", error instanceof Error ? error.message : String(error));
      throw new Error("Failed to create magic link");
    }
  }

  /**
   * Validate a redirect URL for security (prevent open redirect attacks)
   * Only allow internal paths starting with / (no external URLs)
   */
  private static isValidRedirectUrl(redirectUrl: string): boolean {
    // Must start with / (internal path)
    if (!redirectUrl.startsWith('/')) {
      return false;
    }
    
    // Must not be a protocol-relative URL (//example.com)
    if (redirectUrl.startsWith('//')) {
      return false;
    }
    
    // Must not contain backslashes (common bypass technique)
    if (redirectUrl.includes('\\')) {
      return false;
    }
    
    // Allowlist specific paths
    const allowedPrefixes = ['/search', '/board/', '/invite/', '/'];
    return allowedPrefixes.some(prefix => redirectUrl.startsWith(prefix));
  }

  /**
   * Validate and consume a magic link token
   * @param token - The token to validate
   * @returns Object with userId and redirectUrl if valid, undefined if invalid/expired/used
   */
  static async validateAndConsumeToken(token: string): Promise<{ userId: number; redirectUrl?: string | null } | undefined> {
    try {
      // Get the token from database
      const magicToken = await storage.getValidMagicLinkToken(token);
      
      if (!magicToken) {
        log(`Invalid or expired magic link token: ${token.substring(0, 10)}...`);
        return undefined;
      }
      
      // Mark token as used (one-time use)
      await storage.markTokenAsUsed(magicToken.id);
      
      log(`Magic link token validated and consumed for user ${magicToken.userId}${magicToken.redirectUrl ? ` with redirect to ${magicToken.redirectUrl}` : ''}`);
      
      return {
        userId: magicToken.userId,
        redirectUrl: magicToken.redirectUrl
      };
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
