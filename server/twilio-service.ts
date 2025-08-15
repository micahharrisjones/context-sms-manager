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

  // Helper function to format phone number to E164 format
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // Reject invalid phone numbers (like test numbers starting with 555)
    if (digitsOnly.includes('555')) {
      log(`Rejecting invalid test phone number: ${phoneNumber}`);
      throw new Error(`Invalid phone number format: ${phoneNumber}. Test numbers (555) are not supported by Twilio.`);
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

  async sendWelcomeMessage(phoneNumber: string): Promise<void> {
    const welcomeMessage = `Welcome to Context! 🎉

Your message has been saved and organized. Here's how Context works:

📱 Text messages with #hashtags to organize them into boards
🔗 Share links - we'll create rich previews automatically  
👥 Invite others to shared boards for collaboration
🌐 Access everything at your web dashboard

Visit your dashboard anytime to see all your organized messages, create shared boards, and invite collaborators.

Happy organizing!`;

    try {
      await this.sendSMS(phoneNumber, welcomeMessage);
      log(`Welcome message sent to new user: ${phoneNumber}`);
    } catch (error) {
      log(`Failed to send welcome message to ${phoneNumber}:`, error instanceof Error ? error.message : String(error));
    }
  }

  async sendSharedBoardNotification(
    recipientPhoneNumbers: string[], 
    boardName: string, 
    messagePreview: string
  ): Promise<void> {
    const notificationText = `🔔 Someone added to your shared board #${boardName}\n\n"${messagePreview.slice(0, 100)}${messagePreview.length > 100 ? '...' : ''}"\n\nReply STOP to unsubscribe`;

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
}

export const twilioService = new TwilioService();