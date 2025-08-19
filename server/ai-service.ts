import OpenAI from "openai";

interface CategorySuggestion {
  category: string;
  confidence: number;
  reasoning?: string;
}

class AIService {
  private client: OpenAI;
  private log: (message: string, ...args: any[]) => void;

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
}

// Export singleton instance
export const aiService = new AIService();
export default aiService;