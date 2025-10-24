import { log } from "./vite";

export interface EnrichmentData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  isBlocked?: boolean; // Indicates preview was blocked by the site
  isFallback?: boolean; // Indicates we used domain-based fallback data
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
      log(`[Enrichment] ========== Starting smart platform routing for: ${url} ==========`);

      let result: EnrichmentData = {};
      
      // STEP 1: Check if URL is a supported free platform
      const platform = this.detectPlatform(url);
      
      if (platform) {
        log(`[Enrichment] → Detected platform: ${platform} - using free oEmbed API`);
        const platformData = await this.tryPlatformOembed(url, platform);
        if (platformData) {
          result = this.mergeData(result, platformData);
          this.logDataStatus(result, `${platform} oEmbed`);
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data from ${platform} oEmbed - stopping`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ ${platform} oEmbed failed - falling back to Microlink`);
        }
      }

      // STEP 2: For non-platform URLs or failed platform attempts, use Microlink
      if (!this.isComplete(result)) {
        log(`[Enrichment] → Using Microlink for ${platform ? 'fallback' : 'non-platform URL'}`);
        const microlinkData = await this.openGraphService.fetchOpenGraph(url);
        if (microlinkData) {
          result = this.mergeData(result, {
            title: microlinkData.title,
            description: microlinkData.description,
            image: microlinkData.image,
            siteName: microlinkData.site_name
          });
          this.logDataStatus(result, 'Microlink');
          
          // Check if the response indicates a blocked/access denied scenario
          if (this.isBlockedResponse(result)) {
            log(`[Enrichment] ⚠ Detected blocked/access denied response - using domain fallback`);
            const fallbackData = this.extractDomainFallback(url);
            if (fallbackData) {
              result = this.mergeData(fallbackData, result); // Use fallback for missing fields
              result.isBlocked = true;
              result.isFallback = true;
              // Clear the image so frontend shows placeholder icon instead
              result.image = undefined;
              log(`[Enrichment] ✓ Using domain fallback: ${result.title}`);
              return result;
            }
          }
          
          if (this.isComplete(result)) {
            log(`[Enrichment] ✓✓✓ COMPLETE data from Microlink - stopping`);
            return result;
          }
        } else {
          log(`[Enrichment] ✗ Microlink returned no data`);
        }
      }

      // STEP 3: If still incomplete, try remaining free methods
      if (!this.isComplete(result)) {
        log(`[Enrichment] → Trying direct HTML parsing as last resort`);
        const htmlData = await this.tryDirectParsing(url);
        if (htmlData) {
          result = this.mergeData(result, htmlData);
          this.logDataStatus(result, 'Direct HTML parsing');
        } else {
          log(`[Enrichment] ✗ Direct HTML parsing returned no data`);
        }
      }

      // STEP 4: If we still have no useful data or only blocked data, use domain fallback
      if (!result.title && !result.description && !result.image) {
        log(`[Enrichment] → No metadata found - using domain fallback`);
        const fallbackData = this.extractDomainFallback(url);
        if (fallbackData) {
          return { ...fallbackData, isFallback: true };
        }
        log(`[Enrichment] ✗✗✗ FAILED - Could not extract even domain info`);
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
      // Try domain fallback on exception
      const fallbackData = this.extractDomainFallback(url);
      if (fallbackData) {
        return { ...fallbackData, isFallback: true };
      }
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

  private detectPlatform(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Check for supported platforms with free oEmbed APIs
      if (hostname.includes('x.com') || hostname.includes('twitter.com')) return 'twitter';
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
      if (hostname.includes('vimeo.com')) return 'vimeo';
      if (hostname.includes('tiktok.com')) return 'tiktok';
      if (hostname.includes('reddit.com')) return 'reddit';
      if (hostname.includes('spotify.com') || hostname.includes('open.spotify.com')) return 'spotify';
      if (hostname.includes('soundcloud.com')) return 'soundcloud';
      if (hostname.includes('pinterest.com') || hostname.includes('pin.it')) return 'pinterest';
      if (hostname.includes('bsky.social') || hostname.includes('bsky.app')) return 'bluesky';
      
      return null;
    } catch {
      return null;
    }
  }

  private extractTweetTextFromHtml(html: string): string | undefined {
    try {
      // Twitter oEmbed returns HTML like: <blockquote class="twitter-tweet"><p>Tweet text here</p>...</blockquote>
      // Extract the text content from the <p> tag
      const pTagMatch = html.match(/<p[^>]*>(.*?)<\/p>/s);
      if (pTagMatch && pTagMatch[1]) {
        // Decode HTML entities and strip any remaining tags (br, a, etc)
        let text = pTagMatch[1]
          .replace(/<br\s*\/?>/gi, ' ') // Replace <br> with space
          .replace(/<a[^>]*>.*?<\/a>/gi, '') // Remove links but keep the text before it
          .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ')
          .replace(/&mdash;/g, '—')
          .replace(/\s+/g, ' ') // Collapse multiple spaces
          .trim();
        
        return text || undefined;
      }
      return undefined;
    } catch (error) {
      log('[Enrichment] Failed to extract tweet text from HTML:', error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  private async tryPlatformOembed(url: string, platform: string): Promise<EnrichmentData | null> {
    try {
      let oembedEndpoint: string;
      
      switch (platform) {
        case 'twitter':
          oembedEndpoint = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
          break;
        case 'youtube':
          oembedEndpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
          break;
        case 'vimeo':
          oembedEndpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
          break;
        case 'tiktok':
          oembedEndpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
          break;
        case 'reddit':
          oembedEndpoint = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
          break;
        case 'spotify':
          oembedEndpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
          break;
        case 'soundcloud':
          oembedEndpoint = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
          break;
        case 'pinterest':
          oembedEndpoint = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`;
          break;
        case 'bluesky':
          // Bluesky doesn't have a stable oEmbed API yet, fall through to Microlink
          return null;
        default:
          return null;
      }

      const response = await fetch(oembedEndpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AsideBot/1.0)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        log(`[Enrichment] ${platform} oEmbed returned ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      // Special handling for Twitter to extract tweet text from HTML
      let description = data.description;
      if (platform === 'twitter' && data.html) {
        const tweetText = this.extractTweetTextFromHtml(data.html);
        if (tweetText) {
          description = tweetText;
          log(`[Enrichment] Extracted tweet text: ${tweetText.substring(0, 100)}...`);
        } else {
          // Fallback to author name if extraction fails
          description = data.author_name ? `By ${data.author_name}` : undefined;
        }
      } else if (!description && data.author_name) {
        description = `By ${data.author_name}`;
      }
      
      // Map oEmbed response to our EnrichmentData format
      return {
        title: data.title || data.name,
        description: description,
        image: data.thumbnail_url || data.image || data.url,
        siteName: data.provider_name || platform
      };
    } catch (error) {
      log(`[Enrichment] ${platform} oEmbed failed:`, error instanceof Error ? error.message : String(error));
      return null;
    }
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

  private isBlockedResponse(data: EnrichmentData): boolean {
    if (!data.title) return false;
    
    const title = data.title.toLowerCase();
    const description = data.description?.toLowerCase() || '';
    
    // Check for common block/error patterns
    const blockedPatterns = [
      'access denied',
      'access forbidden',
      'bot protection',
      'just a moment',
      'please wait',
      'checking your browser',
      'cloudflare',
      'ray id',
      'reference #'
    ];
    
    // Check for generic e-commerce/site responses
    const genericPatterns = [
      'conditions of use',
      'privacy policy',
      'terms of service',
      'terms and conditions',
      'legal notice'
    ];
    
    // Check for generic title patterns
    const genericTitles = [
      'product gallery',
      'page not found',
      'error',
      '404',
      'loading'
    ];
    
    // Check if title is just the site name (e.g., "Amazon.com", "Wayfair")
    const siteName = data.siteName?.toLowerCase() || '';
    if (siteName && title === siteName) return true;
    if (title.endsWith('.com') || title.endsWith('.co.uk') || title.endsWith('.org')) return true;
    
    // Check if title is suspiciously short (likely not real content)
    if (data.title.length <= 2) return true;
    
    // Check for generic titles
    for (const pattern of genericTitles) {
      if (title === pattern || title.startsWith(pattern + ' ') || title.endsWith(' ' + pattern)) {
        return true;
      }
    }
    
    // Check for blocked patterns in title or description
    for (const pattern of blockedPatterns) {
      if (title.includes(pattern) || description.includes(pattern)) {
        return true;
      }
    }
    
    // Check for generic patterns in description
    for (const pattern of genericPatterns) {
      if (description.includes(pattern) && !title.includes(pattern)) {
        return true;
      }
    }
    
    return false;
  }

  private extractDomainFallback(url: string): EnrichmentData | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Remove www. prefix
      const cleanDomain = hostname.replace(/^www\./, '');
      
      // Extract the main domain name (e.g., "lowes.com" → "Lowe's")
      const domainParts = cleanDomain.split('.');
      const mainDomain = domainParts[0];
      
      // Capitalize first letter for display
      const displayName = mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
      
      // Extract and clean the URL path for a better description
      const pathDescription = this.extractReadablePathInfo(urlObj);
      
      return {
        title: displayName,
        description: pathDescription || `Link from ${cleanDomain}`,
        siteName: cleanDomain,
        isFallback: true
      };
    } catch (error) {
      log('[Enrichment] Failed to extract domain fallback:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private extractReadablePathInfo(urlObj: URL): string | null {
    try {
      // Get the pathname without leading/trailing slashes
      const path = urlObj.pathname.replace(/^\/+|\/+$/g, '');
      
      if (!path) return null;
      
      // Split by slashes to get path segments
      const segments = path.split('/');
      
      // Find the most descriptive segment (usually the longest one with readable text)
      let bestSegment = '';
      for (const segment of segments) {
        // Skip short segments, numeric IDs, and query-like segments
        if (segment.length < 3) continue;
        if (/^\d+$/.test(segment)) continue;
        if (segment.includes('?') || segment.includes('=')) continue;
        
        // Skip Amazon-style product IDs (e.g., "B0F9FNW8G5" - starts with B and has alphanumeric)
        if (/^[A-Z][A-Z0-9]{8,}$/i.test(segment)) continue;
        
        // Skip common URL segments that aren't product names
        const skipSegments = ['dp', 'p', 'pd', 'product', 'item', 'ref', 'gp'];
        if (skipSegments.includes(segment.toLowerCase())) continue;
        
        // Prefer longer segments with hyphens/underscores (likely product names)
        if (segment.length > bestSegment.length && /[-_]/.test(segment)) {
          bestSegment = segment;
        } else if (!bestSegment && segment.length > 10) {
          bestSegment = segment;
        }
      }
      
      if (!bestSegment) {
        // Fallback to first non-trivial segment
        bestSegment = segments.find(s => 
          s.length > 5 && 
          !/^\d+$/.test(s) && 
          !/^[A-Z][A-Z0-9]{8,}$/i.test(s)
        ) || segments[0];
      }
      
      if (!bestSegment) return null;
      
      // Clean up the segment
      let cleaned = bestSegment;
      
      // Decode URL encoding
      try {
        cleaned = decodeURIComponent(cleaned);
      } catch {
        // If decoding fails, continue with original
      }
      
      // Replace hyphens and underscores with spaces
      cleaned = cleaned.replace(/[-_]+/g, ' ');
      
      // Remove common URL patterns
      cleaned = cleaned.replace(/\b(pd|p|product|item|dp|shop|buy)\b/gi, '');
      
      // Clean up multiple spaces
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      // Capitalize first letter of each word for readability
      cleaned = cleaned.split(' ')
        .map(word => {
          if (word.length === 0) return word;
          // Keep all caps words (like "UV", "LED")
          if (word === word.toUpperCase() && word.length <= 4) return word;
          // Capitalize first letter
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
      
      // Limit length for display
      if (cleaned.length > 150) {
        cleaned = cleaned.substring(0, 147) + '...';
      }
      
      return cleaned || null;
    } catch (error) {
      log('[Enrichment] Failed to extract readable path info:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}
