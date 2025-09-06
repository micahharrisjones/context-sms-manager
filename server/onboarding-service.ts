import { log } from "./vite";

// Onboarding steps - matches the schema enum
export type OnboardingStep = 
  | "welcome_sent"        // Step 1: Welcome SMS sent, waiting for first text
  | "first_text"         // Step 2: First text received, asking for hashtag  
  | "first_hashtag"      // Step 3: First hashtag received, asking for link
  | "first_link"         // Step 4: First link received, revealing dashboard
  | "dashboard_revealed" // Step 5: Dashboard link sent, closing onboarding
  | "completed";         // Onboarding finished

export class OnboardingService {
  private twilioService: any;
  private storage: any;

  constructor(twilioService: any, storage: any) {
    this.twilioService = twilioService;
    this.storage = storage;
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
        
        case "first_link":
          return await this.handleDashboardReveal(userId, user.phoneNumber);
        
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

    // Get the message from database
    const messageData = await this.storage.getOnboardingMessage("first_text");
    if (!messageData || messageData.isActive !== "true") {
      log(`Onboarding message for first_text not found or inactive`);
      // Skip this step but update progress
      await this.storage.updateUserOnboardingStep(userId, "first_text");
      return true;
    }

    await this.twilioService.sendSMS(phoneNumber, messageData.content);
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

    // Get the message from database
    const messageData = await this.storage.getOnboardingMessage("first_hashtag");
    if (!messageData || messageData.isActive !== "true") {
      log(`Onboarding message for first_hashtag not found or inactive`);
      await this.storage.updateUserOnboardingStep(userId, "first_hashtag");
      return true;
    }

    // Replace placeholder for hashtag name
    const firstTag = tags[0].charAt(0) === '#' ? tags[0].slice(1) : tags[0];
    const personalizedMessage = messageData.content.replace(/\{firstTag\}/g, firstTag);

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
      return true;
    }

    // Get the message from database
    const messageData = await this.storage.getOnboardingMessage("first_link");
    if (!messageData || messageData.isActive !== "true") {
      log(`Onboarding message for first_link not found or inactive`);
      await this.storage.updateUserOnboardingStep(userId, "first_link");
      return true;
    }

    // Replace placeholder for dashboard URL
    const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
    const dashboardUrl = `https://contxt.life/auto-login/${cleanPhoneNumber}`;
    const personalizedMessage = messageData.content.replace(/\{dashboardUrl\}/g, dashboardUrl);

    await this.twilioService.sendSMS(phoneNumber, personalizedMessage);
    await this.storage.updateUserOnboardingStep(userId, "first_link");
    
    log(`Sent step 4 onboarding message to user ${userId}`);
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

    // Get the completion message from database
    const messageData = await this.storage.getOnboardingMessage("completion");
    if (!messageData || messageData.isActive !== "true") {
      log(`Onboarding message for completion not found or inactive`);
      await this.storage.updateUserOnboardingStep(userId, "completed");
      await this.storage.markOnboardingCompleted(userId);
      return true;
    }

    await this.twilioService.sendSMS(phoneNumber, messageData.content);
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