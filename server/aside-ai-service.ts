import OpenAI from "openai";
import { log } from "./vite";
import { embeddingService } from "./embedding-service";
import type { IStorage } from "./storage";
import { shortLinkService } from "./short-link-service";
import { MagicLinkService } from "./magic-link-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface AsideAIResponse {
  response: string;
  intent: 'search' | 'summarize' | 'recommend' | 'analyze' | 'login' | 'help' | 'unknown';
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
          // Use AI-extracted query for more accurate search
          return await this.handleSearchQuery(intentAnalysis.extractedQuery || query, userId, storage);
        
        case 'summarize':
          return await this.handleSummarizeQuery(query, userId, storage);
        
        case 'recommend':
          return await this.handleRecommendQuery(query, userId, storage);
        
        case 'analyze':
          return await this.handleAnalyzeQuery(query, userId, storage);
        
        case 'login':
          return await this.handleLoginQuery(userId);
        
        case 'help':
          return await this.handleHelpQuery(query, userId, storage);
        
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
  private async analyzeIntent(query: string): Promise<{ intent: 'search' | 'summarize' | 'recommend' | 'analyze' | 'login' | 'help' | 'unknown', extractedQuery?: string, topic?: string }> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an intent classifier for Aside, a personal information management system via SMS.

Users can ask you to:
- SEARCH: Find specific saved content. This includes keywords, topics, or any content search. Examples: "cookie", "find my recipes", "do I have anything about AI?", "search for gift ideas", "show me tech articles"
- SUMMARIZE: Get overview of saved content ("what have I saved about cooking?", "summarize my tech articles")
- RECOMMEND: Get recommendations ("what's the best gift idea I saved?", "recommend something to read")
- ANALYZE: Get insights ("what topics do I save the most?", "analyze my interests")
- LOGIN: Request a login link for the web dashboard ("what's my login?", "send me a login link", "what's my dashboard link?", "how do I access the website?")
- HELP: Ask how-to questions about using Aside features ("how does Aside work?", "how do I create a board?", "how do I add to a board?", "how do I invite someone?", "how do I delete a board?", "how do I move an item?")

Respond with ONLY a JSON object: {"intent": "search|summarize|recommend|analyze|login|help|unknown", "query": "cleaned up keywords", "topic": "specific help topic if help intent"}

For SEARCH intent, extract just the core search keywords without action verbs.
For HELP intent, include a "topic" field with the specific question category.

Examples:
"cookie" → {"intent": "search", "query": "cookie"}
"find my recipes" → {"intent": "search", "query": "recipes"}
"show me tech articles" → {"intent": "search", "query": "tech articles"}
"do I have anything about AI?" → {"intent": "search", "query": "AI"}
"what have I saved about cooking?" → {"intent": "summarize", "query": "cooking"}
"recommend a good restaurant" → {"intent": "recommend", "query": "restaurants"}
"what do I save most?" → {"intent": "analyze", "query": "saved topics"}
"what's my login?" → {"intent": "login", "query": "login"}
"send me a login link" → {"intent": "login", "query": "login link"}
"how does Aside work?" → {"intent": "help", "query": "how aside works", "topic": "how_it_works"}
"how do I create a board?" → {"intent": "help", "query": "create board", "topic": "create_board"}
"how do I add to a board?" → {"intent": "help", "query": "add to board", "topic": "add_to_board"}
"what's my dashboard link?" → {"intent": "login", "query": "dashboard link"}
"what boards do I have?" → {"intent": "help", "query": "list boards", "topic": "list_boards"}
"how do I invite a friend?" → {"intent": "help", "query": "invite", "topic": "invite"}
"how do I delete a board?" → {"intent": "help", "query": "delete board", "topic": "delete_board"}`,
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
        topic: result.topic,
      };
    } catch (error) {
      log(`Error analyzing intent: ${error instanceof Error ? error.message : String(error)}`);
      return { intent: 'unknown' };
    }
  }

  /**
   * Handle search queries - find specific content
   * Uses semantic-first approach: AI understands natural language, keywords boost exact matches
   */
  private async handleSearchQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    try {
      let searchResults: any[] = [];
      let searchMethod = 'semantic';

      // STEP 1: Generate embedding for semantic search (always try AI understanding first)
      log(`🔍 Generating embedding for semantic search: "${query}"`);
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      
      if (queryEmbedding) {
        // STEP 2: Try pure semantic search first (vector-only for natural language understanding)
        log(`🧠 Performing pure semantic search...`);
        searchResults = await storage.semanticSearch(userId, queryEmbedding, 20);
        searchMethod = 'semantic';
        log(`Pure semantic search returned ${searchResults.length} results`);
        
        // STEP 3: If semantic found results, ALWAYS boost with keyword matches for better ranking
        if (searchResults.length > 0) {
          log(`✨ Boosting semantic results with keyword matches for reranking...`);
          const hybridResults = await storage.hybridSearch(userId, query, queryEmbedding, 0.7, 20);
          if (hybridResults.length > 0) {
            // Always use hybrid results - they have keyword-boosted rankings
            searchResults = hybridResults;
            searchMethod = 'semantic-boosted';
            log(`Keyword boosting applied - using ${searchResults.length} reranked results`);
          }
        }
      }

      // STEP 4: If semantic search fails or returns 0 results, fall back to keyword search
      if (searchResults.length === 0) {
        log(`⚡ Semantic search returned 0 results, falling back to keyword search`);
        searchResults = await storage.keywordSearch(userId, query, 50);
        searchMethod = 'keyword-fallback';
        log(`Keyword fallback search returned ${searchResults.length} results`);
      }

      if (searchResults.length === 0) {
        // Create magic link with redirect to search page (auto-login + search in one click)
        const redirectUrl = `/search?q=${encodeURIComponent(query)}`;
        const baseUrl = 'https://textaside.app';
        
        try {
          const { url: magicLinkUrl } = await MagicLinkService.createMagicLink(userId, redirectUrl);
          
          // Shorten the magic link for SMS readability
          const shortCode = await shortLinkService.createShortLink(magicLinkUrl);
          
          return {
            response: `I couldn't find anything matching "${query}". Try a different search here: ${baseUrl}/s/${shortCode}`,
            intent: 'search',
            searchPerformed: true,
          };
        } catch (error) {
          log(`Failed to create magic link for no results: ${error instanceof Error ? error.message : String(error)}`);
          
          // Fallback: try to create short link for direct search URL (without auth)
          try {
            const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
            const fallbackShortCode = await shortLinkService.createShortLink(searchUrl);
            return {
              response: `I couldn't find anything matching "${query}". Try a different search here: ${baseUrl}/s/${fallbackShortCode}`,
              intent: 'search',
              searchPerformed: true,
            };
          } catch (fallbackError) {
            log(`Failed to create fallback short link: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            // Last resort: generic message without long URL
            return {
              response: `I couldn't find anything matching "${query}". Try searching on the web at textaside.app`,
              intent: 'search',
              searchPerformed: true,
            };
          }
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

      // Create "View all" magic link with redirect to search page (auto-login + search in one click)
      const redirectUrl = `/search?q=${encodeURIComponent(query)}`;
      const baseUrl = 'https://textaside.app';
      
      try {
        const { url: magicLinkUrl } = await MagicLinkService.createMagicLink(userId, redirectUrl);
        
        // Shorten the magic link for SMS readability
        const shortCode = await shortLinkService.createShortLink(magicLinkUrl);
        
        response += `\nView all: ${baseUrl}/s/${shortCode}`;
      } catch (error) {
        log(`Failed to create View all magic link: ${error instanceof Error ? error.message : String(error)}`);
        
        // Fallback: try to create short link for direct search URL (without auth)
        try {
          const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query)}`;
          const fallbackShortCode = await shortLinkService.createShortLink(searchUrl);
          response += `\nView all: ${baseUrl}/s/${fallbackShortCode}`;
        } catch (fallbackError) {
          log(`Failed to create fallback short link: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          // Last resort: truncate query if too long for SMS
          const truncatedQuery = query.length > 30 ? query.substring(0, 30) : query;
          response += `\nView all: ${baseUrl}/search?q=${encodeURIComponent(truncatedQuery)}`;
        }
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

  /**
   * Handle help queries - provide specific instructions based on topic
   * Returns deterministic responses that match brand guidelines from spreadsheet
   */
  private async handleHelpQuery(
    query: string,
    userId: number,
    storage: IStorage
  ): Promise<AsideAIResponse> {
    try {
      // Generate magic link for responses that need it
      const { MagicLinkService } = await import('./magic-link-service');
      let dashboardLink = 'https://textaside.app';
      try {
        const { url } = await MagicLinkService.createMagicLink(userId);
        dashboardLink = url;
      } catch (error) {
        log(`Could not generate magic link for help response: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Normalize query for pattern matching
      const normalizedQuery = query.toLowerCase().trim();

      // Match specific help topics from spreadsheet
      if (normalizedQuery.includes('how') && normalizedQuery.includes('aside') && normalizedQuery.includes('work')) {
        return {
          response: `Aside lets you save anything just by texting it here!

Here's how it works:
- Text me anything you want to remember: quotes, links, recipes, random ideas, you name it  
- Add a hashtag like #movies or #recipes to keep things organized  
- Everything you save lives in your dashboard, ready when you need it   

🤔 Questions? Just text me "Hey Aside..." followed by your question and I'll help out.   

💬 Got feedback or found something weird? We'd love to hear about it: textaside.app/feedback`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('dashboard') || normalizedQuery.includes('add')) {
        return {
          response: `Just text me whatever you want to save and it'll show up in your dashboard automatically. 

Want to organize things? Add hashtags like #recipes or #movies. 

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('create') && normalizedQuery.includes('board')) {
        return {
          response: `Super easy! Just add a hashtag to any message. 

Like this: "Check out this recipe #dinner"

That'll create a #dinner board automatically.

All your boards live in your dashboard. 🔗 See all your boards: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if ((normalizedQuery.includes('add') || normalizedQuery.includes('post') || normalizedQuery.includes('send')) && normalizedQuery.includes('board')) {
        return {
          response: `Just include the hashtag in your message!

Like: "This movie looks great #watchlist"

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('shared') && normalizedQuery.includes('board')) {
        return {
          response: `Head to your dashboard. You can either create a new shared board or convert a private one.   

🔗 Your dashboard: ${dashboardLink}   

For a new shared board: Click the + next to Shared Boards in the menu and follow the prompts.   

To convert a private board: Go to the private board and click the Invite button in the upper right corner, then follow the prompts.`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('invite')) {
        return {
          response: `Go to your dashboard, open the shared board, and click the Invite button in the upper right corner.   

Easy as that!   

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('what') && normalizedQuery.includes('board')) {
        // Get user's boards
        const [privateTags, sharedBoards] = await Promise.all([
          storage.getTags(userId),
          storage.getSharedBoards(userId),
        ]);

        const privateBoards = privateTags.filter(tag => tag !== 'untagged');
        const sharedBoardNames = sharedBoards.map(b => b.name);

        let response = "Here's what you've got:\n\n";
        
        if (privateBoards.length > 0) {
          response += "Private:\n";
          privateBoards.slice(0, 10).forEach(board => {
            response += `- #${board}\n`;
          });
          if (privateBoards.length > 10) {
            response += `...and ${privateBoards.length - 10} more\n`;
          }
          response += "\n";
        }

        if (sharedBoardNames.length > 0) {
          response += "Shared:\n";
          sharedBoardNames.forEach(board => {
            response += `- #${board}\n`;
          });
        }

        if (privateBoards.length === 0 && sharedBoardNames.length === 0) {
          response = "You don't have any boards yet! Create one by adding a hashtag to your next message, like: \"Great recipe #dinner\"";
        }

        response += `\n🔗 Your dashboard: ${dashboardLink}`;

        return {
          response,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('move') || normalizedQuery.includes('wrong')) {
        return {
          response: `No worries! Go to your dashboard, find the item, and click the edit icon. You can move it wherever you want.   

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('delete') && (normalizedQuery.includes('item') || normalizedQuery.includes('message'))) {
        return {
          response: `Head to your dashboard, find the item you want to remove, and click the delete icon. Done!   

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      if (normalizedQuery.includes('delete') && normalizedQuery.includes('board')) {
        return {
          response: `Go to your dashboard, open the board you want to delete, and click the Delete button in the upper right corner. That's it!   

🔗 Your dashboard: ${dashboardLink}`,
          intent: 'help',
        };
      }

      // Default help response if no specific topic matches
      return {
        response: `I can help you with:

- How Aside works
- Creating and managing boards
- Inviting friends to shared boards
- Finding your dashboard link
- Moving or deleting items

Just ask me a specific question, like "Hey Aside, how do I create a board?"`,
        intent: 'help',
      };
    } catch (error) {
      log(`Error in help query: ${error instanceof Error ? error.message : String(error)}`);
      return {
        response: "I'm here to help! Try asking me a specific question like 'How does Aside work?' or 'How do I create a board?'",
        intent: 'help',
      };
    }
  }
}

export const asideAIService = new AsideAIService();
