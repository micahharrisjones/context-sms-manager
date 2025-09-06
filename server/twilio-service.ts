import { log } from "./vite";

// Twilio SMS Service for sending notifications
class TwilioService {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      log("Warning: Twilio credentials not properly configured for SMS notifications");
    }
  }

  // Helper function to detect if a phone number might be a landline or problematic number
  private isPotentiallyUnreachableNumber(phoneNumber: string): boolean {
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Remove country code if present for analysis
    const usNumber = digitsOnly.startsWith('1') && digitsOnly.length === 11 ? digitsOnly.slice(1) : digitsOnly;
    
    if (usNumber.length !== 10) return true; // Invalid length
    
    const areaCode = usNumber.substring(0, 3);
    const exchange = usNumber.substring(3, 6);
    
    // Test numbers (555 in any position)
    if (usNumber.includes('555')) {
      return true;
    }
    
    // Common patterns that might indicate landlines or problematic numbers
    // These patterns are often associated with landlines or non-SMS capable numbers
    const problematicPatterns = [
      // Certain area code + exchange combinations that are often landlines
      /^(800|888|877|866|855|844|833|822|880|881|882|883|884|885|886|887|889)/, // Toll-free
      /^(900|976)/, // Premium rate services
      /^(411|511|611|711|811|911)/, // Service numbers
    ];
    
    return problematicPatterns.some(pattern => pattern.test(usNumber));
  }

  // Helper function to format phone number to E164 format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Check if this number might be unreachable for SMS
    if (this.isPotentiallyUnreachableNumber(phoneNumber)) {
      log(`Rejecting potentially unreachable phone number: ${phoneNumber}`);
      throw new Error(`Invalid phone number: ${phoneNumber}. This number may be a landline or unable to receive SMS.`);
    }
    
    // If it starts with 1 and has 11 digits, it's already in good format
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }
    
    // If it has 10 digits, add US country code
    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }
    
    // If it already starts with +, validate it has proper length
    if (phoneNumber.startsWith('+')) {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      if (cleanNumber.length >= 10 && cleanNumber.length <= 15) {
        return phoneNumber;
      }
    }
    
    // Reject invalid formats
    throw new Error(`Invalid phone number format: ${phoneNumber}. Must be 10-15 digits in E164 format.`);
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      log("Cannot send SMS: Missing Twilio configuration");
      return false;
    }

    // Format the phone number to E164 format
    const formattedTo = this.formatPhoneNumber(to);
    log(`Formatted phone number from ${to} to ${formattedTo}`);

    try {
      // Use Twilio REST API to send SMS
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: this.fromNumber,
          To: formattedTo,
          Body: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log(`Failed to send SMS to ${formattedTo}: ${response.status} - ${errorData}`);
        return false;
      }

      const result = await response.json();
      log(`SMS sent successfully to ${formattedTo}: ${result.sid}`);
      return true;
    } catch (error) {
      // If it's a phone number validation error, just log and return false without spam
      if (error instanceof Error && error.message.includes('Invalid phone number format')) {
        log(`Skipping SMS to invalid phone number: ${to} - ${error.message}`);
        return false;
      }
      
      log(`Error sending SMS to ${formattedTo}:`, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  async sendWelcomeMessage(phoneNumber: string, storage?: any): Promise<void> {
    let welcomeMessage = `👋 Welcome to Context! This is your space to save any text by sending it here.

Let's try it — send me a text right now, anything you want.`;

    // Try to get welcome message from database if storage is provided
    if (storage) {
      try {
        const messageData = await storage.getOnboardingMessage("welcome");
        if (messageData && messageData.isActive === "true") {
          welcomeMessage = messageData.content;
        }
      } catch (error) {
        log(`Error fetching welcome message from database: ${error instanceof Error ? error.message : String(error)}`);
        // Fall back to default message
      }
    }

    try {
      log(`📧 SENDING WELCOME MESSAGE to ${phoneNumber}`);
      const success = await this.sendSMS(phoneNumber, welcomeMessage);
      if (success) {
        log(`✅ WELCOME MESSAGE SENT SUCCESSFULLY to ${phoneNumber}`);
      } else {
        log(`❌ WELCOME MESSAGE FAILED - sendSMS returned false for ${phoneNumber}`);
      }
    } catch (error) {
      log(`💥 WELCOME MESSAGE ERROR for ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
    }
  }

  async sendSharedBoardNotification(
    recipientPhoneNumbers: string[], 
    boardName: string, 
    messagePreview: string
  ): Promise<void> {
    const boardUrl = `https://contxt.life/board/${encodeURIComponent(boardName)}`;
    const notificationText = `🔔 Someone added to your shared board #${boardName}\n\n"${messagePreview.slice(0, 100)}${messagePreview.length > 100 ? '...' : ''}"\n\nView: ${boardUrl}\n\nReply STOP to unsubscribe`;

    const sendPromises = recipientPhoneNumbers.map(phoneNumber => 
      this.sendSMS(phoneNumber, notificationText)
    );

    try {
      const results = await Promise.allSettled(sendPromises);
      const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
      const failed = results.length - successful;
      
      log(`Shared board notification sent: ${successful} successful, ${failed} failed`);
    } catch (error) {
      log("Error sending shared board notifications:", error instanceof Error ? error.message : String(error));
    }
  }

  // Send bulk SMS messages to all users (admin broadcast feature)
  async sendBulkAdminMessage(phoneNumbers: string[], message: string): Promise<{
    successful: number;
    failed: number;
    details: Array<{ phoneNumber: string; success: boolean; error?: string }>;
  }> {
    const results = {
      successful: 0,
      failed: 0,
      details: [] as Array<{ phoneNumber: string; success: boolean; error?: string }>
    };

    log(`Starting admin bulk SMS broadcast to ${phoneNumbers.length} recipients`);

    for (const phoneNumber of phoneNumbers) {
      try {
        const success = await this.sendSMS(phoneNumber, message);
        
        if (success) {
          results.successful++;
          results.details.push({
            phoneNumber,
            success: true
          });
        } else {
          results.failed++;
          results.details.push({
            phoneNumber,
            success: false,
            error: "SMS sending failed"
          });
        }
        
        // Add a small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.details.push({
          phoneNumber,
          success: false,
          error: errorMessage
        });
        
        log(`Failed to send admin bulk SMS to ${phoneNumber}: ${errorMessage}`);
      }
    }

    log(`Admin bulk SMS broadcast completed. Successful: ${results.successful}, Failed: ${results.failed}`);
    return results;
  }
}

export const twilioService = new TwilioService();