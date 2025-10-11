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

// Cache entry with metadata
interface CacheEntry {
  data: OpenGraphData | null;
  timestamp: number;
  isFailure: boolean;
  retryCount?: number;
}

// Service for fetching Open Graph metadata from websites
class OpenGraphService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly FAILURE_CACHE_TTL = 60 * 60 * 1000; // 1 hour for failures
  private readonly MAX_RETRIES = 3;

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

  // Extract product data from JSON-LD object (handles deeply nested structures)
  private extractProductFromJsonLd(data: any, ogData: OpenGraphData, visited = new Set<any>()): void {
    // Prevent infinite loops in circular references
    if (!data || typeof data !== 'object' || visited.has(data)) {
      return;
    }
    visited.add(data);
    
    // Check if this is a Product
    const isProduct = data['@type'] === 'Product' || 
                     (Array.isArray(data['@type']) && data['@type'].includes('Product'));
    
    if (isProduct) {
      if (!ogData.title && data.name) {
        ogData.title = this.decodeHtmlEntities(data.name);
      }
      if (!ogData.description && data.description) {
        ogData.description = this.decodeHtmlEntities(data.description);
      }
      if (!ogData.image && data.image) {
        // Handle both string and array of images
        const imageUrl = Array.isArray(data.image) ? data.image[0] : data.image;
        // Handle both direct URLs and ImageObject with multiple field names
        if (typeof imageUrl === 'string') {
          ogData.image = imageUrl;
        } else if (imageUrl) {
          ogData.image = imageUrl.url || imageUrl.contentUrl || imageUrl.thumbnailUrl;
        }
      }
      if (!ogData.site_name && data.brand) {
        ogData.site_name = typeof data.brand === 'string' ? data.brand : data.brand?.name;
      }
    }
    
    // Look for organization/website info
    if (!ogData.site_name && (data['@type'] === 'WebSite' || data['@type'] === 'Organization')) {
      if (data.name) {
        ogData.site_name = this.decodeHtmlEntities(data.name);
      }
    }
    
    // Recursively traverse all properties to find nested Product objects
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        const value = data[key];
        
        if (Array.isArray(value)) {
          // Traverse arrays
          for (const item of value) {
            this.extractProductFromJsonLd(item, ogData, visited);
          }
        } else if (typeof value === 'object' && value !== null) {
          // Traverse nested objects
          this.extractProductFromJsonLd(value, ogData, visited);
        }
      }
    }
  }

  // Parse JSON-LD structured data (used by e-commerce sites like Home Depot)
  private parseJsonLd(html: string): OpenGraphData {
    const ogData: OpenGraphData = {};
    
    try {
      // Find all JSON-LD script tags
      const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const jsonData = JSON.parse(match[1]);
          
          // Handle both single objects and arrays
          const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
          
          for (const data of dataArray) {
            this.extractProductFromJsonLd(data, ogData);
          }
        } catch (parseError) {
          // Skip invalid JSON-LD blocks
          continue;
        }
      }
    } catch (error) {
      // If JSON-LD parsing fails, just return empty data
      log('JSON-LD parsing error:', error instanceof Error ? error.message : String(error));
    }
    
    return ogData;
  }

  // Discover oEmbed endpoint from HTML link tags
  private discoverOembedEndpoint(html: string): string | null {
    // Look for oEmbed discovery links (JSON format preferred over XML)
    const jsonOembedRegex = /<link[^>]*type=["']application\/json\+oembed["'][^>]*href=["']([^"']+)["'][^>]*>/i;
    const xmlOembedRegex = /<link[^>]*type=["'](?:text\/xml|application\/xml)\+oembed["'][^>]*href=["']([^"']+)["'][^>]*>/i;
    
    // Try JSON format first
    let match = html.match(jsonOembedRegex);
    if (match) {
      return match[1];
    }
    
    // Fallback to XML format
    match = html.match(xmlOembedRegex);
    if (match) {
      return match[1];
    }
    
    return null;
  }

  // Fetch and parse oEmbed data
  private async fetchOembed(endpoint: string): Promise<OpenGraphData> {
    const ogData: OpenGraphData = {};
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        log(`oEmbed fetch failed: ${response.status} ${response.statusText}`);
        return ogData;
      }

      const data = await response.json();
      
      // Extract relevant data from oEmbed response
      if (data.title) {
        ogData.title = this.decodeHtmlEntities(data.title);
      }
      
      if (data.author_name) {
        ogData.description = `By ${data.author_name}`;
      }
      
      // oEmbed can provide thumbnail_url or url for images
      if (data.thumbnail_url) {
        ogData.image = data.thumbnail_url;
      } else if (data.url && data.type === 'photo') {
        ogData.image = data.url;
      }
      
      if (data.provider_name) {
        ogData.site_name = data.provider_name;
      }
      
    } catch (error) {
      log('oEmbed fetch error:', error instanceof Error ? error.message : String(error));
    }
    
    return ogData;
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
    
    // Fallback to JSON-LD structured data (for e-commerce sites like Home Depot)
    if (!ogData.title || !ogData.description || !ogData.image) {
      const jsonLdData = this.parseJsonLd(html);
      if (!ogData.title && jsonLdData.title) ogData.title = jsonLdData.title;
      if (!ogData.description && jsonLdData.description) ogData.description = jsonLdData.description;
      if (!ogData.image && jsonLdData.image) ogData.image = jsonLdData.image;
      if (!ogData.site_name && jsonLdData.site_name) ogData.site_name = jsonLdData.site_name;
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

  // Sleep function for retry delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if cache entry is still valid
  private isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const ttl = entry.isFailure ? this.FAILURE_CACHE_TTL : this.CACHE_TTL;
    return (now - entry.timestamp) < ttl;
  }

  // Main function to fetch Open Graph data
  async fetchOpenGraph(url: string): Promise<OpenGraphData | null> {
    // Check cache first
    const cached = this.cache.get(url);
    if (cached && this.isCacheValid(cached)) {
      // For failures, check if we should retry
      if (cached.isFailure && (cached.retryCount || 0) < this.MAX_RETRIES) {
        // Allow retry for failed URLs after some time
      } else {
        return cached.data;
      }
    }

    // Attempt to fetch with retries
    const retryCount = cached?.retryCount || 0;
    return this.fetchWithRetry(url, retryCount);
  }

  // Fetch with retry logic and exponential backoff
  private async fetchWithRetry(url: string, currentRetry: number = 0): Promise<OpenGraphData | null> {
    try {
      log(`Fetching Open Graph data for: ${url} (attempt ${currentRetry + 1}/${this.MAX_RETRIES + 1})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased timeout

      const response = await fetch(url, {
        headers: {
          // Updated to latest Chrome user agent
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'DNT': '1', // Do Not Track
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check if it's worth retrying based on status code
        const shouldRetry = this.shouldRetryStatus(response.status);
        if (shouldRetry && currentRetry < this.MAX_RETRIES) {
          log(`HTTP ${response.status} for ${url}, retrying...`);
          await this.sleep(this.getRetryDelay(currentRetry));
          return this.fetchWithRetry(url, currentRetry + 1);
        }
        
        log(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        this.cacheFailure(url, currentRetry);
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('text/html')) {
        log(`URL ${url} is not HTML content: ${contentType}`);
        this.cacheFailure(url, currentRetry);
        return null;
      }

      const html = await response.text();
      const ogData = this.parseOpenGraph(html);

      // If we're still missing data, try oEmbed discovery
      if (!ogData.title || !ogData.description || !ogData.image) {
        const oembedEndpoint = this.discoverOembedEndpoint(html);
        if (oembedEndpoint) {
          log(`Found oEmbed endpoint for ${url}: ${oembedEndpoint}`);
          const oembedData = await this.fetchOembed(oembedEndpoint);
          
          // Merge oEmbed data with existing data (oEmbed fills in gaps)
          if (!ogData.title && oembedData.title) ogData.title = oembedData.title;
          if (!ogData.description && oembedData.description) ogData.description = oembedData.description;
          if (!ogData.image && oembedData.image) ogData.image = oembedData.image;
          if (!ogData.site_name && oembedData.site_name) ogData.site_name = oembedData.site_name;
        }
      }

      // Make image URLs absolute
      if (ogData.image) {
        ogData.image = this.makeAbsoluteUrl(ogData.image, url);
      }

      // Cache the successful result
      this.cacheSuccess(url, ogData);
      
      log(`Successfully fetched Open Graph data for ${url}: ${JSON.stringify(ogData)}`);
      return ogData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log(`Error fetching Open Graph data for ${url}:`, errorMessage);
      
      // Retry on network errors if we haven't exceeded max retries
      if (this.shouldRetryError(error) && currentRetry < this.MAX_RETRIES) {
        log(`Network error for ${url}, retrying...`);
        await this.sleep(this.getRetryDelay(currentRetry));
        return this.fetchWithRetry(url, currentRetry + 1);
      }
      
      this.cacheFailure(url, currentRetry);
      return null;
    }
  }

  // Helper methods for retry logic
  private shouldRetryStatus(status: number): boolean {
    // Retry on server errors and rate limits, not on client errors
    return status >= 500 || status === 429 || status === 408; // Server errors, rate limit, timeout
  }

  private shouldRetryError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    
    // Retry on network errors but not on parsing errors
    const retryableErrors = [
      'ECONNRESET',
      'ECONNREFUSED', 
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'AbortError'
    ];
    
    return retryableErrors.some(code => error.message.includes(code));
  }

  private getRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  private cacheSuccess(url: string, data: OpenGraphData): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      isFailure: false
    };
    
    this.cache.set(url, entry);
    
    // Set up cache cleanup after TTL
    setTimeout(() => {
      if (this.cache.get(url) === entry) {
        this.cache.delete(url);
      }
    }, this.CACHE_TTL);
  }

  private cacheFailure(url: string, retryCount: number): void {
    const entry: CacheEntry = {
      data: null,
      timestamp: Date.now(),
      isFailure: true,
      retryCount
    };
    
    this.cache.set(url, entry);
    
    // Set up cache cleanup after shorter TTL for failures
    setTimeout(() => {
      if (this.cache.get(url) === entry) {
        this.cache.delete(url);
      }
    }, this.FAILURE_CACHE_TTL);
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