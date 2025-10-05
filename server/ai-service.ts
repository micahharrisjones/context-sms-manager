import OpenAI from "openai";

interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning?: string;
}

class AIService {
  private client: OpenAI;
  private log: (message: string, ...args: any[]) => void;
  private static readonly CACHE_KEY = 'daily_affirmation';
  private static readonly CACHE_DURATION_HOURS = 3;
  private affirmationCache: { text: string; timestamp: number; userId: number } | null = null;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com"
    });
    
    this.log = (message: string, ...args: any[]) => {
      console.log(new Date().toLocaleTimeString(), `[ai-service]`, message, ...args);
    };
  }

  /**
   * Generate or retrieve cached affirmation for a user
   */
  async generateAffirmation(userId: number): Promise<string> {
    try {
      // Check if we have a valid cached affirmation for this user
      if (this.affirmationCache && 
          this.affirmationCache.userId === userId &&
          this.isCacheValid(this.affirmationCache.timestamp)) {
        this.log(`Using cached affirmation for user ${userId}`);
        return this.affirmationCache.text;
      }

      this.log(`Generating new affirmation for user ${userId}`);

      const response = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a supportive friend who creates personal, encouraging affirmations. Generate a brief, intimate positive message that feels like it's coming from someone who really cares about them. Use 'you' language and make it personal and uplifting. Examples: 'You look amazing today!' 'I love how you inspire others.' 'This is your day to kick ass!' 'You have such a beautiful energy.' Keep it under 10 words and make it feel genuinely personal and motivating."
          },
          {
            role: "user",
            content: "Generate a personal, encouraging affirmation that feels like it's from a caring friend."
          }
        ],
        temperature: 0.8,
        max_tokens: 50
      });

      const affirmation = response.choices[0]?.message?.content?.trim() || "you're doing great today!";
      this.log(`Generated affirmation: "${affirmation}"`);
      
      // Cache the new affirmation
      this.affirmationCache = {
        text: affirmation,
        timestamp: Date.now(),
        userId: userId
      };
      
      return affirmation;
    } catch (error) {
      this.log(`Error generating affirmation: ${error instanceof Error ? error.message : String(error)}`);
      return "you're doing great today!";
    }
  }

  /**
   * Check if the cached affirmation is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    const now = Date.now();
    const cacheAgeHours = (now - timestamp) / (1000 * 60 * 60);
    return cacheAgeHours < AIService.CACHE_DURATION_HOURS;
  }

  /**
   * Force refresh the affirmation cache for a user
   */
  async refreshAffirmation(userId: number): Promise<string> {
    this.affirmationCache = null; // Clear cache
    return this.generateAffirmation(userId);
  }

  /**
   * Check if a message is asking for a board list and respond conversationally
   */
  async handleBoardListRequest(
    messageContent: string,
    userPrivateBoards: string[],
    userSharedBoards: string[]
  ): Promise<{ isRequest: boolean; response?: string }> {
    try {
      this.log(`Checking for board list request: "${messageContent.substring(0, 100)}..."`); 

      // First, check if this looks like a board list request
      const detectionPrompt = `
Analyze this message to determine if the user is asking for a list of their boards, categories, hashtags, or similar organizational elements:

Message: "${messageContent}"

Respond with JSON containing:
{
  "isRequest": true/false,
  "confidence": 0.0-1.0
}

Examples of board list requests:
- "Can I get a list of boards I've created?"
- "What hashtags do I have?"
- "Show me my categories" 
- "List my boards"
- "What boards have I made?"

Examples that are NOT board list requests:
- "Check out this link #ideas"
- "Great restaurant #food"
- Messages that contain hashtags but are adding content
- URLs or media with hashtags
- Normal content messages with organizational hashtags
`;

      const detectionResponse = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a smart assistant that detects when users are asking for lists of their organizational elements. Respond only with valid JSON."
          },
          {
            role: "user",
            content: detectionPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 100
      });

      const detection = JSON.parse(detectionResponse.choices[0].message.content || "{}");
      this.log(`Board list detection result:`, detection);

      if (!detection.isRequest || detection.confidence < 0.7) {
        return { isRequest: false };
      }

      // Generate a conversational response with the board list
      const responsePrompt = `
User asked: "${messageContent}"

Provide a helpful, conversational response listing their boards. Be friendly and concise.

Private Boards (${userPrivateBoards.length}): ${userPrivateBoards.join(', ') || 'None'}
Shared Boards (${userSharedBoards.length}): ${userSharedBoards.join(', ') || 'None'}

Guidelines:
- Use a warm, helpful tone
- Organize by Private and Shared if both exist
- If they have no boards, encourage them to create some
- Keep response under 160 characters if possible (SMS friendly)
- Use hashtags (#) before board names
`;

      const responseGeneration = await this.client.chat.completions.create({
        model: "deepseek-chat", 
        messages: [
          {
            role: "system",
            content: "You are Aside, a helpful SMS assistant. Generate friendly, concise responses about user's boards."
          },
          {
            role: "user",
            content: responsePrompt
          }
        ],
        temperature: 0.4,
        max_tokens: 200
      });

      const response = responseGeneration.choices[0].message.content?.trim() || "Here are your boards! Check your dashboard at https://textaside.app";
      this.log(`Generated board list response: ${response}`);
      
      return { isRequest: true, response };
      
    } catch (error) {
      this.log(`Error in handleBoardListRequest:`, error instanceof Error ? error.message : String(error));
      return { isRequest: false };
    }
  }

  /**
   * Categorize a message using AI based on user's existing boards
   */
  async categorizeMessage(
    messageContent: string,
    userPrivateBoards: string[],
    userSharedBoards: string[]
  ): Promise<CategorySuggestion | null> {
    try {
      this.log(`Categorizing message: "${messageContent.substring(0, 100)}..."`);
      this.log(`Available private boards: [${userPrivateBoards.join(", ")}]`);
      this.log(`Available shared boards: [${userSharedBoards.join(", ")}]`);

      // Prepare the categorization prompt
      const availableCategories = [...userPrivateBoards, ...userSharedBoards];
      
      if (availableCategories.length === 0) {
        this.log("No existing boards found, falling back to untagged");
        return null;
      }

      const prompt = this.buildCategorizationPrompt(messageContent, availableCategories);
      
      const response = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a smart categorization assistant for a personal SMS organization system. Analyze messages and suggest the best existing category based on content relevance. Respond only with valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      this.log(`AI categorization result:`, result);

      // Validate the response
      if (result.category && availableCategories.includes(result.category)) {
        return {
          category: result.category,
          confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
          reasoning: result.reasoning
        };
      }

      this.log("AI suggested invalid category or low confidence, falling back to untagged");
      return null;

    } catch (error) {
      this.log("Error during AI categorization:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Build the categorization prompt for the AI
   */
  private buildCategorizationPrompt(messageContent: string, availableCategories: string[]): string {
    return `
Analyze this SMS message and categorize it into one of the existing categories below.

Message to categorize:
"${messageContent}"

Available categories:
${availableCategories.map(cat => `- ${cat}`).join('\n')}

Rules:
1. Only suggest categories from the available list above
2. Consider the message content, context, and likely user intent
3. If no category is a good fit (confidence < 0.6), suggest "untagged"
4. URLs should be categorized based on their domain/content context
5. Be conservative - better to leave uncategorized than miscategorize

Respond with JSON in this exact format:
{
  "category": "exact-category-name-from-list-or-untagged",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this category fits"
}
`;
  }

  /**
   * Generate a new category name based on message content
   * This could be used for suggesting new boards to create
   */
  async suggestNewCategory(messageContent: string): Promise<string | null> {
    try {
      this.log(`Suggesting new category for: "${messageContent.substring(0, 100)}..."`);

      const response = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that suggests concise, descriptive category names for organizing personal content. Respond with lowercase, hyphenated names suitable for hashtags."
          },
          {
            role: "user",
            content: `Suggest a short, descriptive category name (2-3 words max) for organizing this content:\n\n"${messageContent}"\n\nRespond with just the category name in lowercase with hyphens (e.g., "work-notes", "recipes", "car-maintenance").`
          }
        ],
        temperature: 0.4,
        max_tokens: 50
      });

      const suggestion = response.choices[0].message.content?.trim().toLowerCase();
      if (suggestion && /^[a-z0-9-]+$/.test(suggestion)) {
        this.log(`AI suggested new category: ${suggestion}`);
        return suggestion;
      }

      return null;
    } catch (error) {
      this.log("Error suggesting new category:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  /**
   * Check if a message is asking for help/instructions on how to use Context
   */
  async handleHelpRequest(messageContent: string): Promise<{ isRequest: boolean; response?: string }> {
    try {
      this.log(`Checking for help request: "${messageContent.substring(0, 100)}..."`);

      // First, check if this looks like a help request
      const detectionPrompt = `
Analyze this message to determine if the user is asking for help, instructions, or guidance on how to use Context:

Message: "${messageContent}"

Respond with JSON containing:
{
  "isRequest": true/false,
  "confidence": 0.0-1.0
}

Examples of help requests:
- "How does this work?"
- "What can I do with Context?"
- "How do I use this?"
- "Help"
- "Instructions"
- "What is Context?"
- "How does Context work?"
- "Can you explain how to use this?"
- "What are the features?"

Examples that are NOT help requests:
- "Check out this link #ideas"
- "Great restaurant #food" 
- Messages with hashtags that are adding content
- URLs or media with hashtags
- Normal content messages with hashtags
`;

      const detectionResponse = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system", 
            content: "You are a smart assistant that detects when users are asking for help or instructions. Respond only with valid JSON."
          },
          {
            role: "user",
            content: detectionPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 100
      });

      const detection = JSON.parse(detectionResponse.choices[0].message.content || "{}");
      this.log(`Help request detection result:`, detection);

      if (!detection.isRequest || detection.confidence < 0.7) {
        return { isRequest: false };
      }

      // Generate a helpful response about how to use Context
      const responsePrompt = `
User asked: "${messageContent}"

Provide a helpful, concise response explaining how to use Context. Focus on practical examples.

Key Context features to mention:
- Text anything to save it automatically
- Use #hashtags to organize messages 
- AI categorizes messages without hashtags
- Share boards with others using hashtags
- Access dashboard at contxt.life
- Everything is searchable and organized

Guidelines:
- Use a warm, encouraging tone
- Give 2-3 specific usage examples
- Keep response under 160 characters if possible (SMS friendly)
- Make it actionable and easy to understand
- Focus on the value proposition: "Save anything from anywhere, with just a text"
`;

      const responseGeneration = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are Context's helpful assistant. Provide clear, concise instructions on how to use Context effectively."
          },
          {
            role: "user", 
            content: responsePrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const response = responseGeneration.choices[0].message.content?.trim();
      this.log(`Generated help response: "${response}"`);

      return {
        isRequest: true,
        response: response || "Context helps you save and organize anything via text! Use #hashtags to categorize messages, or let AI organize them for you. Visit contxt.life to see your organized content!"
      };

    } catch (error) {
      this.log(`Error handling help request:`, error);
      return { isRequest: false };
    }
  }

  /**
   * Get relevant user content based on query type and keywords
   */
  async getRelevantUserContent(
    userId: number, 
    messageContent: string, 
    storage: any
  ): Promise<{ messages: any[]; relevantBoards: string[] }> {
    try {
      this.log(`Finding relevant content for query: "${messageContent}"`);
      
      // Get all user messages
      const allMessages = await storage.getMessages(userId);
      
      // Keywords for different content types
      const foodKeywords = ['recipe', 'cook', 'dinner', 'lunch', 'breakfast', 'food', 'meal', 'ingredient', 'restaurant', 'kitchen'];
      const politicsKeywords = ['politics', 'political', 'government', 'election', 'vote', 'policy', 'politician', 'democrat', 'republican'];
      const workKeywords = ['work', 'job', 'career', 'meeting', 'office', 'business', 'project'];
      const healthKeywords = ['health', 'fitness', 'exercise', 'diet', 'medical', 'doctor', 'wellness'];
      
      const queryLower = messageContent.toLowerCase();
      let relevantMessages: any[] = [];
      let relevantBoards: string[] = [];
      
      // Determine query type and search for relevant content
      if (foodKeywords.some(keyword => queryLower.includes(keyword))) {
        // Food/recipe related query
        relevantMessages = allMessages.filter((msg: any) => {
          const contentLower = msg.content.toLowerCase();
          const hasFood = foodKeywords.some(keyword => contentLower.includes(keyword));
          const hasRecipeTag = msg.tags.some((tag: string) => ['recipes', 'food', 'cooking', 'dinner', 'lunch'].includes(tag.toLowerCase()));
          return hasFood || hasRecipeTag;
        });
        relevantBoards = ['recipes', 'food', 'cooking', 'restaurants'];
      } else if (politicsKeywords.some(keyword => queryLower.includes(keyword))) {
        // Politics related query
        relevantMessages = allMessages.filter((msg: any) => {
          const contentLower = msg.content.toLowerCase();
          const hasPolitics = politicsKeywords.some(keyword => contentLower.includes(keyword));
          const hasPoliticsTag = msg.tags.some((tag: string) => ['politics', 'news', 'government'].includes(tag.toLowerCase()));
          return hasPolitics || hasPoliticsTag;
        });
        relevantBoards = ['politics', 'news', 'government'];
      } else if (workKeywords.some(keyword => queryLower.includes(keyword))) {
        // Work related query
        relevantMessages = allMessages.filter((msg: any) => {
          const contentLower = msg.content.toLowerCase();
          const hasWork = workKeywords.some(keyword => contentLower.includes(keyword));
          const hasWorkTag = msg.tags.some((tag: string) => ['work', 'business', 'career', 'projects'].includes(tag.toLowerCase()));
          return hasWork || hasWorkTag;
        });
        relevantBoards = ['work', 'business', 'career'];
      } else {
        // General query - look for any content that might be relevant
        const queryWords = queryLower.split(' ').filter(word => word.length > 3);
        relevantMessages = allMessages.filter((msg: any) => {
          const contentLower = msg.content.toLowerCase();
          return queryWords.some(word => contentLower.includes(word));
        });
      }
      
      // Sort by most recent and limit to avoid overwhelming the AI
      relevantMessages = relevantMessages
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
      
      this.log(`Found ${relevantMessages.length} relevant messages for query`);
      return { messages: relevantMessages, relevantBoards };
      
    } catch (error) {
      this.log(`Error retrieving relevant content:`, error instanceof Error ? error.message : String(error));
      return { messages: [], relevantBoards: [] };
    }
  }

  /**
   * Handle comprehensive conversational queries using user's saved content
   */
  async handleGeneralConversation(
    messageContent: string,
    userInfo: {
      id: number;
      phoneNumber: string;
      displayName: string;
      messageCount?: number;
      boardCount?: number;
      sharedBoardCount?: number;
      onboardingStep?: string;
      createdAt?: Date;
    },
    storage: any
  ): Promise<{ isConversational: boolean; response?: string }> {
    try {
      this.log(`Checking for conversational query: "${messageContent.substring(0, 100)}..."`);

      // First, detect if this is a conversational question or request for help
      const detectionPrompt = `
Analyze this message to determine if the user is asking a question, seeking help, or trying to have a conversation:

Message: "${messageContent}"

Respond with JSON containing:
{
  "isConversational": true/false,
  "confidence": 0.0-1.0,
  "queryType": "context_specific|general_question|personal_help|creative_help|information_request|compliment|feedback|casual_chat|none"
}

Examples of appropriate conversational messages:
- "What should I make for dinner?" (when they have saved recipes)
- "Tell me about my politics stuff" (when they have saved political content)
- "How many messages have I saved?" (Context-specific)
- "What's my account status?" (Context-specific)
- "Thanks!" (brief acknowledgment)
- "What's the recipe for that pasta?" (specific content question)

Examples that should NOT trigger conversational AI:
- "What's the weather?" (general questions not related to saved content)
- "Tell me a joke" (entertainment requests)
- "How do I cook pasta?" (general how-to questions)
- "What's 25 * 47?" (math questions)
- "Can you help me write something?" (writing assistance)
- Most questions that aren't about their saved Context content

Examples that are NOT conversational:
- "Check out this recipe #cooking"
- "Meeting notes #work"
- "https://example.com #links"
- Messages with clear content being saved
- URLs with hashtags
- Normal organizational content with hashtags
`;

      const detectionResponse = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a smart assistant that detects conversational queries vs content being saved. Respond only with valid JSON."
          },
          {
            role: "user",
            content: detectionPrompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 150
      });

      const detection = JSON.parse(detectionResponse.choices[0].message.content || "{}");
      this.log(`Conversational detection result:`, detection);

      if (!detection.isConversational || detection.confidence < 0.85) {
        return { isConversational: false };
      }

      // Get relevant user content to make responses contextual
      const userContent = await this.getRelevantUserContent(userInfo.id, messageContent, storage);
      
      // Generate helpful response based on query type and user's actual content
      const responsePrompt = `
User asked: "${messageContent}"
Query type: ${detection.queryType}

User context (use only if relevant to Context-specific queries):
- Name: ${userInfo.displayName}
- Messages saved: ${userInfo.messageCount || 0}
- Private boards: ${userInfo.boardCount || 0}
- Shared boards: ${userInfo.sharedBoardCount || 0}
- Account age: ${userInfo.createdAt ? this.getAccountAge(userInfo.createdAt) : 'Unknown'}

User's relevant saved content (USE THIS to provide personalized answers):
${userContent.messages.length > 0 ? 
  `Found ${userContent.messages.length} relevant saved items:\n` + 
  userContent.messages.map((msg, i) => 
    `${i + 1}. [${msg.tags.join(', ')}] ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
  ).join('\n') 
  : 'No relevant saved content found - provide general helpful answer'}

You are Context's assistant. Only respond if you can use their saved content to be genuinely helpful:

- ONLY answer if their saved content is relevant to the question
- If they have saved recipes and ask about dinner: suggest specific dishes they saved
- If they have saved articles and ask about a topic: reference what they've saved
- For Context account questions: use their stats
- If NO relevant saved content: say "I don't see any saved content about that. Save some and I can help you find it later!"
- Keep responses very short and natural - like texting a friend
- Don't be overly helpful or chatty

Guidelines:
- Be very selective - only respond when you can actually help with their saved content
- Keep responses super short and casual (under 80 chars when possible)
- Talk like a friend, not a formal assistant
- If they don't have relevant saved content, keep the "no content" response brief

Examples:
- "You've got that Thai curry recipe and the pasta one in #dinner - try either?"
- "From your politics stuff: that voting article and the polls analysis. Which one?"
- "Cookie recipe ingredients: flour, sugar, eggs, chocolate chips, butter, vanilla"
- "I don't see any recipes saved. Save some and I'll help you pick!"
`;

      const responseGeneration = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are Context's assistant. Only respond when you can use their saved content. Be super brief and casual - like texting a friend. If they don't have relevant saved content, say so briefly and suggest saving content."
          },
          {
            role: "user",
            content: responsePrompt
          }
        ],
        temperature: 0.9,
        max_tokens: 80
      });

      const response = responseGeneration.choices[0].message.content?.trim();
      this.log(`Generated conversational response: "${response}"`);

      return {
        isConversational: true,
        response: response || "Nothing saved on that topic yet. Save some content and I can help you find it!"
      };

    } catch (error) {
      this.log(`Error handling conversational query:`, error instanceof Error ? error.message : String(error));
      return { isConversational: false };
    }
  }

  /**
   * Helper to calculate account age in a human-readable format
   */
  private getAccountAge(createdAt: Date): string {
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    
    if (ageDays === 0) return "Today";
    if (ageDays === 1) return "1 day";
    if (ageDays < 7) return `${ageDays} days`;
    if (ageDays < 30) return `${Math.floor(ageDays / 7)} weeks`;
    if (ageDays < 365) return `${Math.floor(ageDays / 30)} months`;
    return `${Math.floor(ageDays / 365)} years`;
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;