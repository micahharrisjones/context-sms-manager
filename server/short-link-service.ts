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
   * Create a short link for a given URL
   * Returns the short code (not the full URL)
   */
  async createShortLink(targetUrl: string): Promise<string> {
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
