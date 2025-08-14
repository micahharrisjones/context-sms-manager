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

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      log("Cannot send SMS: Missing Twilio configuration");
      return false;
    }

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
          To: to,
          Body: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        log(`Failed to send SMS to ${to}: ${response.status} - ${errorData}`);
        return false;
      }

      const result = await response.json();
      log(`SMS sent successfully to ${to}: ${result.sid}`);
      return true;
    } catch (error) {
      log(`Error sending SMS to ${to}:`, error instanceof Error ? error.message : String(error));
      return false;
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