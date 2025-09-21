import { log } from "./vite";

// Open Graph data interface
interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  site_name?: string;
  type?: string;
}

// Service for fetching Open Graph metadata from websites
class OpenGraphService {
  private cache = new Map<string, OpenGraphData>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  // Decode HTML entities in text content
  private decodeHtmlEntities(text: string): string {
    const entityMap: { [key: string]: string } = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x60;': '`',
      '&#x3D;': '=',
      '&nbsp;': ' ',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
      '&mdash;': '—',
      '&ndash;': '–',
      '&ldquo;': '"',
      '&rdquo;': '"',
      '&lsquo;': "'",
      '&rsquo;': "'",
      '&hellip;': '…'
    };
    
    return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => {
      return entityMap[entity] || entity;
    });
  }

  // Extract Open Graph metadata from HTML
  private parseOpenGraph(html: string): OpenGraphData {
    const ogData: OpenGraphData = {};
    
    // Regular expressions to match Open Graph meta tags
    const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/gi;
    const twitterRegex = /<meta\s+name="twitter:([^"]+)"\s+content="([^"]+)"/gi;
    const titleRegex = /<title[^>]*>([^<]+)<\/title>/i;
    const descRegex = /<meta\s+name="description"\s+content="([^"]+)"/i;
    
    let match;
    
    // Extract Open Graph tags
    while ((match = ogRegex.exec(html)) !== null) {
      const property = match[1];
      const content = match[2];
      
      switch (property) {
        case 'title':
          ogData.title = this.decodeHtmlEntities(content);
          break;
        case 'description':
          ogData.description = this.decodeHtmlEntities(content);
          break;
        case 'image':
          ogData.image = content;
          break;
        case 'url':
          ogData.url = content;
          break;
        case 'site_name':
          ogData.site_name = this.decodeHtmlEntities(content);
          break;
        case 'type':
          ogData.type = content;
          break;
      }
    }
    
    // Fallback to Twitter Card tags if no Open Graph data
    if (!ogData.title || !ogData.description || !ogData.image) {
      while ((match = twitterRegex.exec(html)) !== null) {
        const property = match[1];
        const content = match[2];
        
        switch (property) {
          case 'title':
            if (!ogData.title) ogData.title = this.decodeHtmlEntities(content);
            break;
          case 'description':
            if (!ogData.description) ogData.description = this.decodeHtmlEntities(content);
            break;
          case 'image':
            if (!ogData.image) ogData.image = content;
            break;
        }
      }
    }
    
    // Fallback to basic HTML tags
    if (!ogData.title) {
      const titleMatch = html.match(titleRegex);
      if (titleMatch) {
        ogData.title = this.decodeHtmlEntities(titleMatch[1].trim());
      }
    }
    
    if (!ogData.description) {
      const descMatch = html.match(descRegex);
      if (descMatch) {
        ogData.description = this.decodeHtmlEntities(descMatch[1].trim());
      }
    }
    
    return ogData;
  }

  // Convert relative URLs to absolute URLs
  private makeAbsoluteUrl(url: string, baseUrl: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    if (url.startsWith('//')) {
      const protocol = baseUrl.startsWith('https://') ? 'https:' : 'http:';
      return protocol + url;
    }
    
    if (url.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl);
      return `${baseUrlObj.protocol}//${baseUrlObj.host}${url}`;
    }
    
    // Relative path
    const baseUrlObj = new URL(baseUrl);
    const basePath = baseUrlObj.pathname.replace(/\/[^\/]*$/, '/');
    return `${baseUrlObj.protocol}//${baseUrlObj.host}${basePath}${url}`;
  }

  // Main function to fetch Open Graph data
  async fetchOpenGraph(url: string): Promise<OpenGraphData | null> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached) {
      return cached;
    }

    try {
      log(`Fetching Open Graph data for: ${url}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        log(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        log(`URL ${url} is not HTML content: ${contentType}`);
        return null;
      }

      const html = await response.text();
      const ogData = this.parseOpenGraph(html);

      // Make image URLs absolute
      if (ogData.image) {
        ogData.image = this.makeAbsoluteUrl(ogData.image, url);
      }

      // Cache the result
      this.cache.set(url, ogData);
      
      // Set up cache cleanup after TTL
      setTimeout(() => {
        this.cache.delete(url);
      }, this.CACHE_TTL);

      log(`Successfully fetched Open Graph data for ${url}: ${JSON.stringify(ogData)}`);
      return ogData;

    } catch (error) {
      log(`Error fetching Open Graph data for ${url}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  // Check if a URL should have Open Graph data fetched
  shouldFetchOpenGraph(url: string): boolean {
    try {
      const urlObj = new URL(url);
      
      // Only skip URLs that we have comprehensive embed support for
      // Allow Open Graph fallbacks for social media URLs where embed extraction might fail
      const alwaysSkipDomains = [
        'youtube.com',
        'youtu.be',
        'imdb.com', // We handle IMDB with TMDB
      ];
      
      return !alwaysSkipDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }
}

export const openGraphService = new OpenGraphService();