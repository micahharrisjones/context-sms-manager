import { log } from "./vite";

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
  welcome: `👋 Welcome to Context! This is your space to save any text by sending it here.

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

Welcome to Context — your texts, organized.`
} as const;

export class OnboardingService {
  private twilioService: any;
  private storage: any;

  constructor(twilioService: any, storage: any) {
    this.twilioService = twilioService;
    this.storage = storage;
  }

  // Get welcome message for new users
  async getWelcomeMessage(): Promise<string> {
    try {
      const dbMessage = await this.storage.getOnboardingMessage("welcome");
      if (dbMessage && dbMessage.isActive === "true") {
        return dbMessage.content;
      }
      log("Welcome message not found in database or disabled, using fallback");
      return ONBOARDING_MESSAGES.welcome;
    } catch (error) {
      log(`Error fetching welcome message from database: ${error instanceof Error ? error.message : String(error)}`);
      return ONBOARDING_MESSAGES.welcome;
    }
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

      log(`Processing onboarding step ${user.onboardingStep} for user ${userId}`);

      switch (user.onboardingStep) {
        case "welcome_sent":
          return await this.handleFirstText(userId, messageContent, user.phoneNumber);
        
        case "first_text":
          return await this.handleFirstHashtag(userId, messageContent, tags, user.phoneNumber);
        
        case "first_hashtag":
          return await this.handleFirstLink(userId, messageContent, user.phoneNumber);
        
        default:
          return false; // Already completed or unknown step
      }
    } catch (error) {
      log(`Error in onboarding progress: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async handleFirstText(userId: number, messageContent: string, phoneNumber: string): Promise<boolean> {
    // Check if this is a problematic number before sending SMS
    if (!this.isValidPhoneNumber(phoneNumber)) {
      log(`Skipping onboarding SMS for potentially unreachable number: ${phoneNumber}`);
      // Still update the step but don't send SMS
      await this.storage.updateUserOnboardingStep(userId, "first_text");
      return true;
    }

    // Fetch message from database with fallback
    let message: string;
    try {
      const dbMessage = await this.storage.getOnboardingMessage("first_text");
      if (dbMessage && dbMessage.isActive === "true") {
        message = dbMessage.content;
      } else {
        log("First text message not found in database or disabled, using fallback");
        message = ONBOARDING_MESSAGES.first_text;
      }
    } catch (error) {
      log(`Error fetching first_text message from database: ${error instanceof Error ? error.message : String(error)}`);
      message = ONBOARDING_MESSAGES.first_text;
    }

    await this.twilioService.sendSMS(phoneNumber, message);
    await this.storage.updateUserOnboardingStep(userId, "first_text");
    
    log(`Sent step 2 onboarding message to user ${userId}`);
    return true;
  }

  private async handleFirstHashtag(userId: number, messageContent: string, tags: string[], phoneNumber: string): Promise<boolean> {
    if (tags.length === 0) {
      return false; // Not a hashtag message, wait for one
    }

    // Check if this is a problematic number before sending SMS
    if (!this.isValidPhoneNumber(phoneNumber)) {
      log(`Skipping onboarding SMS for potentially unreachable number: ${phoneNumber}`);
      await this.storage.updateUserOnboardingStep(userId, "first_hashtag");
      return true;
    }

    // Fetch message from database with fallback and template replacement
    let baseMessage: string;
    try {
      const dbMessage = await this.storage.getOnboardingMessage("first_hashtag");
      if (dbMessage && dbMessage.isActive === "true") {
        baseMessage = dbMessage.content;
      } else {
        log("First hashtag message not found in database or disabled, using fallback");
        baseMessage = ONBOARDING_MESSAGES.first_hashtag;
      }
    } catch (error) {
      log(`Error fetching first_hashtag message from database: ${error instanceof Error ? error.message : String(error)}`);
      baseMessage = ONBOARDING_MESSAGES.first_hashtag;
    }

    // Replace placeholder for hashtag name
    const firstTag = tags[0].charAt(0) === '#' ? tags[0].slice(1) : tags[0];
    const personalizedMessage = baseMessage.replace(/\{firstTag\}/g, firstTag);

    await this.twilioService.sendSMS(phoneNumber, personalizedMessage);
    await this.storage.updateUserOnboardingStep(userId, "first_hashtag");
    
    log(`Sent step 3 onboarding message to user ${userId}`);
    return true;
  }

  private async handleFirstLink(userId: number, messageContent: string, phoneNumber: string): Promise<boolean> {
    // Check if message contains a URL
    const urlRegex = /https?:\/\/[^\s]+/;
    if (!urlRegex.test(messageContent)) {
      return false; // Not a link, wait for one
    }

    // Check if this is a problematic number before sending SMS
    if (!this.isValidPhoneNumber(phoneNumber)) {
      log(`Skipping onboarding SMS for potentially unreachable number: ${phoneNumber}`);
      await this.storage.updateUserOnboardingStep(userId, "first_link");
      // Immediately complete onboarding for problematic numbers
      await this.handleDashboardReveal(userId, phoneNumber);
      return true;
    }

    // Fetch message from database with fallback and template replacement
    let baseMessage: string;
    try {
      const dbMessage = await this.storage.getOnboardingMessage("first_link");
      if (dbMessage && dbMessage.isActive === "true") {
        baseMessage = dbMessage.content;
      } else {
        log("First link message not found in database or disabled, using fallback");
        baseMessage = ONBOARDING_MESSAGES.first_link;
      }
    } catch (error) {
      log(`Error fetching first_link message from database: ${error instanceof Error ? error.message : String(error)}`);
      baseMessage = ONBOARDING_MESSAGES.first_link;
    }

    // Replace placeholder for dashboard URL
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    const dashboardUrl = `https://contxt.life/auto-login/${cleanPhoneNumber}`;
    const personalizedMessage = baseMessage.replace(/\{dashboardUrl\}/g, dashboardUrl);

    await this.twilioService.sendSMS(phoneNumber, personalizedMessage);
    await this.storage.updateUserOnboardingStep(userId, "first_link");
    
    log(`Sent step 4 onboarding message to user ${userId}`);
    
    // Immediately trigger completion after sending the dashboard link
    await this.handleDashboardReveal(userId, phoneNumber);
    
    return true;
  }

  private async handleDashboardReveal(userId: number, phoneNumber: string): Promise<boolean> {
    // Check if this is a problematic number before sending SMS
    if (!this.isValidPhoneNumber(phoneNumber)) {
      log(`Skipping onboarding SMS for potentially unreachable number: ${phoneNumber}`);
      await this.storage.updateUserOnboardingStep(userId, "completed");
      await this.storage.markOnboardingCompleted(userId);
      return true;
    }

    // Fetch completion message from database with fallback
    let message: string;
    try {
      const dbMessage = await this.storage.getOnboardingMessage("completion");
      if (dbMessage && dbMessage.isActive === "true") {
        message = dbMessage.content;
      } else {
        log("Completion message not found in database or disabled, using fallback");
        message = ONBOARDING_MESSAGES.completion;
      }
    } catch (error) {
      log(`Error fetching completion message from database: ${error instanceof Error ? error.message : String(error)}`);
      message = ONBOARDING_MESSAGES.completion;
    }

    await this.twilioService.sendSMS(phoneNumber, message);
    await this.storage.updateUserOnboardingStep(userId, "completed");
    await this.storage.markOnboardingCompleted(userId);
    
    log(`Completed onboarding for user ${userId}`);
    return true;
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