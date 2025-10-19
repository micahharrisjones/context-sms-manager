import type { Express, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { WebSocketManager } from "./websocket";
import { log } from "./vite";
import { pool } from "./db";
import { AuthService, generateTwilioResponse, requireAuth } from "./auth";
import { twilioService } from "./twilio-service";
import { tmdbService } from "./tmdb-service";
import { openGraphService } from "./og-service";
import aiService from "./ai-service";
import { OnboardingService } from "./onboarding-service";
import { MagicLinkService } from "./magic-link-service";
import { pendoServerService } from "./pendo-service";
import { embeddingService } from "./embedding-service";
import { microlinkQueue } from "./request-queue";
import { asideAIService } from "./aside-ai-service";

// Middleware to check database connection
async function checkDatabaseConnection(req: any, res: any, next: any) {
  try {
    const client = await pool.connect();
    client.release();
    next();
  } catch (error) {
    log("Database connection check failed:", error instanceof Error ? error.message : String(error));
    res.status(503).json({ 
      error: "Database connection unavailable",
      message: "Please try again in a few moments"
    });
  }
}

// Helper function to convert board name to hashtag slug format
function createBoardSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Admin-only hashtags that only admins can see
const ADMIN_ONLY_HASHTAGS = [
  'feedback',
  'admin-feedback', 
  'user-input',
  'survey',
  'bug-report',
  'feature-request'
];

// Global deduplication cache to prevent duplicate SMS notifications within a time window
const smsNotificationCache = new Map<string, number>();
const SMS_DEDUP_WINDOW_MS = 30000; // 30 seconds

// Notification debouncing to handle rapid messages from same sender
interface PendingNotification {
  boardName: string;
  phoneNumbers: string[];
  messages: string[];
  timeoutId: NodeJS.Timeout;
}
const pendingNotifications = new Map<string, PendingNotification>(); // key: "boardId:userId"
const NOTIFICATION_DEBOUNCE_MS = 10000; // 10 seconds - wait for additional messages

// Pending invite signups - track phone numbers waiting for YES confirmation
interface PendingInviteSignup {
  phoneNumber: string;
  inviteCode: string;
  timestamp: number;
}
const pendingInviteSignups = new Map<string, PendingInviteSignup>(); // key: normalized phone number
const PENDING_SIGNUP_TTL_MS = 3600000; // 1 hour expiry

// ========== OLD SEARCH SESSION TRACKING - NO LONGER USED ==========
// Search now handled by "Hey Aside [query]" - no session tracking needed
// interface SearchSession {
//   query: string;
//   results: any[];
//   currentIndex: number;
//   timestamp: number;
// }
// const searchSessions = new Map<string, SearchSession>(); // key: normalized phone number
// const SEARCH_SESSION_TTL_MS = 300000; // 5 minutes expiry
// ========== END OLD SEARCH SESSION TRACKING ==========

// Normalize phone number to E.164-like format for consistent deduplication
// This is a simple normalization without validation - just for comparison purposes
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  const digitsOnly = phoneNumber.replace(/\D/g, '');
  
  // If it starts with 1 and has 11 digits, add + prefix
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`;
  }
  
  // If it has 10 digits, add US country code +1
  if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`;
  }
  
  // For any other format, just return with + if it's not already there
  if (phoneNumber.startsWith('+')) {
    return phoneNumber;
  }
  
  return `+${digitsOnly}`;
}

// ========== OLD SEARCH DETECTION LOGIC - REPLACED BY "HEY ASIDE" ==========
// These functions are no longer used but kept for reference
// All search now goes through "Hey Aside [query]" pattern

/*
// Detect if a message is a search query
// STRICT DETECTION: Only trigger for very clear search intent to avoid false positives
function isSearchQuery(content: string): boolean {
  const lower = content.toLowerCase().trim();
  
  // CRITICAL: Never treat messages with URLs as search queries
  // URLs indicate the user is saving content, not searching
  if (content.includes('http://') || content.includes('https://')) {
    return false;
  }
  
  // Only trigger on question mark if it's near the end (within last 10 chars)
  // AND the message is asking a question (not just enthusiastic like "What a find!")
  const questionMarkIndex = content.lastIndexOf('?');
  if (questionMarkIndex >= 0 && questionMarkIndex >= content.length - 10) {
    // Additional check: question must be asking about saved content
    // Not just general questions or statements
    const questionWords = ['do i', 'did i', 'where', 'can you', 'have i', 'is there'];
    if (questionWords.some(word => lower.includes(word))) {
      return true;
    }
    // Otherwise, not a search query even with ?
    return false;
  }
  
  // Starts with common question words/phrases (must be exact word boundaries)
  // REDUCED LIST: Only very explicit search commands
  const questionStarters = [
    'do i have',
    'did i save',
    'where is',
    'where\'s the',
    'search for',
    'search',
    'find my',
    'can you find',
    'look for my',
    'is there a'
  ];
  
  // Only match if the starter is at the beginning and followed by a space, ?, or end of string
  return questionStarters.some(starter => {
    if (lower.startsWith(starter)) {
      // Make sure it's a complete word/phrase, not part of a longer word
      const nextChar = lower.charAt(starter.length);
      return nextChar === '' || nextChar === ' ' || nextChar === '?';
    }
    return false;
  });
}

// Detect if a message is a negative response to a search result
function isNegativeResponse(content: string): boolean {
  const lower = content.toLowerCase().trim();
  
  // Only consider very short, clear negative responses to avoid false positives
  // Messages with hashtags or URLs are never negative responses
  if (content.includes('#') || content.includes('http')) {
    return false;
  }
  
  // Must be a short message (under 30 chars) to be a negative response
  if (lower.length > 30) {
    return false;
  }
  
  const negativeIndicators = [
    'no',
    'nope',
    'not it',
    'not that',
    'not what i',
    'that\'s not',
    'thats not',
    'wrong',
    'incorrect',
    'different',
    'not the one',
    'try again',
    'next',
    'another'
  ];
  
  return negativeIndicators.some(indicator => lower.includes(indicator));
}

// Format search results for SMS response
function formatSearchResultsForSMS(results: any[], query: string, isFollowUp: boolean = false, resultIndex: number = 0): string {
  if (results.length === 0) {
    return `No results found for "${query}". Try a different search or text with #tags to save new content.`;
  }
  
  // Check if we've exhausted all results
  if (resultIndex >= results.length) {
    return `Sorry, I've shown you all the results I found. Try a different search or view all at https://textaside.app`;
  }
  
  // Get the result at the specified index
  const result = results[resultIndex];
  
  // Extract title from content (first 60 chars or until newline)
  let title = result.content.split('\n')[0].substring(0, 60);
  if (result.content.length > 60) title += '...';
  
  // Extract URL if present
  const urlMatch = result.content.match(/(https?:\/\/[^\s]+)/);
  
  // Use conversational intro based on whether it's a follow-up
  const intro = isFollowUp 
    ? `Oh, sorry. What about this one?\n\n${title}`
    : `I think I found what you're looking for. Is this it?\n\n${title}`;
  
  let response = intro;
  if (urlMatch) {
    response += `\n${urlMatch[0]}`;
  }
  
  // Add link to view all results in Aside
  response += `\n\nView all in Aside: https://textaside.app`;
  
  return response;
}
*/
// ========== END OLD SEARCH DETECTION LOGIC ==========

// Function to check and record SMS notification attempts
// Uses phone number + message hash for deduplication (one notification per user per message)
function shouldSendNotification(phoneNumber: string, boardId: number, messageContent: string): boolean {
  // Normalize phone number before using it in cache key to prevent duplicates from different formats
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  
  // Create a hash of the full message content to avoid collisions while keeping key manageable
  const messageHash = hashString(messageContent);
  // Don't include boardId - we only want ONE notification per user per message, regardless of how many boards they're in
  const cacheKey = `${normalizedPhone}:${messageHash}`;
  const now = Date.now();
  const lastSent = smsNotificationCache.get(cacheKey);
  
  if (lastSent && (now - lastSent) < SMS_DEDUP_WINDOW_MS) {
    log(`🚫 DUPLICATE BLOCKED: Already sent notification to ${phoneNumber} (normalized: ${normalizedPhone}) for this message within last ${SMS_DEDUP_WINDOW_MS/1000}s`);
    return false;
  }
  
  smsNotificationCache.set(cacheKey, now);
  
  // Clean up only old entries that have expired
  const keysToDelete: string[] = [];
  for (const [key, timestamp] of Array.from(smsNotificationCache.entries())) {
    if (now - timestamp > SMS_DEDUP_WINDOW_MS) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => smsNotificationCache.delete(key));
  
  return true;
}

// Simple hash function for message content
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// Check if a hashtag is admin-only
function isAdminOnlyHashtag(hashtag: string): boolean {
  return ADMIN_ONLY_HASHTAGS.includes(hashtag.toLowerCase());
}

// Check if user is admin based on phone number
async function isUserAdmin(userId: number): Promise<boolean> {
  try {
    const user = await storage.getUserById(userId);
    if (!user) return false;
    
    const adminPhoneNumbers = [
      "6155848598", // Main admin number
      "3182081034", // Additional admin number
      "4582188508", // Official Context number without +1
      "+14582188508" // Official Context number with +1
    ];
    
    return adminPhoneNumbers.some((adminPhone: string) => {
      const normalizedUserPhone = user.phoneNumber.replace(/^\+?1?/, '');
      const normalizedAdminPhone = adminPhone.replace(/^\+?1?/, '');
      return normalizedUserPhone === normalizedAdminPhone;
    });
  } catch (error) {
    log(`Error checking if user is admin: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// Helper function to extract hashtags from content
function extractHashtags(content: string): string[] {
  // Pre-strip URLs to prevent URL anchors from being detected as hashtags
  const sanitized = content.replace(/https?:\/\/\S+/g, ' ');
  // Updated regex to support hyphenated hashtags
  const tags = (sanitized.match(/#[\w-]+/g) || [])
    .map((tag: string) => createBoardSlug(tag.slice(1))); // Normalize to lowercase slug format
  return Array.from(new Set(tags)); // Remove duplicates
}

const twilioWebhookSchema = z.object({
  Body: z.string(),
  From: z.string(),
  To: z.string(),
  MessageSid: z.string().optional(),
  SmsMessageSid: z.string().optional(),
  AccountSid: z.string(),
  NumMedia: z.string().optional().default("0"),
  MediaUrl0: z.string().optional().nullable(),
  MediaContentType0: z.string().optional().nullable(),
  // Handle multi-part SMS messages
  NumSegments: z.string().optional(),
  MessageStatus: z.string().optional(),
  SmsStatus: z.string().optional(),
});

// Helper function to get recent tags from the same sender for a specific user
async function getRecentTagsFromSender(userId: number, senderId: string): Promise<string[]> {
  try {
    // Get messages from the last 5 minutes from the same sender for this user
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentMessages = await storage.getRecentMessagesBySender(userId, senderId, fiveMinutesAgo);
    
    // Find the most recent message with hashtags (excluding "untagged")
    for (const message of recentMessages) {
      const nonUntaggedTags = message.tags.filter(tag => tag !== "untagged");
      if (nonUntaggedTags.length > 0) {
        return nonUntaggedTags;
      }
    }
    return [];
  } catch (error) {
    log("Error getting recent tags:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Helper function to get user's existing boards for AI categorization
async function getUserBoards(userId: number): Promise<{ privateBoards: string[]; sharedBoards: string[] }> {
  try {
    const [privateTags, userSharedBoards] = await Promise.all([
      storage.getTags(userId),
      storage.getUserBoardMemberships(userId)
    ]);
    
    const sharedBoardNames = userSharedBoards.map(membership => membership.board.name);
    
    return {
      privateBoards: privateTags,
      sharedBoards: sharedBoardNames
    };
  } catch (error) {
    log("Error getting user boards:", error instanceof Error ? error.message : String(error));
    return { privateBoards: [], sharedBoards: [] };
  }
}

// Helper function to get comprehensive user statistics for conversational AI
async function getUserStats(userId: number, user: any): Promise<{
  id: number;
  phoneNumber: string;
  displayName: string;
  messageCount: number;
  boardCount: number;
  sharedBoardCount: number;
  onboardingStep: string;
  createdAt: Date;
}> {
  try {
    const [userMessages, userBoards] = await Promise.all([
      storage.getMessages(userId),
      getUserBoards(userId)
    ]);
    
    return {
      id: userId,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName || user.firstName || `User ${user.phoneNumber.slice(-4)}`,
      messageCount: userMessages.length,
      boardCount: userBoards.privateBoards.length,
      sharedBoardCount: userBoards.sharedBoards.length,
      onboardingStep: user.onboardingStep || 'unknown',
      createdAt: user.createdAt || new Date()
    };
  } catch (error) {
    log("Error getting user stats:", error instanceof Error ? error.message : String(error));
    return {
      id: userId,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName || `User ${user.phoneNumber.slice(-4)}`,
      messageCount: 0,
      boardCount: 0,
      sharedBoardCount: 0,
      onboardingStep: 'unknown',
      createdAt: new Date()
    };
  }
}

// Post-processing function to fix untagged URL messages
async function fixUntaggedUrlMessage(messageId: number, userId: number, senderId: string, wsManager: WebSocketManager): Promise<void> {
  try {
    // Wait a bit for any concurrent messages to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const recentTags = await getRecentTagsFromSender(userId, senderId);
    if (recentTags.length > 0) {
      await storage.updateMessageTags(messageId, recentTags);
      log(`Updated message ${messageId} with inherited tags: [${recentTags.join(', ')}]`);
      
      // Broadcast WebSocket update for the corrected message
      wsManager.broadcastNewMessage();
    }
  } catch (error) {
    log("Error in post-processing:", error instanceof Error ? error.message : String(error));
  }
}

// Support Twilio webhook format

const processSMSWebhook = async (body: unknown, onboardingService?: any) => {
  log("Raw webhook payload:", JSON.stringify(body, null, 2));

  // Try Twilio format first
  const twilioResult = twilioWebhookSchema.safeParse(body);
  if (twilioResult.success) {
    log("Processing as Twilio webhook");
  } else {
    log("Twilio format validation failed:", JSON.stringify(twilioResult.error.issues, null, 2));
  }
  
  if (twilioResult.success) {
    const validatedData = twilioResult.data;

    // Log multi-part message info (Twilio automatically reassembles these)
    if (validatedData.NumSegments && parseInt(validatedData.NumSegments) > 1) {
      log(`Multi-part message received: ${validatedData.NumSegments} segments (already reassembled by Twilio)`);
    }

    // Verify this is from our Twilio account (optional validation)
    if (process.env.TWILIO_ACCOUNT_SID && validatedData.AccountSid !== process.env.TWILIO_ACCOUNT_SID) {
      log(`Warning: Account SID mismatch. Expected: ${process.env.TWILIO_ACCOUNT_SID}, Received: ${validatedData.AccountSid}`);
      // For now, we'll continue processing but log the warning
      // throw new Error("Invalid account SID");
    }

    const content = validatedData.Body;
    const senderId = validatedData.From;
    const recipientNumber = validatedData.To; // The Context phone number that received the message
    
    log(`Message from ${senderId} to Context number ${recipientNumber}`);
    
    // Check if this is a YES response to invite opt-in
    const normalizedReply = content.toLowerCase().trim();
    if (normalizedReply === 'yes') {
      const normalizedPhone = normalizePhoneNumber(senderId);
      const pendingSignup = pendingInviteSignups.get(normalizedPhone);
      
      if (pendingSignup) {
        // Check if pending signup hasn't expired (1 hour TTL)
        if (Date.now() - pendingSignup.timestamp < PENDING_SIGNUP_TTL_MS) {
          log(`✅ YES confirmation received for invite ${pendingSignup.inviteCode} from ${senderId}`);
          
          // Import invite service
          const { inviteService } = await import("./invite-service");
          
          try {
            // Check if user already exists (idempotency check)
            const existingUser = await storage.getUserByPhoneNumber(senderId);
            
            if (existingUser) {
              log(`User already exists for ${senderId}, tracking conversion only`);
              
              // Still track conversion if not already tracked
              if (!existingUser.referredBy) {
                await inviteService.trackConversion(pendingSignup.inviteCode, existingUser.id);
                log(`Tracked conversion for existing user ${existingUser.id}`);
              }
              
              // Track Pendo conversion completed for existing user
              await pendoServerService.trackInviteConversionCompleted(senderId, pendingSignup.inviteCode, existingUser.id);
              
              // Remove from pending signups
              pendingInviteSignups.delete(normalizedPhone);
              
              await twilioService.sendSMS(senderId, "You're already signed up! Start texting to save anything.");
              return null;
            }
            
            // Create user account
            const newUser = await storage.createUser({
              phoneNumber: senderId,
              displayName: `User ${senderId.slice(-4)}`,
              firstName: 'User',
              lastName: senderId.slice(-4),
              onboardingStep: "welcome_sent",
              referredBy: pendingSignup.inviteCode,
              signupMethod: "invite_link"
            });
            
            log(`🎉 Created invite user ${newUser.id} via code ${pendingSignup.inviteCode}`);
            
            // Track conversion
            await inviteService.trackConversion(pendingSignup.inviteCode, newUser.id);
            
            // Track Pendo conversion completed
            await pendoServerService.trackInviteConversionCompleted(senderId, pendingSignup.inviteCode, newUser.id);
            
            // Send welcome message
            await twilioService.sendWelcomeMessage(senderId, onboardingService);
            await storage.markOnboardingCompleted(newUser.id);
            
            // Remove from pending signups
            pendingInviteSignups.delete(normalizedPhone);
            
            log(`✅ Invite signup completed for ${senderId}`);
            
            // Don't save the YES message itself
            return null;
          } catch (error) {
            log(`Error completing invite signup: ${error instanceof Error ? error.message : String(error)}`);
            await twilioService.sendSMS(senderId, "Sorry, there was an error completing your signup. Please try again later.");
            return null;
          }
        } else {
          log(`Pending invite signup expired for ${senderId}`);
          pendingInviteSignups.delete(normalizedPhone);
        }
      }
    }
    
    // IMPORTANT: For SMS messages sent TO the Context phone number,
    // we need to find which user account this message belongs to.
    // Since we currently have one Twilio number shared across users,
    // we'll associate messages with the user who sent them (their authenticated account)
    
    // Find the user account based on the sender's phone number
    let user = await storage.getUserByPhoneNumber(senderId);
    let isNewUser = false;
    if (!user) {
      // If this sender doesn't have an account yet, create one
      // This allows people to start using Context without explicit signup
      user = await storage.createUser({
        phoneNumber: senderId,
        displayName: `User ${senderId.slice(-4)}`,
        firstName: `User`,
        lastName: senderId.slice(-4), // Use last 4 digits as surname to avoid profile setup
        onboardingStep: "welcome_sent" // Set initial onboarding step
      });
      isNewUser = true;
      log(`🆕 NEW USER CREATED: Account created for phone ${senderId} - User ID: ${user.id}`);
      
      // Track User Created event in Pendo
      pendoServerService.trackUserCreated(senderId).catch(error => {
        log('Pendo tracking failed for user creation:', error instanceof Error ? error.message : String(error));
      });
      
      // IMMEDIATELY send welcome message to new users for fast response
      const digitsOnly = senderId.replace(/\D/g, '');
      const usNumber = digitsOnly.startsWith('1') && digitsOnly.length === 11 ? digitsOnly.slice(1) : digitsOnly;
      const isProblematic = usNumber.includes('555') || 
                            /^(800|888|877|866|855|844|833|822|880|881|882|883|884|885|886|887|889)/.test(usNumber) ||
                            /^(900|976|411|511|611|711|811|911)/.test(usNumber);
      
      if (!isProblematic) {
        log(`🚀 SENDING IMMEDIATE WELCOME MESSAGE to new user ${senderId}`);
        // Send welcome message immediately using async fire-and-forget
        twilioService.sendWelcomeMessage(senderId, onboardingService).then(async () => {
          // Mark onboarding as completed after successful welcome message
          try {
            await storage.markOnboardingCompleted(user!.id);
            log(`✅ Onboarding marked as completed for new user ${user!.id}`);
          } catch (error) {
            log(`❌ Failed to mark onboarding complete for user ${user!.id}:`, error instanceof Error ? error.message : String(error));
          }
        }).catch(error => {
          log(`Welcome message delivery failed for ${senderId}:`, error instanceof Error ? error.message : String(error));
        });
        
        // For new users, extract hashtags but save message quickly
        // Still minimize processing time while preserving hashtag data
        let newUserTags = extractHashtags(content);
        if (newUserTags.length === 0) {
          newUserTags = ["untagged"]; // Default for new users with no hashtags
        }
        
        const basicMessage = {
          content,
          senderId,
          userId: user.id,
          tags: newUserTags, // Extract hashtags for new users too
          mediaUrl: null,
          mediaType: null,
          messageSid: (body as any).MessageSid || null
        };
        
        // Save message asynchronously 
        setImmediate(async () => {
          try {
            const message = insertMessageSchema.parse(basicMessage);
            const savedMessage = await storage.createMessage(message);
            log(`Saved first message for new user ${user?.id}`);
            
          } catch (error) {
            log(`Error saving first message for new user:`, error instanceof Error ? error.message : String(error));
          }
        });
        
        // Return immediately for new users
        return null;
      } else {
        log(`Skipping welcome SMS for potentially unreachable number: ${senderId}`);
        // Still return early for problematic numbers
        return null;
      }
    } else {
      log(`Found existing user account for phone ${senderId}: User ${user.id}`);
    }

    // ========== HEY ASIDE AI TRIGGER ==========
    // Check for "Hey Aside" trigger FIRST - this takes precedence over everything
    const heyAsidePattern = /^hey\s+aside\s*/i;
    if (heyAsidePattern.test(content)) {
      const query = content.replace(heyAsidePattern, '').trim();
      log(`🤖 HEY ASIDE detected! Query: "${query}"`);
      
      if (!query) {
        // User just said "Hey Aside" with no query
        await twilioService.sendSMS(senderId, "Hi! I'm Aside, your AI assistant. Ask me anything about your saved content!\n\nTry:\n• Hey Aside, find my recipes\n• Hey Aside, show me gift ideas\n• Hey Aside, what have I saved about tech?");
        return null;
      }
      
      try {
        // Track Hey Aside query
        await pendoServerService.trackEvent('Hey_Aside_Query_Submitted', senderId, 'aside', {
          query: query,
          queryLength: query.length,
        });
        
        // Process with AsideAI service
        const aiResponse = await asideAIService.processQuery(query, user.id, storage);
        
        // Track response
        await pendoServerService.trackEvent('Hey_Aside_Response_Sent', senderId, 'aside', {
          query: query,
          intent: aiResponse.intent,
          searchPerformed: aiResponse.searchPerformed || false,
        });
        
        // Send AI response
        await twilioService.sendSMS(senderId, aiResponse.response);
        log(`Sent Hey Aside response to ${senderId}`);
        
        // Don't save the "Hey Aside" query as a message
        return null;
      } catch (error) {
        log(`Error processing Hey Aside query: ${error instanceof Error ? error.message : String(error)}`);
        await twilioService.sendSMS(senderId, "Sorry, I had trouble with that. Please try again or text with #tags to save content.");
        return null;
      }
    }
    // ========== END HEY ASIDE AI TRIGGER ==========

    // Check for hashtags FIRST - if present, skip conversational AI and proceed to message processing
    const hasHashtags = extractHashtags(content).length > 0;
    log(`🔍 Hashtag pre-screening: message contains hashtags: ${hasHashtags}`);
    
    if (!hasHashtags) {
      // Only check conversational AI if no hashtags are present
      log("No hashtags detected, checking conversational AI...");
      
      // ========== OLD SEARCH SESSION LOGIC - REMOVED ==========
      // Search now handled by "Hey Aside [query]" pattern
      // This old detection logic has been removed to prevent false positives
      // const normalizedPhone = normalizePhoneNumber(senderId);
      // const activeSession = searchSessions.get(normalizedPhone);
      // if (activeSession && isNegativeResponse(content)) { ... }
      // if (!hasHashtags && isSearchQuery(content)) { ... }
      // ========== END OLD SEARCH SESSION LOGIC ==========
      
      // Check if this is an invite command
      const normalizedContent = content.toLowerCase().trim();
      if (normalizedContent === 'invite') {
        log(`🎁 Detected invite command from user ${user.id}`);
        try {
          // Import invite service
          const { inviteService } = await import("./invite-service");
          
          // Track invite command sent
          await pendoServerService.trackInviteCommandSent(senderId);
          
          // Create a new invite code
          const invite = await inviteService.createInvite(user.id, 'sms_link');
          const inviteMessage = inviteService.getInviteMessage(invite.code);
          
          log(`Generated invite ${invite.code} for user ${user.id}`);
          
          // Send the invite message to the user
          await twilioService.sendSMS(senderId, `I'll send you the invite message in a separate text. You can copy and paste it to share with your friend!`);
          
          // Send the shareable message in a second text
          setTimeout(async () => {
            twilioService.sendSMS(senderId, inviteMessage)
              .then(() => {
                log(`Sent invite message to ${senderId}`);
                // Track invite link sent
                pendoServerService.trackInviteLinkSent(senderId, invite.code);
              })
              .catch((error) => {
                log(`Error sending invite link SMS: ${error instanceof Error ? error.message : String(error)}`);
              });
          }, 500);
          
        } catch (error) {
          log(`Error generating invite: ${error instanceof Error ? error.message : String(error)}`);
          await twilioService.sendSMS(senderId, "Sorry, there was an error creating your invite link. Please try again.");
        }
        
        // Skip storing this message since it was a command
        return null;
      }
      
      // Check if this is a conversational help request first
      const helpRequest = await aiService.handleHelpRequest(content);
      
      if (helpRequest.isRequest && helpRequest.response) {
        log(`Detected help request, responding conversationally`);
        // Send the AI-generated help response back to the user
        try {
          await twilioService.sendSMS(senderId, helpRequest.response);
          log(`Sent help response to ${senderId}`);
        } catch (error) {
          log(`Error sending help response: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Skip storing this message since it was a conversational request
        return null;
      }

      // Check if this is a conversational board list request
      const userBoards = await getUserBoards(user.id);
      const boardListRequest = await aiService.handleBoardListRequest(
        content,
        userBoards.privateBoards,
        userBoards.sharedBoards
      );

      if (boardListRequest.isRequest && boardListRequest.response) {
        log(`Detected board list request, responding conversationally`);
        // Send the AI-generated response back to the user
        try {
          await twilioService.sendSMS(senderId, boardListRequest.response);
          log(`Sent board list response to ${senderId}`);
        } catch (error) {
          log(`Error sending board list response: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Skip storing this message since it was a conversational request
        return null;
      }

      // Check if this is a general conversational query about Context
      // BUT skip conversational AI if user is still in onboarding flow
      const isOnboardingComplete = user.onboardingStep === 'completed' || !user.onboardingStep;
      
      if (isOnboardingComplete) {
        const userStats = await getUserStats(user.id, user);
        const conversationalRequest = await aiService.handleGeneralConversation(content, userStats, storage);

        if (conversationalRequest.isConversational && conversationalRequest.response) {
          log(`🚨 CONVERSATIONAL AI INTERCEPTED MESSAGE: "${content}"`);
          // Send the AI-generated personalized response back to the user
          try {
            await twilioService.sendSMS(senderId, conversationalRequest.response);
            log(`Sent conversational response to ${senderId}`);
          } catch (error) {
            log(`Error sending conversational response: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          // Skip storing this message since it was a conversational request
          return null;
        }
      } else {
        log(`Skipping conversational AI for user ${user.id} - onboarding step: ${user.onboardingStep}`);
      }
    } else {
      log(`✅ Message contains hashtags, skipping conversational AI and proceeding to message processing`);
    }

    // Get user boards for later hashtag processing
    const userBoards = await getUserBoards(user.id);

    // Extract hashtags from the message content
    let tags = extractHashtags(content);
    log(`Extracted hashtags: [${tags.join(', ')}] from content: "${content.substring(0, 100)}..."`);

    // If no tags were found, try to inherit from recent message from same sender
    if (tags.length === 0) {
      const recentTags = await getRecentTagsFromSender(user.id, senderId);
      if (recentTags.length > 0) {
        tags = recentTags;
        log(`Inherited tags [${tags.join(', ')}] from recent message by ${senderId}`);
      } else {
        // Try AI categorization if no hashtags and no recent tags
        log("No hashtags or recent tags found, attempting AI categorization");
        try {
          const aiSuggestion = await aiService.categorizeMessage(
            content,
            userBoards.privateBoards,
            userBoards.sharedBoards
          );
          
          if (aiSuggestion && aiSuggestion.confidence > 0.6) {
            tags.push(aiSuggestion.category);
            log(`AI categorized message as: ${aiSuggestion.category} (confidence: ${aiSuggestion.confidence})`);
          } else {
            tags.push("untagged");
            log("AI categorization failed or low confidence, using untagged");
          }
        } catch (error) {
          log("Error during AI categorization:", error instanceof Error ? error.message : String(error));
          tags.push("untagged");
        }
      }
    }

    // Remove any duplicate tags
    const uniqueTags = Array.from(new Set(tags));

    // Handle media if present
    const numMedia = parseInt(validatedData.NumMedia || "0");
    const mediaUrl = numMedia > 0 ? validatedData.MediaUrl0 : null;
    const mediaType = numMedia > 0 ? validatedData.MediaContentType0 : null;

    const processedData = {
      content,
      senderId,
      userId: user.id,
      tags: uniqueTags,
      mediaUrl,
      mediaType,
      messageSid: (body as any).MessageSid || null, // Store MessageSid for deduplication
      isNewUser
    };

    log("Processed Twilio webhook data:", JSON.stringify(processedData, null, 2));
    return processedData;
  }

  // If Twilio parsing fails, throw error since we only support Twilio format
  log("Twilio format validation failed - no other formats supported");
  throw new Error("Invalid Twilio webhook format: " + JSON.stringify(twilioResult.error.issues));
};

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  const wsManager = new WebSocketManager(httpServer);
  
  // Initialize onboarding service
  const onboardingService = new OnboardingService(twilioService, storage);

  // Add request logging middleware
  app.use(logRequest);

  // Add database connection check middleware to all API routes
  app.use("/api", checkDatabaseConnection);

  // Health check endpoint for deployment verification
  app.get("/api/health", async (_req, res) => {
    try {
      // Check database connection
      const client = await pool.connect();
      client.release();
      
      res.status(200).json({ 
        status: "OK",
        timestamp: new Date().toISOString(),
        database: "connected",
        uptime: process.uptime()
      });
    } catch (error) {
      log("Health check failed:", error instanceof Error ? error.message : String(error));
      res.status(503).json({ 
        status: "ERROR",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Secure magic link authentication endpoint (replaces insecure auto-login)
  app.get("/auth/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        log("Magic link authentication failed: No token provided");
        return res.redirect("/?error=invalid_link");
      }
      
      // Validate and consume the token (one-time use, expiry-checked)
      const userId = await MagicLinkService.validateAndConsumeToken(token);
      
      if (!userId) {
        log(`Magic link authentication failed: Invalid/expired/used token ${token.substring(0, 10)}...`);
        return res.redirect("/?error=link_expired");
      }
      
      // Get user to update last login
      const user = await storage.getUserById(userId);
      if (!user) {
        log(`Magic link authentication failed: User ${userId} not found`);
        return res.redirect("/?error=user_not_found");
      }
      
      log(`✅ Secure magic link authentication successful for user ${userId}`);
      
      // Update last login time
      await storage.updateUserLastLogin(userId);
      
      // Store user in session
      req.session.userId = userId;
      await new Promise<void>((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Redirect to main dashboard
      res.redirect("/");
    } catch (error) {
      log("Error in magic link authentication:", error instanceof Error ? error.message : String(error));
      res.redirect("/?error=login_failed");
    }
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      // Clean phone number (remove any formatting)
      const cleanPhoneNumber = phoneNumber.replace(/\D/g, '');
      
      log(`Login request for phone ${cleanPhoneNumber}`);
      
      // Initialize SMS verification
      const result = await AuthService.initializeVerification(cleanPhoneNumber);
      
      if (result.success) {
        res.json({ 
          success: true,
          message: result.message,
          requiresVerification: true,
          phoneNumber: cleanPhoneNumber
        });
      } else {
        res.status(400).json({ 
          success: false,
          error: result.message 
        });
      }
    } catch (error) {
      log("Error requesting verification code:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { phoneNumber, code } = req.body;
      
      if (!phoneNumber || !code) {
        return res.status(400).json({ error: "Phone number and code are required" });
      }
      
      const result = await AuthService.verifyAndAuthenticate(phoneNumber, code);
      
      if (result.success && result.user) {
        // Set session
        req.session.userId = result.user.id;
        
        
        // Preload affirmation for the user (fire and forget - don't wait)
        aiService.generateAffirmation(result.user.id).catch((error) => {
          log(`Background affirmation generation failed for user ${result.user.id}: ${error instanceof Error ? error.message : String(error)}`);
        });
        
        res.json({ 
          success: true, 
          user: result.user,
          message: result.message 
        });
      } else {
        res.status(401).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error) {
      log("Error verifying code:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (req.session.userId) {
      res.json({ authenticated: true, userId: req.session.userId });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Shared secret validation middleware for Squarespace integration
  const validateSquarespaceSecret = (req: any, res: any, next: any) => {
    const expectedSecret = process.env.SQUARESPACE_WEBHOOK_SECRET;
    
    // FAIL-CLOSED: Reject if secret not configured in production
    if (!expectedSecret) {
      log("CRITICAL: SQUARESPACE_WEBHOOK_SECRET not configured - rejecting request");
      return res.status(503).json({ 
        error: "Service unavailable",
        message: "Integration not properly configured"
      });
    }
    
    // Extract secret header (case-insensitive)
    const providedSecret = req.headers['x-ss-secret'] || req.headers['X-SS-Secret'];
    
    if (!providedSecret) {
      log("Squarespace signup blocked: Missing secret header");
      return res.status(401).json({ 
        error: "Authorization required",
        message: "Missing authentication header"
      });
    }
    
    // Handle array values from headers and ensure string comparison
    const secretToCheck = Array.isArray(providedSecret) ? providedSecret[0] : providedSecret;
    
    if (typeof secretToCheck !== 'string' || secretToCheck !== expectedSecret) {
      log("Squarespace signup blocked: Invalid secret");
      return res.status(401).json({ 
        error: "Authorization failed",
        message: "Invalid authentication"
      });
    }
    
    log("Squarespace secret validation passed");
    next();
  };

  // Public signup endpoint for Squarespace form integration
  app.post("/api/signup", validateSquarespaceSecret, async (req, res) => {
    try {
      // Extract phone number from both JSON and form-encoded data (handle multiple possible field names)
      const { phoneNumber, phone, firstName, lastName, name, source = 'squarespace' } = req.body;
      const extractedPhone = phoneNumber || phone;
      
      if (!extractedPhone) {
        log("Signup failed: Missing phone number in request body:", req.body);
        return res.status(400).json({ 
          error: "Phone number is required",
          message: "Please provide a phone number to continue"
        });
      }
      
      // Extract name fields
      const extractedFirstName = firstName || (name ? name.split(' ')[0] : 'User');
      const extractedLastName = lastName || (name ? name.split(' ').slice(1).join(' ') : '');
      
      // Clean phone number (remove any formatting)
      const cleanPhoneNumber = extractedPhone.replace(/\D/g, '');
      
      // Validate phone number format
      if (cleanPhoneNumber.length < 10 || cleanPhoneNumber.length > 11) {
        return res.status(400).json({ error: "Invalid phone number format" });
      }
      
      // Add country code if missing
      const formattedNumber = cleanPhoneNumber.startsWith('1') ? 
        `+${cleanPhoneNumber}` : `+1${cleanPhoneNumber}`;
      
      log(`Signup request for phone ${formattedNumber}`);
      
      // Check if user already exists
      const existingUser = await storage.getUserByPhoneNumber(formattedNumber);
      if (existingUser) {
        return res.status(409).json({ 
          error: "Account already exists", 
          message: "This phone number is already registered with Context" 
        });
      }
      
      // Check for problematic phone numbers
      const digitsOnly = formattedNumber.replace(/\D/g, '');
      const usNumber = digitsOnly.startsWith('1') && digitsOnly.length === 11 ? digitsOnly.slice(1) : digitsOnly;
      const isProblematic = usNumber.includes('555') || 
                            /^(800|888|877|866|855|844|833|822|880|881|882|883|884|885|886|887|889)/.test(usNumber) ||
                            /^(900|976|411|511|611|711|811|911)/.test(usNumber);
      
      if (isProblematic) {
        return res.status(400).json({ 
          error: "Invalid phone number", 
          message: "Please provide a valid mobile phone number" 
        });
      }
      
      // Send welcome SMS IMMEDIATELY
      log(`🚀 SENDING IMMEDIATE WELCOME SMS for signup: ${formattedNumber}`);
      try {
        await twilioService.sendWelcomeMessage(formattedNumber, onboardingService);
        log(`✅ Welcome SMS sent successfully to ${formattedNumber}`);
      } catch (smsError) {
        log(`❌ Welcome SMS failed for ${formattedNumber}:`, smsError instanceof Error ? smsError.message : String(smsError));
        return res.status(500).json({ 
          error: "SMS delivery failed", 
          message: "Unable to send welcome message. Please try again." 
        });
      }
      
      // Create user account in background (async)
      setImmediate(async () => {
        try {
          const user = await storage.createUser({
            phoneNumber: formattedNumber,
            displayName: extractedLastName ? `${extractedFirstName} ${extractedLastName}` : `${extractedFirstName} ${usNumber.slice(-4)}`,
            firstName: extractedFirstName,
            lastName: extractedLastName || usNumber.slice(-4),
            onboardingStep: "welcome_sent"
          });
          
          log(`✅ User account created successfully for ${formattedNumber} - ID: ${user.id}`);
          
          // Mark onboarding as completed since welcome message was already sent
          try {
            await storage.markOnboardingCompleted(user.id);
            log(`✅ Onboarding marked as completed for Squarespace signup user ${user.id}`);
          } catch (error) {
            log(`❌ Failed to mark onboarding complete for user ${user.id}:`, error instanceof Error ? error.message : String(error));
          }
        
        } catch (createError) {
          log(`❌ User account creation failed for ${formattedNumber}:`, createError instanceof Error ? createError.message : String(createError));
          // Note: SMS was already sent successfully, so this is logged but not returned to user
        }
      });
      
      // Return success response immediately
      res.json({
        success: true,
        message: "Welcome to Context! Check your phone for a welcome message.",
        phoneNumber: formattedNumber
      });
      
    } catch (error) {
      log("Error in signup endpoint:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ 
        error: "Signup failed", 
        message: "An unexpected error occurred. Please try again." 
      });
    }
  });

  // Invite landing page phone submission endpoint
  app.post("/api/invite/submit", async (req, res) => {
    try {
      const { phoneNumber, inviteCode } = req.body;
      
      if (!phoneNumber || !inviteCode) {
        return res.status(400).json({ 
          error: "Phone number and invite code are required" 
        });
      }

      // Validate phone number format (basic check for digits)
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 11) {
        return res.status(400).json({ 
          error: "Please enter a valid 10-digit phone number" 
        });
      }

      // Import invite service
      const { inviteService } = await import("./invite-service");
      
      // Validate invite code exists
      const invite = await inviteService.getInviteByCode(inviteCode);
      if (!invite) {
        return res.status(404).json({ 
          error: "Invalid invite code" 
        });
      }

      // Format phone number
      const formattedNumber = twilioService.formatPhoneNumber(phoneNumber);
      log(`📱 Invite signup request for ${formattedNumber} using code ${inviteCode}`);

      // Check if user already exists
      const existingUser = await storage.getUserByPhoneNumber(formattedNumber);
      if (existingUser) {
        return res.status(400).json({ 
          error: "This phone number is already registered" 
        });
      }

      // Send opt-in SMS
      const optInMessage = `Welcome to Aside! Reply YES to confirm and start saving links and ideas by text.

Reply STOP to opt out`;

      const smsSent = await twilioService.sendSMS(formattedNumber, optInMessage);
      
      if (!smsSent) {
        return res.status(500).json({ 
          error: "Failed to send SMS" 
        });
      }

      // Store pending signup for YES confirmation
      const normalizedPhone = normalizePhoneNumber(formattedNumber);
      pendingInviteSignups.set(normalizedPhone, {
        phoneNumber: formattedNumber,
        inviteCode: inviteCode,
        timestamp: Date.now()
      });
      
      log(`✅ Sent opt-in SMS to ${formattedNumber} for invite ${inviteCode}`);
      
      // Track opt-in SMS sent
      await pendoServerService.trackInviteOptInSent(formattedNumber, inviteCode);

      res.json({
        success: true,
        message: `Check your phone! We sent a text to ${phoneNumber}. Reply YES to confirm and start using Aside.`
      });

    } catch (error) {
      log("Error in invite submission:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ 
        error: "Signup failed" 
      });
    }
  });

  app.delete("/api/auth/delete-account", async (req, res) => {
    try {
      log("=== ACCOUNT DELETION REQUEST RECEIVED ===");
      
      if (!req.session.userId) {
        log("Account deletion failed: Not authenticated");
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.session.userId;
      log(`Starting account deletion for user ID: ${userId}`);
      
      // Delete the user and all associated data
      log("Calling storage.deleteUser...");
      await storage.deleteUser(userId);
      log("storage.deleteUser completed successfully");
      
      // Destroy the session
      log("Destroying session...");
      req.session.destroy((err) => {
        if (err) {
          log("Error destroying session after account deletion:", err instanceof Error ? err.message : String(err));
        } else {
          log("Session destroyed successfully");
        }
      });
      
      log("Account deletion completed successfully");
      res.json({ 
        message: "Account deleted successfully",
        success: true 
      });
    } catch (error) {
      log("=== ACCOUNT DELETION ERROR ===");
      log("Error type:", typeof error);
      log("Error message:", error instanceof Error ? error.message : String(error));
      log("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      log("Raw error object:", JSON.stringify(error, null, 2));
      res.status(500).json({ error: `Failed to delete account: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // Profile management endpoints
  app.get("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: user.id,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        displayName: user.displayName
      });
    } catch (error) {
      log(`Error retrieving profile: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve profile" });
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { updateProfileSchema } = await import("@shared/schema");
      
      // Validate request body
      const profileData = updateProfileSchema.parse(req.body);
      
      // Update user profile
      const updatedUser = await storage.updateUserProfile(userId, profileData);
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({
        id: updatedUser.id,
        phoneNumber: updatedUser.phoneNumber,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        avatarUrl: updatedUser.avatarUrl,
        displayName: updatedUser.displayName
      });
    } catch (error) {
      log(`Error updating profile: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Protected message routes (require authentication)
  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const messages = await storage.getMessages(userId);
      log(`Retrieved ${messages.length} messages for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error retrieving messages: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });

  app.get("/api/messages/tag/:tag", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const tag = req.params.tag;
      
      // Check if this is an admin-only tag and if user has access
      if (isAdminOnlyHashtag(tag)) {
        const userIsAdmin = await isUserAdmin(userId);
        if (!userIsAdmin) {
          log(`Non-admin user ${userId} attempted to access admin-only tag: ${tag}`);
          return res.status(403).json({ error: "Access denied to admin-only content" });
        }
      }
      
      const messages = await storage.getMessagesByTag(userId, tag);
      log(`Retrieved ${messages.length} messages for tag ${tag} for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error retrieving messages for tag ${req.params.tag}: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve messages by tag" });
    }
  });

  // Hybrid search endpoint - combines keyword (BM25) + semantic (vector) search
  app.get("/api/messages/hybrid-search", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const query = req.query.q as string;
      const alpha = parseFloat(req.query.alpha as string) || 0.7; // Default to 0.7 (lean toward semantic)
      const limit = parseInt(req.query.limit as string) || 20;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      // Generate embedding for the search query
      const queryEmbedding = await embeddingService.generateEmbedding(query.trim());
      
      if (!queryEmbedding || queryEmbedding.length === 0) {
        log(`Failed to generate embedding for query: "${query}"`);
        throw new Error('Failed to generate query embedding');
      }
      
      // Perform hybrid search
      const messages = await storage.hybridSearch(userId, query.trim(), queryEmbedding, alpha, limit);
      
      log(`Hybrid search for "${query}" (alpha=${alpha}) returned ${messages.length} messages for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error in hybrid search: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to perform hybrid search" });
    }
  });

  // Legacy keyword-only search endpoint (kept for backward compatibility)
  app.get("/api/messages/search", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const query = req.query.q as string;
      
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required" });
      }
      
      const messages = await storage.searchMessages(userId, query.trim());
      log(`Search for "${query}" returned ${messages.length} messages for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error searching messages: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to search messages" });
    }
  });

  app.get("/api/tags", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      let tags = await storage.getTags(userId);
      
      // Filter out admin-only tags if user is not an admin
      const userIsAdmin = await isUserAdmin(userId);
      if (!userIsAdmin) {
        tags = tags.filter(tag => !isAdminOnlyHashtag(tag));
      }
      
      log(`Retrieved ${tags.length} tags for user ${userId} (admin: ${userIsAdmin})`);
      res.json(tags);
    } catch (error) {
      log(`Error retrieving tags: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve tags" });
    }
  });

  // Get tags with message counts for dashboard
  app.get("/api/tags-with-counts", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      let tags = await storage.getTags(userId);
      
      // Filter out admin-only tags if user is not an admin
      const userIsAdmin = await isUserAdmin(userId);
      if (!userIsAdmin) {
        tags = tags.filter(tag => !isAdminOnlyHashtag(tag));
      }
      
      // Get message counts and recent messages for each tag
      const tagsWithCounts = await Promise.all(
        tags.map(async (tag) => {
          const messages = await storage.getMessagesByTag(userId, tag);
          // Sort by timestamp descending to get most recent messages first
          const sortedMessages = messages.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          // Get last 3 messages for preview
          const recentMessages = sortedMessages.slice(0, 3).map(msg => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.timestamp,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType
          }));
          return { tag, count: messages.length, recentMessages };
        })
      );
      
      log(`Retrieved ${tagsWithCounts.length} tags with counts for user ${userId} (admin: ${userIsAdmin})`);
      res.json(tagsWithCounts);
    } catch (error) {
      log(`Error retrieving tags with counts: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve tags with counts" });
    }
  });

  // Check if current user is admin
  app.get("/api/auth/admin-status", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const isAdmin = await isUserAdmin(userId);
      res.json({ isAdmin });
    } catch (error) {
      log(`Error checking admin status: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to check admin status" });
    }
  });

  // Generate daily affirmation
  app.get("/api/affirmation", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const affirmation = await aiService.generateAffirmation(userId);
      res.json({ text: affirmation });
    } catch (error) {
      log(`Error generating affirmation: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to generate affirmation" });
    }
  });

  // Convert private board to shared board and invite user
  app.post("/api/private-boards/:boardName/convert-and-invite", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      const { phoneNumber } = req.body;

      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Check if board name is admin-only
      if (isAdminOnlyHashtag(boardName)) {
        const userIsAdmin = await isUserAdmin(userId);
        if (!userIsAdmin) {
          return res.status(403).json({ error: "Cannot convert admin-only boards" });
        }
      }

      // Verify the user has messages with this tag (i.e., owns this private board)
      const userMessages = await storage.getMessagesByTag(userId, boardName);
      if (userMessages.length === 0) {
        return res.status(404).json({ error: "Private board not found or empty" });
      }

      // Check if shared board with this name already exists
      const existingSharedBoard = await storage.getSharedBoardByName(boardName);
      if (existingSharedBoard) {
        return res.status(400).json({ error: "A shared board with this name already exists" });
      }

      // Find the user to invite
      const normalizedPhoneNumber = phoneNumber.replace(/^\+?1?/, '');
      const inviteeUser = await storage.getUserByPhoneNumber(phoneNumber) || 
                         await storage.getUserByPhoneNumber(normalizedPhoneNumber) ||
                         await storage.getUserByPhoneNumber(`+1${normalizedPhoneNumber}`);
      
      if (!inviteeUser) {
        return res.status(404).json({ error: "User with this phone number not found" });
      }

      if (inviteeUser.id === userId) {
        return res.status(400).json({ error: "Cannot invite yourself" });
      }

      // Create the shared board
      const sharedBoard = await storage.createSharedBoard({
        name: boardName,
        createdBy: userId
      });

      // Track Shared Board Created event in Pendo (via web UI conversion)
      const creatorUser = await storage.getUserById(userId);
      if (creatorUser?.phoneNumber) {
        pendoServerService.trackSharedBoardCreated(
          creatorUser.phoneNumber,
          boardName
        ).catch(error => {
          log('Pendo tracking failed for shared board creation:', error instanceof Error ? error.message : String(error));
        });
      }

      // Invite the user to the shared board
      await storage.addBoardMember({
        boardId: sharedBoard.id,
        userId: inviteeUser.id,
        role: "member",
        invitedBy: userId
      });

      // Send SMS notification to the invited user
      await twilioService.sendSMS(
        inviteeUser.phoneNumber,
        `You've been invited to the shared board #${boardName} on Aside! Check your dashboard: https://textaside.app`
      );

      log(`Successfully converted private board ${boardName} to shared board and invited user ${inviteeUser.phoneNumber}`);
      res.json({
        message: `Successfully converted #${boardName} to a shared board and invited ${phoneNumber}`,
        sharedBoard,
        invitedUser: {
          phoneNumber: inviteeUser.phoneNumber,
          displayName: inviteeUser.displayName
        }
      });

    } catch (error) {
      log(`Error converting private board to shared: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to convert private board to shared board" });
    }
  });

  // POST endpoint for creating messages via UI
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Validate request body
      const { content, source = 'ui' } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      // Use provided tags from request body (e.g., from Add Card modal) or extract from content
      const providedTags = req.body.tags && Array.isArray(req.body.tags) ? req.body.tags : [];
      const extractedTags = extractHashtags(content);
      const tags = providedTags.length > 0 ? providedTags : (extractedTags.length > 0 ? extractedTags : ["untagged"]);
      
      // Create message data
      const messageData = {
        content: content.trim(),
        senderId: `user-${userId}`, // Use a special sender ID for UI messages
        userId,
        tags,
        source
      };

      // Validate with schema
      const message = insertMessageSchema.parse(messageData);
      
      // Check if this is a new tag (private board creation)
      const existingTags = await storage.getTags(userId);
      const isNewPrivateBoard = tags.some(tag => tag !== 'untagged' && !existingTags.includes(tag));
      
      // Create message in storage
      const created = await storage.createMessage(message);
      log(`Created UI message for user ${userId}:`, JSON.stringify(created, null, 2));
      
      // Track new private board creation in Pendo
      if (isNewPrivateBoard && source === 'ui') {
        const user = await storage.getUserById(userId);
        if (user?.phoneNumber) {
          const newTags = tags.filter(tag => tag !== 'untagged' && !existingTags.includes(tag));
          for (const newTag of newTags) {
            pendoServerService.trackNewBoardCreatedViaSMS(
              user.phoneNumber,
              newTag,
              'private'
            ).catch(error => {
              log('Pendo tracking failed for private board creation:', error instanceof Error ? error.message : String(error));
            });
          }
        }
      }

      // Immediately respond to user while background tasks run
      res.status(201).json(created);

      // Run WebSocket broadcasts and SMS notifications asynchronously for faster response
      setImmediate(async () => {
        try {
          // Broadcast to WebSocket clients for this user
          wsManager.broadcastNewMessageToUser(userId);
          
          // Also notify shared board members if message has relevant tags
          if (created.tags && created.tags.length > 0) {
            const sharedBoardUsers = await storage.getUsersForSharedBoardNotification(created.tags);
            if (sharedBoardUsers.length > 0) {
              log(`Notifying shared board users of UI message: [${sharedBoardUsers.join(', ')}]`);
              wsManager.broadcastNewMessageToUsers(sharedBoardUsers);
            }

            // NOTE: SMS notifications are DISABLED for UI-created messages to prevent duplicates
            // SMS notifications should only happen when messages come from actual SMS (via webhook)
            // This prevents duplicate notifications when users create messages via the web dashboard
            log(`UI message created - SMS notifications disabled to prevent duplicates from webhook handler`);
          }
        } catch (error) {
          log(`Error in background WebSocket/SMS processing: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } catch (error) {
      log(`Error creating UI message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // DELETE endpoint for removing messages
  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      // Check if message exists and belongs to the user
      const existingMessage = await storage.getMessageById(messageId);
      if (!existingMessage) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (existingMessage.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized to delete this message" });
      }

      // Delete the message
      await storage.deleteMessage(messageId);
      log(`Deleted message ${messageId} for user ${userId}`);

      // Broadcast to WebSocket clients for this user
      wsManager.broadcastNewMessageToUser(userId);

      res.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
      log(`Error deleting message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // PATCH endpoint for updating messages
  app.patch("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      const { content, tags } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required and must be a string" });
      }

      if (!Array.isArray(tags)) {
        return res.status(400).json({ error: "Tags must be an array" });
      }

      // Check if message exists and belongs to the user
      const existingMessage = await storage.getMessageById(messageId);
      if (!existingMessage) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (existingMessage.userId !== userId) {
        return res.status(403).json({ error: "You don't have permission to edit this message" });
      }

      // Update the message
      const updatedMessage = await storage.updateMessage(messageId, content, tags);
      
      log(`Updated message ${messageId} with new content and tags: [${tags.join(', ')}]`);
      
      // Broadcast WebSocket update for the updated message
      wsManager.broadcastNewMessageToUser(userId);
      
      // Also notify shared board members if message has relevant tags
      if (updatedMessage.tags && updatedMessage.tags.length > 0) {
        const sharedBoardUsers = await storage.getUsersForSharedBoardNotification(updatedMessage.tags);
        if (sharedBoardUsers.length > 0) {
          log(`Notifying shared board users of updated message: [${sharedBoardUsers.join(', ')}]`);
          wsManager.broadcastNewMessageToUsers(sharedBoardUsers);
        }
      }
      
      res.json(updatedMessage);
    } catch (error) {
      log(`Error updating message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // DELETE endpoint for removing all messages with a specific tag
  app.delete("/api/tags/:tag", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const tag = decodeURIComponent(req.params.tag);
      
      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ error: "Tag is required" });
      }

      // Get all messages with this tag to count them (including hashtag-only messages)
      const messagesToDelete = await storage.getAllMessagesByTagForDeletion(userId, tag);
      log(`Found ${messagesToDelete.length} messages with tag "${tag}" for user ${userId}`);
      
      // Check if this is a shared board to provide appropriate messaging
      const sharedBoard = await storage.getSharedBoardByName(tag);
      
      if (messagesToDelete.length === 0) {
        if (sharedBoard) {
          // If it's a shared board with no private messages, this is normal - shared board messages are protected
          return res.json({ 
            success: true, 
            message: `Private board #${tag} removed. Shared board messages are preserved.`,
            deletedCount: 0,
            isSharedBoardProtected: true
          });
        } else {
          // If it's a regular private board with no messages, that's an error
          return res.status(404).json({ error: "No messages found with this tag" });
        }
      }

      // Delete all messages with this tag (including hashtag-only messages)
      await storage.deleteMessagesByTag(userId, tag);
      log(`Deleted ${messagesToDelete.length} messages with tag "${tag}" for user ${userId}`);

      // Broadcast to WebSocket clients for this user
      wsManager.broadcastNewMessageToUser(userId);

      const responseMessage = sharedBoard 
        ? `Removed private board #${tag}. ${messagesToDelete.length} private messages deleted, shared board messages preserved.`
        : `Deleted ${messagesToDelete.length} messages with tag #${tag}`;

      res.json({ 
        success: true, 
        message: responseMessage,
        deletedCount: messagesToDelete.length,
        isSharedBoardProtected: !!sharedBoard
      });
    } catch (error) {
      log(`Error deleting tag "${req.params.tag}": ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Admin endpoints
  // Admin middleware - restricts access to specific phone numbers
  const requireAdmin = async (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      // Get the current user to check their phone number
      const user = await storage.getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      // Define admin phone numbers (add your phone number here)
      const adminPhoneNumbers = [
        "6155848598", // Main admin number
        "3182081034", // Additional admin number
        "4582188508", // Official Context number without +1
        "+14582188508" // Official Context number with +1
      ];
      
      // Check if user's phone number is in admin list
      const isAdmin = adminPhoneNumbers.some((adminPhone: string) => {
        // Normalize both numbers for comparison
        const normalizedUserPhone = user.phoneNumber.replace(/^\+?1?/, '');
        const normalizedAdminPhone = adminPhone.replace(/^\+?1?/, '');
        return normalizedUserPhone === normalizedAdminPhone;
      });
      
      if (!isAdmin) {
        log(`Non-admin user ${user.phoneNumber} attempted to access admin endpoint`);
        return res.status(403).json({ error: "Admin access required" });
      }
      
      log(`Admin user ${user.phoneNumber} accessing admin endpoint`);
      next();
    } catch (error) {
      log(`Error checking admin access: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Admin access check failed" });
    }
  };

  // Admin stats endpoint
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      log(`Error fetching admin stats: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // Admin endpoint to clear Open Graph cache (useful when API key is added/changed)
  app.post("/api/admin/clear-og-cache", requireAdmin, async (req, res) => {
    try {
      openGraphService.clearCache();
      log('Admin cleared Open Graph cache');
      res.json({ success: true, message: "Open Graph cache cleared successfully" });
    } catch (error) {
      log(`Error clearing OG cache: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to clear cache" });
    }
  });

  // Admin users endpoint
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAdminUsers();
      res.json(users);
    } catch (error) {
      log(`Error fetching admin users: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin delete user endpoint
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const result = await storage.deleteUserCompletely(userId);
      
      if (!result.success) {
        return res.status(404).json({ error: result.error || "User not found" });
      }

      log(`Admin deleted user ${userId} with ${result.deletedMessages} messages, ${result.deletedBoardMemberships} memberships, ${result.deletedSharedBoards} boards`);
      
      res.json({
        success: true,
        message: "User deleted successfully",
        deletedMessages: result.deletedMessages,
        deletedBoardMemberships: result.deletedBoardMemberships,
        deletedSharedBoards: result.deletedSharedBoards
      });
    } catch (error) {
      log(`Error deleting user ${req.params.id}: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Admin bulk delete users endpoint
  app.delete("/api/admin/users/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "userIds array is required" });
      }

      // Validate all userIds are numbers (handle both numbers and numeric strings)
      const validUserIds = userIds.map(id => {
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;
        return Number.isInteger(numId) && numId > 0 ? numId : null;
      }).filter(id => id !== null);
      
      if (validUserIds.length !== userIds.length) {
        log(`Bulk delete validation failed. Received: ${JSON.stringify(userIds)}, Valid: ${JSON.stringify(validUserIds)}`);
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const results = await storage.bulkDeleteUsers(validUserIds);
      
      log(`Admin bulk deleted ${results.deletedUsers} users with ${results.totalMessages} messages, ${results.totalBoardMemberships} memberships, ${results.totalSharedBoards} boards`);
      
      res.json({
        success: true,
        deletedCount: results.deletedUsers,
        totalMessages: results.totalMessages,
        totalBoardMemberships: results.totalBoardMemberships,
        totalSharedBoards: results.totalSharedBoards
      });
    } catch (error) {
      log(`Error bulk deleting users: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete users" });
    }
  });

  // Admin bulk SMS broadcast endpoint
  app.post("/api/admin/broadcast-sms", requireAdmin, async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required" });
      }

      if (message.length > 1600) {
        return res.status(400).json({ error: "Message too long. Maximum 1600 characters." });
      }

      // Get all users
      const allUsers = await storage.getAdminUsers();
      const phoneNumbers = allUsers.map(user => user.phoneNumber);
      
      if (phoneNumbers.length === 0) {
        return res.status(400).json({ error: "No users found to send messages to" });
      }

      log(`Admin initiating bulk SMS broadcast to ${phoneNumbers.length} users`);
      
      // Send bulk SMS using Twilio service
      const results = await twilioService.sendBulkAdminMessage(phoneNumbers, message);
      
      log(`Bulk SMS broadcast completed. Successful: ${results.successful}, Failed: ${results.failed}`);
      
      res.json({
        success: true,
        message: "Bulk SMS broadcast completed",
        totalRecipients: phoneNumbers.length,
        successful: results.successful,
        failed: results.failed,
        details: results.details
      });
    } catch (error) {
      log(`Error sending bulk SMS broadcast: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to send bulk SMS broadcast" });
    }
  });

  // Admin feedback messages endpoint
  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      // Get all feedback messages
      const feedbackMessages = await storage.getAllMessagesByTagAdmin('feedback');
      
      res.json(feedbackMessages);
    } catch (error) {
      log("Admin feedback fetch error:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Failed to fetch feedback messages" });
    }
  });


  // Shared boards endpoints
  // Get shared boards for the current user (boards they created + boards they're members of)
  app.get("/api/shared-boards", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      log(`Fetching shared boards for user ${userId}`);
      
      // Get boards created by user and boards user is a member of
      const [createdBoards, membershipBoards] = await Promise.all([
        storage.getSharedBoards(userId),
        storage.getUserBoardMemberships(userId)
      ]);
      
      // Combine and deduplicate
      const allBoardNames = new Set();
      const allBoards = [];
      
      for (const board of createdBoards) {
        if (!allBoardNames.has(board.name)) {
          allBoardNames.add(board.name);
          allBoards.push({ ...board, role: "owner" });
        }
      }
      
      for (const membership of membershipBoards) {
        if (!allBoardNames.has(membership.board.name)) {
          allBoardNames.add(membership.board.name);
          allBoards.push({ ...membership.board, role: membership.role });
        }
      }
      
      log(`Found ${allBoards.length} shared boards for user ${userId}`);
      res.json(allBoards);
    } catch (error) {
      log(`Error fetching shared boards: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch shared boards" });
    }
  });

  // Get shared boards with message counts for dashboard
  app.get("/api/shared-boards-with-counts", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      log(`Fetching shared boards with counts for user ${userId}`);
      
      // Get boards created by user and boards user is a member of
      const [createdBoards, membershipBoards] = await Promise.all([
        storage.getSharedBoards(userId),
        storage.getUserBoardMemberships(userId)
      ]);
      
      // Combine and deduplicate
      const allBoardNames = new Set();
      const allBoards = [];
      
      for (const board of createdBoards) {
        if (!allBoardNames.has(board.name)) {
          allBoardNames.add(board.name);
          allBoards.push({ ...board, role: "owner" });
        }
      }
      
      for (const membership of membershipBoards) {
        if (!allBoardNames.has(membership.board.name)) {
          allBoardNames.add(membership.board.name);
          allBoards.push({ ...membership.board, role: membership.role });
        }
      }
      
      // Get message counts and recent messages for each shared board
      const boardsWithCounts = await Promise.all(
        allBoards.map(async (board) => {
          const messages = await storage.getSharedMessages(userId, board.name);
          // Sort by timestamp descending to get most recent messages first
          const sortedMessages = messages.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          // Get last 3 messages for preview
          const recentMessages = sortedMessages.slice(0, 3).map(msg => ({
            id: msg.id,
            content: msg.content,
            timestamp: msg.timestamp,
            mediaUrl: msg.mediaUrl,
            mediaType: msg.mediaType
          }));
          return { 
            ...board, 
            count: messages.length,
            recentMessages
          };
        })
      );
      
      log(`Retrieved ${boardsWithCounts.length} shared boards with counts for user ${userId}`);
      res.json(boardsWithCounts);
    } catch (error) {
      log(`Error retrieving shared boards with counts: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve shared boards with counts" });
    }
  });

  // Get messages for a shared board
  app.get("/api/shared-boards/:boardName/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      
      log(`Fetching shared messages for board ${boardName}, user ${userId}`);
      const messages = await storage.getSharedMessages(userId, boardName);
      
      log(`Successfully retrieved ${messages.length} messages for shared board ${boardName}`);
      res.json(messages);
    } catch (error) {
      log(`Error fetching shared messages: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch shared messages" });
    }
  });

  // Create a new shared board
  app.post("/api/shared-boards", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Board name is required" });
      }
      
      const boardName = name.trim().toLowerCase();
      
      // Check if board already exists
      const existingBoard = await storage.getSharedBoardByName(boardName);
      if (existingBoard) {
        return res.status(400).json({ error: "A shared board with this name already exists" });
      }
      
      // Create the board
      const board = await storage.createSharedBoard({
        name: boardName,
        createdBy: userId
      });
      
      // Track Shared Board Created event in Pendo
      const user = await storage.getUserById(userId);
      if (user?.phoneNumber) {
        pendoServerService.trackSharedBoardCreated(
          user.phoneNumber,
          boardName
        ).catch(error => {
          log('Pendo tracking failed for shared board creation:', error instanceof Error ? error.message : String(error));
        });
      }
      
      log(`Created shared board ${board.id} (${boardName}) by user ${userId}`);
      res.status(201).json(board);
    } catch (error) {
      log(`Error creating shared board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to create shared board" });
    }
  });

  // Get members of a shared board
  app.get("/api/shared-boards/:boardName/members", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      
      log(`Fetching members for board "${boardName}" requested by user ${userId}`);
      
      // Get the board first
      const board = await storage.getSharedBoardByName(boardName);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }
      
      // Check if user has access to this board (is owner or member)
      const isOwner = board.createdBy === userId;
      const userMemberships = await storage.getUserBoardMemberships(userId);
      const isMember = userMemberships.some(m => m.board.name === boardName);
      
      if (!isOwner && !isMember) {
        return res.status(403).json({ error: "Access denied to this board" });
      }
      
      // Get board members
      const members = await storage.getBoardMembers(board.id);
      log(`Found ${members.length} members for board "${boardName}"`);
      
      res.json(members);
    } catch (error) {
      log(`Error fetching board members: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch board members" });
    }
  });

  // Invite user to shared board (by phone number)
  app.post("/api/shared-boards/:boardName/invite", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      const { phoneNumber } = req.body;
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      // Check if board exists
      const board = await storage.getSharedBoardByName(boardName);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user has permission to invite (must be owner or member)
      const userMemberships = await storage.getUserBoardMemberships(userId);
      const userMembership = userMemberships.find(m => m.board.id === board.id);
      const isCreator = board.createdBy === userId;
      
      if (!isCreator && !userMembership) {
        return res.status(403).json({ error: "You don't have permission to invite users to this board" });
      }
      
      // Find user by phone number
      const invitedUser = await storage.getUserByPhoneNumber(phoneNumber);
      if (!invitedUser) {
        return res.status(404).json({ error: "User with this phone number not found. They need to create an account first." });
      }
      
      // Check if user is already a member
      const existingMemberships = await storage.getUserBoardMemberships(invitedUser.id);
      const alreadyMember = existingMemberships.some(m => m.board.id === board.id);
      
      if (alreadyMember) {
        return res.status(400).json({ error: "User is already a member of this board" });
      }
      
      // Add user to board
      const membership = await storage.addBoardMember({
        boardId: board.id,
        userId: invitedUser.id,
        role: "member",
        invitedBy: userId
      });
      
      log(`Added user ${invitedUser.id} to board ${board.id} (${boardName})`);
      res.status(201).json({
        success: true,
        message: `Successfully invited ${phoneNumber} to board #${boardName}`,
        membership
      });
    } catch (error) {
      log(`Error inviting user to board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to invite user to board" });
    }
  });

  // Remove user from shared board
  app.delete("/api/shared-boards/:boardName/members/:phoneNumber", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      const phoneNumber = decodeURIComponent(req.params.phoneNumber);
      
      // Check if board exists
      const board = await storage.getSharedBoardByName(boardName);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user has permission (must be owner)
      if (board.createdBy !== userId) {
        return res.status(403).json({ error: "Only the board owner can remove members" });
      }
      
      // Find user to remove
      const userToRemove = await storage.getUserByPhoneNumber(phoneNumber);
      if (!userToRemove) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove user from board
      await storage.removeBoardMember(board.id, userToRemove.id);
      
      log(`Removed user ${userToRemove.id} from board ${board.id} (${boardName})`);
      res.json({
        success: true,
        message: `Successfully removed ${phoneNumber} from board #${boardName}`
      });
    } catch (error) {
      log(`Error removing user from board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to remove user from board" });
    }
  });

  // TMDB API endpoint for fetching movie data
  app.get("/api/tmdb/movie/:imdbId", async (req, res) => {
    try {
      const { imdbId } = req.params;
      
      if (!imdbId || !imdbId.startsWith('tt')) {
        return res.status(400).json({ error: "Invalid IMDB ID format" });
      }
      
      log(`Fetching TMDB data for IMDB ID: ${imdbId}`);
      const imdbUrl = `https://www.imdb.com/title/${imdbId}`;
      const movieData = await tmdbService.getMoviePoster(imdbUrl);
      
      if (!movieData.posterUrl && !movieData.title) {
        return res.status(404).json({ error: "Movie not found in TMDB database" });
      }
      
      res.json(movieData);
    } catch (error) {
      log(`Error fetching TMDB data: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch movie data from TMDB" });
    }
  });

  // Open Graph metadata endpoint
  app.get('/api/og-preview', async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL parameter is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // Check if we should fetch Open Graph data for this URL
      if (!openGraphService.shouldFetchOpenGraph(url)) {
        return res.json({ skip: true });
      }

      // Use request queue to limit concurrent Microlink.io API calls (max 3 at a time)
      const ogData = await microlinkQueue.add(() => openGraphService.fetchOpenGraph(url));
      
      if (!ogData) {
        return res.json({ error: 'Failed to fetch Open Graph data' });
      }

      res.json(ogData);
    } catch (error) {
      log('Error fetching Open Graph data:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Failed to fetch Open Graph data' });
    }
  });

  // Delete shared board (only owner can delete)
  app.delete("/api/shared-boards/:boardId", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardId = parseInt(req.params.boardId);
      
      if (isNaN(boardId)) {
        return res.status(400).json({ error: "Invalid board ID" });
      }
      
      // Check if board exists
      const board = await storage.getSharedBoard(boardId);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user is the owner
      if (board.createdBy !== userId) {
        return res.status(403).json({ error: "Only the board owner can delete this board" });
      }
      
      // Delete the board (this will cascade delete memberships)
      await storage.deleteSharedBoard(boardId);
      
      log(`Deleted shared board ${boardId} (${board.name}) by user ${userId}`);
      res.json({
        success: true,
        message: `Successfully deleted shared board #${board.name}`
      });
    } catch (error) {
      log(`Error deleting shared board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete shared board" });
    }
  });

  // Rename shared board endpoint
  app.put("/api/shared-boards/:boardId/rename", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardId = parseInt(req.params.boardId);
      const { newName } = req.body;
      
      if (isNaN(boardId)) {
        return res.status(400).json({ error: "Invalid board ID" });
      }
      
      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: "New board name is required" });
      }
      
      const sanitizedName = newName.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      // Check if board exists
      const board = await storage.getSharedBoard(boardId);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user is the owner
      if (board.createdBy !== userId) {
        return res.status(403).json({ error: "Only the board owner can rename this board" });
      }
      
      // Check if a board with the new name already exists
      const existingBoard = await storage.getSharedBoardByName(sanitizedName);
      if (existingBoard && existingBoard.id !== boardId) {
        return res.status(400).json({ error: "A shared board with this name already exists" });
      }
      
      // Rename the board
      const updatedBoard = await storage.renameSharedBoard(boardId, sanitizedName);
      
      log(`Renamed shared board ${boardId} from ${board.name} to ${sanitizedName} by user ${userId}`);
      res.json({
        success: true,
        message: `Successfully renamed shared board to #${sanitizedName}`,
        board: updatedBoard
      });
    } catch (error) {
      log(`Error renaming shared board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to rename shared board" });
    }
  });

  // Rename private board (hashtag) endpoint
  app.put("/api/private-boards/:tagName/rename", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const oldTag = decodeURIComponent(req.params.tagName);
      const { newName } = req.body;
      
      if (!newName || typeof newName !== 'string' || newName.trim().length === 0) {
        return res.status(400).json({ error: "New board name is required" });
      }
      
      const sanitizedNewTag = newName.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      // Check if the old tag exists for this user
      const userTags = await storage.getTags(userId);
      if (!userTags.includes(oldTag)) {
        return res.status(404).json({ error: "Private board not found" });
      }
      
      // Check if new tag name conflicts with existing shared boards
      const existingSharedBoard = await storage.getSharedBoardByName(sanitizedNewTag);
      if (existingSharedBoard) {
        return res.status(400).json({ error: "A shared board with this name already exists" });
      }
      
      // Check if new tag already exists as a private tag
      if (userTags.includes(sanitizedNewTag)) {
        return res.status(400).json({ error: "A private board with this name already exists" });
      }
      
      // Rename the private board by updating all messages with the old tag
      await storage.renamePrivateBoard(userId, oldTag, sanitizedNewTag);
      
      log(`Renamed private board hashtag from ${oldTag} to ${sanitizedNewTag} for user ${userId}`);
      res.json({
        success: true,
        message: `Successfully renamed private board to #${sanitizedNewTag}`
      });
    } catch (error) {
      log(`Error renaming private board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to rename private board" });
    }
  });

  // Notification preferences endpoints
  
  // Get user's notification preferences for all boards
  app.get("/api/notification-preferences", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      log(`Getting notification preferences for user ${userId}`);
      
      const preferences = await storage.getUserNotificationPreferences(userId);
      res.json(preferences);
    } catch (error) {
      log('Error getting notification preferences:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Failed to get notification preferences' });
    }
  });

  // Update notification preference for a specific board
  app.put("/api/notification-preferences/:boardId", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardId = parseInt(req.params.boardId);
      const { smsEnabled } = req.body;
      
      if (isNaN(boardId)) {
        return res.status(400).json({ error: "Invalid board ID" });
      }
      
      if (typeof smsEnabled !== 'boolean') {
        return res.status(400).json({ error: "smsEnabled must be a boolean" });
      }
      
      log(`Updating notification preference for user ${userId}, board ${boardId}, smsEnabled: ${smsEnabled}`);
      
      // Verify user has access to this board
      const board = await storage.getSharedBoard(boardId);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }
      
      // Check if user is member or creator of this board
      const [boardMemberships, userBoards] = await Promise.all([
        storage.getUserBoardMemberships(userId),
        storage.getSharedBoards(userId)
      ]);
      
      const isMember = boardMemberships.some(m => m.board.id === boardId);
      const isCreator = userBoards.some(b => b.id === boardId);
      
      if (!isMember && !isCreator) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const preference = await storage.updateNotificationPreference(userId, boardId, smsEnabled);
      res.json(preference);
    } catch (error) {
      log('Error updating notification preference:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Failed to update notification preference' });
    }
  });

  // Track processed message SIDs to prevent duplicates
  const processedMessageSids = new Set<string>();

  // Twilio webhook endpoint - handle both /api/webhook/sms and /webhook/sms
  const handleWebhook = async (req: any, res: any) => {
    log("Entering handleWebhook function");
    try {
      log("Received webhook request:", JSON.stringify({
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        query: req.query,
      }, null, 2));

      // Check for duplicate message processing using Twilio MessageSid
      const messageSid = req.body.MessageSid || req.body.MessageSID;
      if (messageSid) {
        if (processedMessageSids.has(messageSid)) {
          log(`Duplicate message detected - MessageSid ${messageSid} already processed, skipping`);
          return res.json({ status: "duplicate_skipped" });
        }
        processedMessageSids.add(messageSid);
        // Clean up old SIDs to prevent memory bloat (keep last 1000)
        if (processedMessageSids.size > 1000) {
          const oldestSids = Array.from(processedMessageSids).slice(0, 500);
          oldestSids.forEach(sid => processedMessageSids.delete(sid));
        }
        log(`Processing new message - MessageSid: ${messageSid}`);
      }

      const smsData = await processSMSWebhook(req.body, onboardingService);
      log("processSMSWebhook completed");

      // If smsData is null, this was a tag confirmation message we want to skip
      if (!smsData) {
        log("Skipping message due to null smsData");
        return res.json({ status: "skipped" });
      }

      // Check if this is a new user for welcome message
      const isNewUser = (smsData as any).isNewUser;
      log(`📨 ONBOARDING CHECK: isNewUser=${isNewUser}, senderId=${smsData.senderId}`);
      
      log("Parsing smsData with insertMessageSchema");
      const message = insertMessageSchema.parse(smsData);
      log("insertMessageSchema parsing complete");

      // Check if this message contains any new tags (private board creation via SMS)
      const existingTags = await storage.getTags(smsData.userId);
      const newTags = (smsData.tags || []).filter(tag => tag !== 'untagged' && !existingTags.includes(tag));
      
      log("Creating message in storage");
      const created = await storage.createMessage(message);
      log("Message creation complete");
      
      // Generate and save embedding for hybrid search (async, non-blocking)
      (async () => {
        try {
          log(`Generating embedding for message ${created.id}`);
          const embedding = await embeddingService.generateEmbedding(created.content);
          await storage.saveMessageEmbedding(created.id, embedding);
          log(`Embedding saved for message ${created.id}`);
        } catch (error) {
          log(`Error generating/saving embedding for message ${created.id}:`, error instanceof Error ? error.message : String(error));
          // Don't fail the whole request if embedding generation fails
        }
      })();
      
      // Track SMS Message Received event in Pendo
      pendoServerService.trackSMSMessageReceived(
        smsData.senderId,
        smsData.content,
        smsData.tags || [],
        !!(smsData.mediaUrl)
      ).catch(error => {
        log('Pendo tracking failed for SMS message:', error instanceof Error ? error.message : String(error));
      });
      
      // Track new private board creation via SMS in Pendo
      if (newTags.length > 0) {
        for (const newTag of newTags) {
          pendoServerService.trackNewBoardCreatedViaSMS(
            smsData.senderId,
            newTag,
            'private'
          ).catch(error => {
            log('Pendo tracking failed for private board creation via SMS:', error instanceof Error ? error.message : String(error));
          });
        }
      }
      

      // Handle onboarding flow for existing users (new users already got welcome message above)
      if (smsData.userId && !isNewUser) {
        try {
          const wasHandledByOnboarding = await onboardingService.handleOnboardingProgress(
            smsData.userId, 
            smsData.content, 
            smsData.tags
          );
          
          if (wasHandledByOnboarding) {
            log(`Onboarding progress updated for user ${smsData.userId}`);
          } else {
            log(`User ${smsData.userId} not in onboarding flow or already completed`);
          }
        } catch (error) {
          log(`Error processing onboarding: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else if (isNewUser) {
        log(`Skipping onboarding progress for new user - they just got welcome message`);
      }

      log("Successfully created message:", JSON.stringify(created, null, 2));

      // If this message was untagged and contains a URL, schedule post-processing to check for recent hashtags
      const hasUrl = /https?:\/\/[^\s]+/.test(created.content);
      if (created.tags.includes("untagged") && hasUrl) {
        log("Scheduling post-processing for potentially untagged URL message");
        // Don't await this - let it run in the background
        fixUntaggedUrlMessage(created.id, created.userId, created.senderId, wsManager);
      }

      // Add logging for WebSocket broadcast
      log("Broadcasting new message to WebSocket clients:", JSON.stringify(created, null, 2));
      log("Before broadcastNewMessage");
      
      // Notify the original user
      wsManager.broadcastNewMessageToUser(created.userId);
      
      // Check for admin-only hashtags and notify admins via SMS FIRST
      if (created.tags && created.tags.length > 0) {
        const adminOnlyTags = created.tags.filter(tag => isAdminOnlyHashtag(tag));
        if (adminOnlyTags.length > 0) {
          try {
            log(`Admin-only hashtags detected: [${adminOnlyTags.join(', ')}] - notifying admins`);
            
            // Get admin phone numbers
            const adminPhoneNumbers = [
              "+16155848598", // Your current test number with +1
              "+14582188508" // Official Context number with +1
            ];
            
            // Format the admin notification message
            const senderUser = await storage.getUserById(created.userId);
            const senderPhone = senderUser?.phoneNumber || created.senderId;
            const adminMessage = `🔔 New admin message received!\n\nFrom: ${senderPhone}\nTags: ${adminOnlyTags.map(tag => '#' + tag).join(', ')}\n\n"${created.content.slice(0, 200)}${created.content.length > 200 ? '...' : ''}"\n\nView: https://textaside.app/admin`;
            
            // Send SMS to all admin numbers
            for (const adminPhone of adminPhoneNumbers) {
              twilioService.sendSMS(adminPhone, adminMessage).catch(error => {
                log(`Failed to send admin notification to ${adminPhone}:`, error instanceof Error ? error.message : String(error));
              });
            }
            
            log(`Admin notifications sent for tags: [${adminOnlyTags.join(', ')}]`);
          } catch (error) {
            log(`Error sending admin notifications:`, error instanceof Error ? error.message : String(error));
          }
        }
      }

      // Also notify all users who have shared boards matching this message's tags
      if (created.tags && created.tags.length > 0) {
        const sharedBoardUsers = await storage.getUsersForSharedBoardNotification(created.tags);
        if (sharedBoardUsers.length > 0) {
          log(`Notifying shared board users: [${sharedBoardUsers.join(', ')}]`);
          wsManager.broadcastNewMessageToUsers(sharedBoardUsers);
        }

        // SMS notifications for shared boards are currently DISABLED
        /* DISABLED - Send SMS notifications to shared board members (excluding the sender)
        // ENHANCED DEDUPLICATION: Track both boards and individual phone numbers to prevent ALL duplicates
        const nonUntaggedTags = created.tags.filter(tag => tag !== "untagged");
        const notifiedBoards = new Set<string>(); // Track which boards we've already notified
        const notifiedPhoneNumbers = new Set<string>(); // Track which phone numbers we've already SMS'd
        
        log(`📱 Starting shared board notifications for message ID ${created.id} with tags: [${nonUntaggedTags.join(', ')}]`);
        
        for (const tag of nonUntaggedTags) {
          try {
            log(`🏷️  Processing tag: #${tag}`);
            // First check if the sender is a member or creator of any shared board with this tag name
            const senderSharedBoards = await storage.getSharedBoardsByNameForUser(tag, created.userId);
            
            if (senderSharedBoards.length > 0) {
              log(`   Found ${senderSharedBoards.length} shared board(s) for tag #${tag}: [${senderSharedBoards.map(b => `${b.name}(ID:${b.id})`).join(', ')}]`);
              
              // Only send notifications for boards where the sender is actually a member
              for (const board of senderSharedBoards) {
                // Skip if we've already notified this board to prevent duplicates
                if (notifiedBoards.has(board.name)) {
                  log(`   ⏭️  Skipping duplicate notification for board #${board.name} (already processed)`);
                  continue;
                }
                
                const allPhoneNumbers = await storage.getBoardMembersPhoneNumbers(board.name, created.userId);
                log(`   👥 Board #${board.name} has ${allPhoneNumbers.length} member(s): [${allPhoneNumbers.join(', ')}]`);
                
                // Filter out phone numbers we've already notified in this request (using normalized comparison)
                const newPhoneNumbers = allPhoneNumbers.filter(phone => {
                  const normalized = normalizePhoneNumber(phone);
                  return !notifiedPhoneNumbers.has(normalized);
                });
                
                if (newPhoneNumbers.length > 0) {
                  log(`   📤 Queueing SMS notification for ${newPhoneNumbers.length} member(s) of board #${board.name} (ID: ${board.id})`);
                  notifiedBoards.add(board.name); // Mark this board as notified
                  
                  // Track these phone numbers to prevent duplicates in subsequent tags (store normalized)
                  newPhoneNumbers.forEach(phone => notifiedPhoneNumbers.add(normalizePhoneNumber(phone)));
                  
                  // Debounce notifications - wait a few seconds to batch rapid messages
                  const notificationKey = `${board.id}:${created.userId}`;
                  const existing = pendingNotifications.get(notificationKey);
                  
                  if (existing) {
                    // Clear existing timeout and add this message to the batch
                    clearTimeout(existing.timeoutId);
                    existing.messages.push(created.content);
                    log(`   ⏱️  Added to existing notification batch (${existing.messages.length} messages total)`);
                  } else {
                    // Create new pending notification
                    pendingNotifications.set(notificationKey, {
                      boardName: board.name,
                      phoneNumbers: newPhoneNumbers,
                      messages: [created.content],
                      timeoutId: null as any // Will be set below
                    });
                  }
                  
                  // Set/reset the timeout to send notification
                  const pending = pendingNotifications.get(notificationKey)!;
                  pending.timeoutId = setTimeout(() => {
                    const notification = pendingNotifications.get(notificationKey);
                    if (notification) {
                      // Combine all messages
                      const combinedMessage = notification.messages.join(' ');
                      
                      // Apply global deduplication check ONLY when actually sending
                      const finalPhoneNumbers = notification.phoneNumbers.filter(phone => 
                        shouldSendNotification(phone, board.id, combinedMessage)
                      );
                      
                      if (finalPhoneNumbers.length > 0) {
                        log(`   📤 Sending debounced SMS notification to ${finalPhoneNumbers.length} member(s): ${notification.messages.length} message(s) combined`);
                        
                        twilioService.sendSharedBoardNotification(
                          finalPhoneNumbers,
                          notification.boardName,
                          combinedMessage
                        );
                      } else {
                        log(`   ⏭️  All members already notified recently (global dedup cache), skipping debounced notification`);
                      }
                      
                      pendingNotifications.delete(notificationKey);
                    }
                  }, NOTIFICATION_DEBOUNCE_MS);
                  
                  log(`   ⏱️  Notification will send in ${NOTIFICATION_DEBOUNCE_MS/1000}s (unless more messages arrive)`);
                } else {
                  log(`   ⏭️  All members of board #${board.name} already notified via other tags, skipping`);
                }
              }
            } else {
              log(`   ℹ️  Sender ${created.userId} is not a member of any shared board named #${tag}, skipping`);
            }
          } catch (error) {
            log(`   ❌ Error sending SMS notifications for board ${tag}:`, error instanceof Error ? error.message : String(error));
          }
        }
        
        log(`📱 Completed shared board notifications for message ID ${created.id}`);
        */ // END DISABLED SMS notifications
      }
      
      log("After broadcastNewMessage");
      log("Broadcast complete");

      res.json(created);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("SMS webhook error:", errorMessage);

      // Send a more detailed error response
      res.status(400).json({
        error: "Failed to process SMS",
        details: errorMessage,
        receivedPayload: req.body,
      });
    }
    log("Exiting handleWebhook function");
  };

  // Admin endpoint to generate embeddings for all existing messages
  app.post('/api/admin/batch-embed', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const userIsAdmin = await isUserAdmin(userId);
      
      if (!userIsAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      log('Starting batch embedding generation...');
      
      // Get all messages without embeddings
      const messages = await storage.getAllMessagesWithoutEmbeddings(1000);
      log(`Found ${messages.length} messages without embeddings`);
      
      if (messages.length === 0) {
        return res.json({ success: true, message: 'All messages already have embeddings!', processed: 0 });
      }
      
      // Process in batches of 10
      const BATCH_SIZE = 10;
      let processed = 0;
      let errors = 0;
      
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        const texts = batch.map(m => m.content).filter(content => content && content.trim().length > 0);
        
        try {
          const embeddings = await embeddingService.generateEmbeddingsBatch(texts);
          
          await Promise.all(
            batch.map(async (message, idx) => {
              try {
                await storage.saveMessageEmbedding(message.id, embeddings[idx]);
                processed++;
              } catch (error) {
                errors++;
                log(`Failed to save embedding for message ${message.id}:`, error instanceof Error ? error.message : String(error));
              }
            })
          );
        } catch (error) {
          errors += batch.length;
          log(`Failed to generate embeddings for batch:`, error instanceof Error ? error.message : String(error));
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      log(`Batch embedding complete: ${processed} processed, ${errors} errors`);
      res.json({ 
        success: true, 
        message: 'Batch embedding complete', 
        processed, 
        errors,
        total: messages.length
      });
    } catch (error) {
      log('Error in batch-embed endpoint:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Failed to generate batch embeddings' });
    }
  });

  // Test endpoint to send welcome message
  app.post('/api/test-welcome', async (req, res) => {
    try {
      const { phoneNumber } = req.body as { phoneNumber: string };
      await twilioService.sendWelcomeMessage(phoneNumber, onboardingService);
      res.json({ success: true, message: 'Welcome message sent' });
    } catch (error) {
      log('Error in test-welcome endpoint:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Failed to send welcome message' });
    }
  });

  // Register single primary webhook endpoint for Twilio
  // CRITICAL FIX: Use only ONE webhook endpoint to prevent duplicate SMS notifications
  app.post("/api/webhook/twilio", handleWebhook); // Primary Twilio webhook endpoint

  return httpServer;
}

// Request logging middleware
function logRequest(req: any, res: any, next: any) {
  log("Request received:", JSON.stringify({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
  }, null, 2));
  next();
}