import { log } from "./vite";
import { MagicLinkService } from "./magic-link-service";

// Onboarding steps - matches the schema enum
export type OnboardingStep = 
  | "welcome_sent"        // Step 1: Welcome SMS sent, waiting for first text
  | "first_text"         // Step 2: First text received, asking for hashtag  
  | "first_hashtag"      // Step 3: First hashtag received, asking for link
  | "first_link"         // Step 4: First link received, revealing dashboard
  | "dashboard_revealed" // Step 5: Dashboard link sent, closing onboarding
  | "completed";         // Onboarding finished

// Built-in onboarding messages - no database seeding required
const ONBOARDING_MESSAGES = {
  welcome: `👋 Welcome to Aside! This is your space to save any text by sending it here.

Let's try it — send me a text right now, anything you want.`,
  
  first_text: `✅ Saved! This text is now in your private space — only you can see it.

Next, let's organize. Try sending a text with a hashtag, like:
#quotes To be, or not to be`,
  
  first_hashtag: `✨ Perfect! You just created your first board: {firstTag}.
Every time you add #{firstTag} to a text, it'll land there automatically.

Now let's try saving a link — maybe a recipe, an Instagram post, or a movie review. Just paste any link here.`,
  
  first_link: `🔗 Got it — your link's been saved!
Now let's go see all your texts organized in one place.

👉 {dashboardUrl}`,
  
  completion: `🎉 You're all set! From now on, just text me anything — links, reminders, ideas — and it'll be saved to your account.

If you ever get stuck or have a question, just text #support followed by your question — I'll help you out.

Welcome to Aside — your texts, organized.`
} as const;

export class OnboardingService {
  private twilioService: any;
  private storage: any;

  constructor(twilioService: any, storage: any) {
    this.twilioService = twilioService;
    this.storage = storage;
  }

  // Get welcome message for new users - simplified single message
  async getWelcomeMessage(phoneNumber: string): Promise<string> {
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    
    // Get user by phone number to create magic link
    const user = await this.storage.getUserByPhoneNumber(cleanPhoneNumber);
    
    let dashboardUrl = 'https://textaside.app'; // Fallback URL
    
    if (user) {
      try {
        // Generate secure magic link token (30 min expiry, one-time use)
        const { url } = await MagicLinkService.createMagicLink(user.id);
        dashboardUrl = url;
        log(`Generated secure magic link for user ${user.id}`);
      } catch (error) {
        log(`Failed to generate magic link for user ${user.id}:`, error instanceof Error ? error.message : String(error));
        // Fallback to base URL if magic link generation fails
      }
    } else {
      log(`Warning: Could not find user for phone ${cleanPhoneNumber} when generating welcome message`);
    }
    
    return `👋 Welcome to Aside! This is your personal space to save anything from anywhere just by texting it here.

📱 How it works:
• Text me anything - quotes, links, lyrics, ideas, recipes, etc
• Add a hashtag like #movies or #recipes to organize your messages into boards
• Everything is saved and searchable in your dashboard

🙋 Need help? Just text me a question like "What boards do I have?" and I'll do my best to answer. 

🔗 Access your dashboard: ${dashboardUrl}

(Link expires in 30 minutes for security)`;
  }

  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Skip SMS for test numbers containing 555 or other problematic patterns
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const usNumber = digitsOnly.startsWith('1') && digitsOnly.length === 11 ? digitsOnly.slice(1) : digitsOnly;
    
    // Check for various problematic patterns
    const isProblematic = usNumber.includes('555') || 
                          /^(800|888|877|866|855|844|833|822|880|881|882|883|884|885|886|887|889)/.test(usNumber) ||
                          /^(900|976|411|511|611|711|811|911)/.test(usNumber);
    
    return !isProblematic;
  }

  async handleOnboardingProgress(userId: number, messageContent: string, tags: string[]): Promise<boolean> {
    try {
      const user = await this.storage.getUserById(userId);
      if (!user || !user.onboardingStep || user.onboardingStep === "completed") {
        return false; // User not in onboarding or already completed
      }

      log(`Processing simplified onboarding for user ${userId} - completing onboarding immediately`);

      // In the simplified flow, any message from a user in onboarding immediately completes it
      await this.storage.updateUserOnboardingStep(userId, "completed");
      await this.storage.markOnboardingCompleted(userId);
      
      log(`Completed simplified onboarding for user ${userId}`);
      return true;
    } catch (error) {
      log(`Error in onboarding progress: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }


  // Send the shared boards follow-up after completion
  async sendSharedBoardsIntroduction(userId: number): Promise<void> {
    try {
      const user = await this.storage.getUserById(userId);
      if (!user || user.onboardingStep !== "completed") {
        return;
      }

      // Send follow-up after 1 hour or 5-10 texts
      const followUpMessage = `✨ Bonus: Did you know you can share boards with friends?
Just text:
Share #movies with 5551234567

They'll get an invite to join your board.`;

      await this.twilioService.sendSMS(user.phoneNumber, followUpMessage);
      log(`Sent shared boards introduction to user ${userId}`);
    } catch (error) {
      log(`Error sending shared boards introduction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}