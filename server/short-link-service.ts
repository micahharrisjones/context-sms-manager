import { db } from './db';
import { shortLinks, type InsertShortLink, type ShortLink } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const log = (...args: any[]) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [ShortLink]`, ...args);
};

export class ShortLinkService {
  private static readonly CODE_LENGTH = 6;
  private static readonly CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  /**
   * Generate a random 6-character alphanumeric code
   */
  private generateCode(): string {
    let code = '';
    for (let i = 0; i < ShortLinkService.CODE_LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * ShortLinkService.CHARSET.length);
      code += ShortLinkService.CHARSET[randomIndex];
    }
    return code;
  }

  /**
   * Validate URL is safe for redirection
   * Only allows http/https schemes and approved domains to prevent open redirect abuse
   */
  private validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https schemes to prevent javascript:, data:, file:, etc.
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        log(`Invalid URL scheme rejected: ${parsed.protocol}`);
        return false;
      }

      // Allowlist of approved domains (our own domain and localhost for development)
      const allowedDomains = [
        'textaside.app',
        'localhost',
        '127.0.0.1',
      ];

      // Also allow Replit development domains
      if (process.env.REPLIT_DOMAINS) {
        const replitDomains = process.env.REPLIT_DOMAINS.split(',');
        allowedDomains.push(...replitDomains);
      }

      // Check if hostname matches any allowed domain (including subdomains)
      const hostname = parsed.hostname.toLowerCase();
      const isAllowed = allowedDomains.some(domain => {
        const normalizedDomain = domain.toLowerCase();
        return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
      });

      if (!isAllowed) {
        log(`Domain not in allowlist rejected: ${hostname}`);
        return false;
      }

      return true;
    } catch (error) {
      log(`Invalid URL format: ${url}`);
      return false;
    }
  }

  /**
   * Create a short link for a given URL
   * Returns the short code (not the full URL)
   * Validates URL to prevent open redirect vulnerabilities
   */
  async createShortLink(targetUrl: string): Promise<string> {
    // Validate URL before creating short link
    if (!this.validateUrl(targetUrl)) {
      throw new Error(`Invalid or unsafe URL: ${targetUrl}`);
    }

    // Generate a unique code (retry if collision occurs)
    let code = this.generateCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      try {
        const shortLink: InsertShortLink = {
          code,
          targetUrl,
        };

        await db.insert(shortLinks).values(shortLink);
        log(`Created short link: ${code} -> ${targetUrl}`);
        return code;
      } catch (error) {
        // If code already exists, generate a new one
        if (error instanceof Error && error.message.includes('unique')) {
          code = this.generateCode();
          attempts++;
          log(`Code collision, retrying... (attempt ${attempts}/${maxAttempts})`);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Failed to generate unique short link code after multiple attempts');
  }

  /**
   * Look up a short link by code
   * Returns null if not found
   */
  async getShortLink(code: string): Promise<ShortLink | null> {
    const results = await db
      .select()
      .from(shortLinks)
      .where(eq(shortLinks.code, code))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Increment click count for a short link
   */
  async incrementClickCount(code: string): Promise<void> {
    await db
      .update(shortLinks)
      .set({ 
        clickCount: sql`${shortLinks.clickCount} + 1` 
      })
      .where(eq(shortLinks.code, code));
    
    log(`Incremented click count for ${code}`);
  }

  /**
   * Create a full short URL from a code
   */
  getShortUrl(code: string): string {
    // Use the production domain or fallback to localhost for dev
    const domain = process.env.REPLIT_DOMAINS 
      ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
      : 'http://localhost:5000';
    
    return `${domain}/s/${code}`;
  }
}

// Export a singleton instance
export const shortLinkService = new ShortLinkService();
