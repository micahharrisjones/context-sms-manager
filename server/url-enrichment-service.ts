import { log } from "./vite";

export interface EnrichmentData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export class UrlEnrichmentService {
  private openGraphService: any;

  constructor(openGraphService: any) {
    this.openGraphService = openGraphService;
  }

  extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  }

  async enrichUrl(url: string): Promise<EnrichmentData | null> {
    try {
      log(`[Enrichment] ========== Starting fill-the-gaps enrichment for: ${url} ==========`);

      let result: EnrichmentData = {};
      const shouldUseMicrolinkFirst = this.shouldUseMicrolinkFirst(url);
      
      // Method 1: Microlink (good for most sites, especially bot-blocking ones)
      if (shouldUseMicrolinkFirst) {
        log(`[Enrichment] → Method 1: Trying Microlink FIRST for bot-blocking platform`);
        const microlinkData = await this.openGraphService.fetchOpenGraph(url);
        if (microlinkData) {
          result = this.mergeData(result, {
            title: microlinkData.title,
            description: microlinkData.description,
            image: microlinkData.image,
            siteName: microlinkData.site_name
          });
          this.logDataStatus(result, 'Microlink');
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data from Microlink - stopping early`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ Microlink returned no data`);
        }
      }

      // Method 2: Platform-specific extraction (e.g., YouTube API)
      if (!this.isComplete(result)) {
        log(`[Enrichment] → Method 2: Trying platform-specific extraction`);
        const platformData = await this.tryPlatformSpecific(url);
        if (platformData) {
          result = this.mergeData(result, platformData);
          this.logDataStatus(result, 'Platform-specific');
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data after platform-specific - stopping early`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ Platform-specific extraction returned no data`);
        }
      }

      // Method 3: Direct HTML parsing (good for e-commerce sites)
      if (!this.isComplete(result)) {
        log(`[Enrichment] → Method 3: Trying direct HTML parsing`);
        const htmlData = await this.tryDirectParsing(url);
        if (htmlData) {
          result = this.mergeData(result, htmlData);
          this.logDataStatus(result, 'Direct HTML parsing');
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data after direct parsing - stopping early`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ Direct HTML parsing returned no data`);
        }
      }

      // Method 4: oEmbed discovery
      if (!this.isComplete(result)) {
        log(`[Enrichment] → Method 4: Trying oEmbed discovery`);
        const oembedData = await this.tryOembed(url);
        if (oembedData) {
          result = this.mergeData(result, oembedData);
          this.logDataStatus(result, 'oEmbed');
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data after oEmbed - stopping early`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ oEmbed discovery returned no data`);
        }
      }

      // Method 5: Microlink fallback (if not already tried)
      if (!shouldUseMicrolinkFirst && !this.isComplete(result)) {
        log(`[Enrichment] → Method 5: Trying Microlink as fallback`);
        const microlinkData = await this.openGraphService.fetchOpenGraph(url);
        if (microlinkData) {
          result = this.mergeData(result, {
            title: microlinkData.title,
            description: microlinkData.description,
            image: microlinkData.image,
            siteName: microlinkData.site_name
          });
          this.logDataStatus(result, 'Microlink fallback');
        } else {
          log(`[Enrichment] ✗ Microlink fallback returned no data`);
        }
      }

      // Final result - return whatever we found, even if incomplete
      if (!result.title && !result.description && !result.image) {
        log(`[Enrichment] ✗✗✗ FAILED - No metadata found after trying all methods`);
        return null;
      }

      if (this.isComplete(result)) {
        log(`[Enrichment] ✓✓✓ SUCCESS - Complete data: title + description + image`);
      } else {
        const missing = [];
        if (!result.title) missing.push('title');
        if (!result.description) missing.push('description');
        if (!result.image) missing.push('image');
        log(`[Enrichment] ⚠ PARTIAL - Missing: ${missing.join(', ')}`);
      }

      return result;
    } catch (error) {
      log(`[Enrichment] EXCEPTION enriching ${url}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private isComplete(data: EnrichmentData): boolean {
    return !!(data.title && data.description && data.image);
  }

  private mergeData(existing: EnrichmentData, newData: EnrichmentData | null): EnrichmentData {
    if (!newData) return existing;
    
    return {
      title: existing.title || newData.title,
      description: existing.description || newData.description,
      image: existing.image || newData.image,
      siteName: existing.siteName || newData.siteName
    };
  }

  private logDataStatus(data: EnrichmentData, source: string): void {
    const parts = [];
    if (data.title) parts.push('✓ title');
    if (data.description) parts.push('✓ description');
    if (data.image) parts.push('✓ image');
    if (data.siteName) parts.push('✓ siteName');
    
    log(`[Enrichment] After ${source}: [${parts.join(', ')}]`);
  }

  private shouldUseMicrolinkFirst(url: string): boolean {
    const botBlockingDomains = [
      'x.com',
      'twitter.com',
      'reddit.com',
      'instagram.com',
      'facebook.com',
      'tiktok.com',
      'linkedin.com',
      'imdb.com'
    ];
    
    try {
      const urlObj = new URL(url);
      return botBlockingDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  private async tryPlatformSpecific(url: string): Promise<EnrichmentData | null> {
    // YouTube
    const youtubeId = this.extractYouTubeId(url);
    if (youtubeId) {
      return await this.enrichYouTube(youtubeId);
    }

    // For other platforms (Instagram, Twitter, TikTok, etc.), we use embeds
    // They don't provide easy metadata APIs, so we'll let them fall through
    // to oEmbed or HTML parsing
    
    return null;
  }

  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  private async enrichYouTube(videoId: string): Promise<EnrichmentData | null> {
    try {
      // Use YouTube oEmbed (free, no API key required)
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return {
        title: data.title,
        description: `By ${data.author_name}`,
        image: data.thumbnail_url,
        siteName: 'YouTube'
      };
    } catch (error) {
      log('[Enrichment] YouTube oEmbed failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private async tryOembed(url: string): Promise<EnrichmentData | null> {
    try {
      // First, fetch the HTML to discover oEmbed endpoint
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const html = await response.text();
      const oembedEndpoint = this.discoverOembedEndpoint(html);
      
      if (!oembedEndpoint) return null;

      // Fetch oEmbed data
      const oembedResponse = await fetch(oembedEndpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!oembedResponse.ok) return null;

      const data = await oembedResponse.json();
      return {
        title: data.title,
        description: data.description || (data.author_name ? `By ${data.author_name}` : undefined),
        image: data.thumbnail_url || data.url,
        siteName: data.provider_name
      };
    } catch (error) {
      log('[Enrichment] oEmbed discovery failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private discoverOembedEndpoint(html: string): string | null {
    const jsonOembedRegex = /<link[^>]*type=["']application\/json\+oembed["'][^>]*href=["']([^"']+)["'][^>]*>/i;
    const xmlOembedRegex = /<link[^>]*type=["'](?:text\/xml|application\/xml)\+oembed["'][^>]*href=["']([^"']+)["'][^>]*>/i;
    
    let match = html.match(jsonOembedRegex);
    if (match) return match[1];
    
    match = html.match(xmlOembedRegex);
    if (match) return match[1];
    
    return null;
  }

  private async tryDirectParsing(url: string): Promise<EnrichmentData | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const html = await response.text();
      return this.parseOpenGraphFromHtml(html);
    } catch (error) {
      log('[Enrichment] Direct HTML parsing failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private parseOpenGraphFromHtml(html: string): EnrichmentData | null {
    const data: EnrichmentData = {};
    
    // Extract Open Graph tags
    const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]+)"/gi;
    let match;
    
    while ((match = ogRegex.exec(html)) !== null) {
      const property = match[1];
      const content = match[2];
      
      switch (property) {
        case 'title':
          data.title = this.decodeHtmlEntities(content);
          break;
        case 'description':
          data.description = this.decodeHtmlEntities(content);
          break;
        case 'image':
          data.image = content;
          break;
        case 'site_name':
          data.siteName = this.decodeHtmlEntities(content);
          break;
      }
    }

    // Fallback to Twitter Card tags
    if (!data.title || !data.description || !data.image) {
      const twitterRegex = /<meta\s+name="twitter:([^"]+)"\s+content="([^"]+)"/gi;
      
      while ((match = twitterRegex.exec(html)) !== null) {
        const property = match[1];
        const content = match[2];
        
        switch (property) {
          case 'title':
            if (!data.title) data.title = this.decodeHtmlEntities(content);
            break;
          case 'description':
            if (!data.description) data.description = this.decodeHtmlEntities(content);
            break;
          case 'image':
            if (!data.image) data.image = content;
            break;
        }
      }
    }

    // Fallback to basic HTML tags
    if (!data.title) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) {
        data.title = this.decodeHtmlEntities(titleMatch[1]);
      }
    }

    if (!data.description) {
      const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      if (descMatch) {
        data.description = this.decodeHtmlEntities(descMatch[1]);
      }
    }

    // Return null if we couldn't extract anything useful
    if (!data.title && !data.description && !data.image) {
      return null;
    }

    return data;
  }

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
}
