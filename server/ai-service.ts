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
            content: "You are Context, a helpful SMS assistant. Generate friendly, concise responses about user's boards."
          },
          {
            role: "user",
            content: responsePrompt
          }
        ],
        temperature: 0.4,
        max_tokens: 200
      });

      const response = responseGeneration.choices[0].message.content?.trim() || "Here are your boards! Check your dashboard at https://contxt.life";
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
   * Handle comprehensive conversational queries about Context, account status, usage tips, etc.
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
    }
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

Examples of conversational messages:
- "What's the weather like?"
- "Can you help me write an email?"
- "How do I cook pasta?"
- "What's 25 * 47?"
- "Tell me a joke"
- "I'm feeling stressed, any advice?"
- "What's the capital of France?"
- "How many messages have I saved?" (Context-specific)
- "Can you explain quantum physics?"
- "Help me brainstorm ideas for my project"
- "What's my account status?" (Context-specific)
- "Thanks for your help!"
- "How's your day going?"
- "What should I make for dinner?"

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

      if (!detection.isConversational || detection.confidence < 0.7) {
        return { isConversational: false };
      }

      // Generate helpful response based on query type
      const responsePrompt = `
User asked: "${messageContent}"
Query type: ${detection.queryType}

User context (use only if relevant to Context-specific queries):
- Name: ${userInfo.displayName}
- Messages saved: ${userInfo.messageCount || 0}
- Private boards: ${userInfo.boardCount || 0}
- Shared boards: ${userInfo.sharedBoardCount || 0}
- Account age: ${userInfo.createdAt ? this.getAccountAge(userInfo.createdAt) : 'Unknown'}

You are a helpful AI assistant. Respond naturally and helpfully to the user's question:

- For general questions: Provide accurate, helpful information
- For personal help/advice: Be supportive and practical
- For creative requests: Be imaginative and helpful
- For Context-specific queries: Use their actual stats when relevant
- For casual chat: Be friendly and engaging
- For compliments: Respond graciously but briefly

Guidelines:
- Be conversational and natural, not robotic
- Keep responses concise for SMS delivery (under 160 chars when possible)
- Only mention Context features if directly relevant to their question
- Don't force hashtag suggestions unless they specifically ask about organization
- Be genuinely helpful with any question they ask
- Use their name occasionally but don't overdo it
- For complex topics, provide clear, actionable information
`;

      const responseGeneration = await this.client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a helpful, knowledgeable AI assistant. Be conversational, accurate, and genuinely helpful. Answer any question the user has - whether it's about Context, general knowledge, personal advice, or creative help. Keep responses concise for SMS but informative."
          },
          {
            role: "user",
            content: responsePrompt
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      });

      const response = responseGeneration.choices[0].message.content?.trim();
      this.log(`Generated conversational response: "${response}"`);

      return {
        isConversational: true,
        response: response || "I'm here to help! Feel free to ask me anything you'd like to know."
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