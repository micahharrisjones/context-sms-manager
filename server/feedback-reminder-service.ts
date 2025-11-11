import { log } from "./vite";
import type { IStorage } from "./storage";
import { twilioService } from "./twilio-service";
import { pendoServerService } from "./pendo-service";

interface FeedbackReminderResult {
  oneMonth: {
    sent: number;
    failed: number;
  };
  threeMonths: {
    sent: number;
    failed: number;
  };
  sixMonths: {
    sent: number;
    failed: number;
  };
}

/**
 * FeedbackReminderService - Sends automated feedback reminders at milestone anniversaries
 * Designed to be triggered manually via admin endpoint but structured for future automation
 */
export class FeedbackReminderService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Run feedback reminder job for all eligible milestones
   * Returns summary of sends and failures
   */
  async runFeedbackReminders(): Promise<FeedbackReminderResult> {
    log("📅 Starting feedback reminder job...");

    const result: FeedbackReminderResult = {
      oneMonth: { sent: 0, failed: 0 },
      threeMonths: { sent: 0, failed: 0 },
      sixMonths: { sent: 0, failed: 0 },
    };

    try {
      // Process each milestone
      const oneMonthResults = await this.processMilestone(1);
      result.oneMonth = oneMonthResults;

      const threeMonthResults = await this.processMilestone(3);
      result.threeMonths = threeMonthResults;

      const sixMonthResults = await this.processMilestone(6);
      result.sixMonths = sixMonthResults;

      log(`✅ Feedback reminder job complete: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      log(`❌ Error in feedback reminder job: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process a specific milestone (1, 3, or 6 months)
   * Finds eligible users and sends reminders
   */
  private async processMilestone(months: 1 | 3 | 6): Promise<{ sent: number; failed: number }> {
    const result = { sent: 0, failed: 0 };

    try {
      log(`Processing ${months}-month milestone...`);

      // Calculate the target date window (users created around this date)
      const now = new Date();
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() - months);

      // Get eligible users (created ~months ago, active in last 30 days, not already sent)
      const eligibleUsers = await this.getEligibleUsers(months, targetDate);
      log(`Found ${eligibleUsers.length} eligible users for ${months}-month reminder`);

      // Send reminders with rate limiting
      for (const user of eligibleUsers) {
        try {
          const message = this.getFeedbackMessage(months);
          const success = await twilioService.sendSMS(user.phoneNumber, message);

          if (success) {
            // Mark reminder as sent
            await this.storage.markFeedbackReminderSent(user.id, months);
            result.sent++;
            log(`✓ Sent ${months}-month reminder to user ${user.id}`);
            
            // Track anniversary message sent in Pendo
            try {
              await pendoServerService.trackEvent(
                "Anniversary_Message_Sent",
                user.phoneNumber,
                "aside",
                {
                  anniversaryMonths: months,
                  userId: user.id,
                  messageType: 'feedback_reminder',
                }
              );
              log(`✓ Tracked Anniversary_Message_Sent event for user ${user.id} (${months} months)`);
            } catch (pendoError) {
              log(`⚠️  Failed to track Pendo event: ${pendoError instanceof Error ? pendoError.message : String(pendoError)}`);
              // Don't fail the whole operation if Pendo tracking fails
            }
          } else {
            result.failed++;
            log(`✗ Failed to send ${months}-month reminder to user ${user.id}`);
          }

          // Rate limiting: 1.1 second delay to stay under Twilio's ~1 msg/sec limit for long codes
          await new Promise(resolve => setTimeout(resolve, 1100));
        } catch (error) {
          result.failed++;
          log(`Error sending ${months}-month reminder to user ${user.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      log(`Completed ${months}-month milestone: ${result.sent} sent, ${result.failed} failed`);
      return result;
    } catch (error) {
      log(`Error processing ${months}-month milestone: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Get eligible users for a specific milestone
   * Criteria:
   * - Created approximately 'months' ago (within ±3 days window)
   * - Active in last 30 days (sent or received SMS)
   * - Haven't already received this milestone reminder
   */
  private async getEligibleUsers(months: number, targetDate: Date): Promise<any[]> {
    try {
      // Define window: ±3 days from target date
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 3);
      
      const endDate = new Date(targetDate);
      endDate.setDate(endDate.getDate() + 3);

      // Query users who were created in this window and are active
      const eligibleUsers = await this.storage.getEligibleFeedbackReminderUsers(
        months,
        startDate,
        endDate
      );

      return eligibleUsers;
    } catch (error) {
      log(`Error getting eligible users: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Get feedback message template for a specific milestone
   */
  private getFeedbackMessage(months: 1 | 3 | 6): string {
    const messages = {
      1: `🎉 It's our one-month anniversary! Time flies, right?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback`,
      
      3: `🎉 It's our three-month anniversary! Can you believe it?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback`,
      
      6: `🎉 It's our six-month anniversary! Remember when we first met?

Got feedback, ideas, or things we could do better? We'd love to hear from you: textaside.app/feedback`,
    };

    return messages[months];
  }
}

export const feedbackReminderService = (storage: IStorage) => new FeedbackReminderService(storage);
