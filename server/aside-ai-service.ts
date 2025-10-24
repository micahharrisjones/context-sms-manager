import OpenAI from "openai";
import { log } from "./vite";
import { embeddingService } from "./embedding-service";
import type { IStorage } from "./storage";
import { shortLinkService } from "./short-link-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AsideAIResponse {
  response: string;
  intent: 'search' | 'summarize' | 'recommend' | 'analyze' | 'login' | 'unknown';
  searchPerformed?: boolean;
}

class AsideAIService {
  /**
   * Process "Hey Aside" conversational queries
   * Understands user intent and performs appropriate actions (search, summarize, etc.)
   */
  async processQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    try {
      log(`🤖 AsideAI processing query: "${query}"`);

      // Step 1: Determine intent using OpenAI
      const intentAnalysis = await this.analyzeIntent(query);
      log(`📊 Intent detected: ${intentAnalysis.intent}`);

      // Step 2: Based on intent, perform appropriate action
      switch (intentAnalysis.intent) {
        case 'search':
          return await this.handleSearchQuery(query, userId, storage);
        
        case 'summarize':
          return await this.handleSummarizeQuery(query, userId, storage);
        
        case 'recommend':
          return await this.handleRecommendQuery(query, userId, storage);
        
        case 'analyze':
          return await this.handleAnalyzeQuery(query, userId, storage);
        
        case 'login':
          return await this.handleLoginQuery(userId);
        
        default:
          // For unknown intents, provide a helpful response
          return {
            response: "I'm not sure what you're asking. Try:\n\n• Hey Aside, find my recipes\n• Hey Aside, what are my best gift ideas?\n• Hey Aside, show me tech articles",
            intent: 'unknown',
          };
      }
    } catch (error) {
      log(`Error in AsideAI processing: ${error instanceof Error ? error.message : String(error)}`);
      return {
        response: "Sorry, I'm having trouble understanding that. Please try again or text with #tags to save content.",
        intent: 'unknown',
      };
    }
  }

  /**
   * Analyze user's intent using OpenAI
   */
  private async analyzeIntent(query: string): Promise<{ intent: 'search' | 'summarize' | 'recommend' | 'analyze' | 'login' | 'unknown', extractedQuery?: string }> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an intent classifier for Aside, a personal information management system via SMS.

Users can ask you to:
- SEARCH: Find specific saved content ("find my recipes", "do I have anything about AI?", "search for gift ideas")
- SUMMARIZE: Get overview of saved content ("what have I saved about cooking?", "summarize my tech articles")
- RECOMMEND: Get recommendations ("what's the best gift idea I saved?", "recommend something to read")
- ANALYZE: Get insights ("what topics do I save the most?", "analyze my interests")
- LOGIN: Request a login link for the web dashboard ("how do I login?", "send me a login link", "I need to access the website")

Respond with ONLY a JSON object: {"intent": "search|summarize|recommend|analyze|login|unknown", "query": "cleaned up search query"}

Examples:
"find my recipes" → {"intent": "search", "query": "recipes"}
"what have I saved about AI?" → {"intent": "summarize", "query": "AI content"}
"recommend a good restaurant" → {"intent": "recommend", "query": "restaurants"}
"what do I save most?" → {"intent": "analyze", "query": "saved topics"}
"how do I login?" → {"intent": "login", "query": "login"}
"send me a login link" → {"intent": "login", "query": "login link"}`,
          },
          {
            role: "user",
            content: query,
          },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return {
        intent: result.intent || 'unknown',
        extractedQuery: result.query || query,
      };
    } catch (error) {
      log(`Error analyzing intent: ${error instanceof Error ? error.message : String(error)}`);
      return { intent: 'unknown' };
    }
  }

  /**
   * Handle search queries - find specific content
   * Uses keyword-first approach: try keyword matching first, fall back to semantic search if needed
   */
  private async handleSearchQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    try {
      let searchResults: any[] = [];
      let searchMethod = 'keyword';

      // STEP 1: Try enhanced keyword search first (searches content, og_title, og_description, tags)
      log(`🔍 Trying enhanced keyword search for: "${query}"`);
      searchResults = await storage.keywordSearch(userId, query, 50);
      log(`Enhanced keyword search returned ${searchResults.length} results`);

      // STEP 2: If keyword search returns < 3 results, fall back to semantic search
      if (searchResults.length < 3) {
        log(`⚡ Keyword search returned < 3 results, falling back to semantic search`);
        
        // Generate embedding for semantic search
        const queryEmbedding = await embeddingService.generateEmbedding(query);
        
        if (queryEmbedding) {
          // Perform hybrid search (70% semantic + 30% keyword)
          searchResults = await storage.hybridSearch(userId, query, queryEmbedding, 0.7, 5);
          searchMethod = 'hybrid';
          log(`Hybrid/semantic search returned ${searchResults.length} results`);
        } else {
          log(`⚠️ Failed to generate embedding, sticking with keyword results`);
        }
      }

      if (searchResults.length === 0) {
        // Create search link with query pre-populated
        const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'textaside.app';
        const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
        const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
        
        try {
          const shortCode = await shortLinkService.createShortLink(searchUrl);
          return {
            response: `I couldn't find anything matching "${query}". Try a different search here: ${baseUrl}/s/${shortCode}`,
            intent: 'search',
            searchPerformed: true,
          };
        } catch (error) {
          log(`Failed to create short link for no results: ${error instanceof Error ? error.message : String(error)}`);
          return {
            response: `I couldn't find anything matching "${query}". Try a different search at: ${searchUrl}`,
            intent: 'search',
            searchPerformed: true,
          };
        }
      }

      log(`✅ Using ${searchMethod} search results (${searchResults.length} total)`);

      // Format results as numbered list (limit to 3-4 results for SMS readability)
      const maxResults = Math.min(searchResults.length, 4);
      const displayResults = searchResults.slice(0, maxResults);

      let response = `Found ${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}:\n\n`;

      // Add numbered list of results
      for (let i = 0; i < displayResults.length; i++) {
        const result = displayResults[i];
        
        // Extract title (first line or first 50 chars)
        let title = result.content.split('\n')[0].trim();
        if (title.length > 50) {
          title = title.substring(0, 50) + '...';
        }
        if (!title) {
          title = 'Saved message';
        }

        response += `${i + 1}. ${title}\n`;
      }

      // Create "View all" short link to search page with query
      const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'textaside.app';
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
      
      try {
        const shortCode = await shortLinkService.createShortLink(searchUrl);
        response += `\nView all: ${baseUrl}/s/${shortCode}`;
      } catch (error) {
        log(`Failed to create View all short link: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to regular URL
        response += `\nView all: ${searchUrl}`;
      }

      return {
        response,
        intent: 'search',
        searchPerformed: true,
      };
    } catch (error) {
      log(`Error in search query: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Handle summarize queries - overview of content
   */
  private async handleSummarizeQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    // For now, redirect to search with a note
    // TODO: Implement actual summarization in future
    return {
      response: "Summarization coming soon! For now, try 'Hey Aside, find [topic]' to search your saved content.",
      intent: 'summarize',
    };
  }

  /**
   * Handle recommend queries - suggest best options
   */
  private async handleRecommendQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    // For now, redirect to search
    // TODO: Implement AI-powered recommendations in future
    return {
      response: "Recommendations coming soon! For now, try 'Hey Aside, find [topic]' to search your saved content.",
      intent: 'recommend',
    };
  }

  /**
   * Handle analyze queries - insights about saved content
   */
  private async handleAnalyzeQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    // For now, redirect to web dashboard
    // TODO: Implement content analysis in future
    return {
      response: "Content analysis coming soon! For now, check out your boards at textaside.app to see what you've saved.",
      intent: 'analyze',
    };
  }

  /**
   * Handle login requests - generate and return magic link
   */
  private async handleLoginQuery(userId: number): Promise<AsideAIResponse> {
    // Import MagicLinkService dynamically to avoid circular dependency
    const { MagicLinkService } = await import('./magic-link-service');
    
    try {
      // Generate magic link
      const { url } = await MagicLinkService.createMagicLink(userId);
      
      return {
        response: `Here's your login link:\n\n${url}\n\nThis link expires in 30 minutes and can only be used once.`,
        intent: 'login',
      };
    } catch (error) {
      // Handle rate limiting or other errors
      if (error instanceof Error && error.message.includes('Too many')) {
        return {
          response: "You've requested too many login links recently. Please try again in an hour or use your existing link.",
          intent: 'login',
        };
      }
      
      log(`Error generating login link: ${error instanceof Error ? error.message : String(error)}`);
      return {
        response: "Sorry, I couldn't generate a login link right now. Please try again in a moment.",
        intent: 'login',
      };
    }
  }
}

export const asideAIService = new AsideAIService();
