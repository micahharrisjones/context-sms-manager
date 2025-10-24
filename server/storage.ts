import { 
  type Message, 
  type InsertMessage, 
  type User, 
  type InsertUser, 
  type UpdateProfile,
  type AuthSession, 
  type InsertAuthSession,
  type MagicLinkToken,
  type InsertMagicLinkToken,
  type SharedBoard,
  type InsertSharedBoard,
  type BoardMembership,
  type InsertBoardMembership,
  type NotificationPreference,
  type InsertNotificationPreference,
  type UpdateNotificationPreference,
  type OnboardingMessage,
  type UpdateOnboardingMessage,
  type Invite,
  type InsertInvite,
  type MessageEmbedding,
  type InsertMessageEmbedding,
  messages, 
  users, 
  authSessions,
  magicLinkTokens,
  sharedBoards,
  boardMemberships,
  notificationPreferences,
  onboardingMessages,
  invites,
  messageEmbeddings
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, gte, lt, and, inArray, or, like, count, asc } from "drizzle-orm";
import { log } from "./vite";

export interface IStorage {
  // User management
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  getUserById(userId: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(userId: number): Promise<void>;
  updateUserProfile(userId: number, profileData: UpdateProfile): Promise<User | undefined>;
  deleteUser(userId: number): Promise<void>;
  
  // Auth session management
  createAuthSession(session: InsertAuthSession): Promise<AuthSession>;
  getValidAuthSession(phoneNumber: string, code: string): Promise<AuthSession | undefined>;
  markSessionAsVerified(sessionId: number): Promise<void>;
  
  // Magic link token management
  createMagicLinkToken(token: InsertMagicLinkToken): Promise<MagicLinkToken>;
  getValidMagicLinkToken(token: string): Promise<MagicLinkToken | undefined>;
  markTokenAsUsed(tokenId: number): Promise<void>;
  cleanupExpiredTokens(): Promise<void>;
  getRecentTokenCount(userId: number, sinceMinutes: number): Promise<number>;
  
  // Message management (now user-scoped)
  getMessages(userId: number): Promise<Message[]>;
  getMessagesByTag(userId: number, tag: string): Promise<Message[]>;
  getAllMessagesByTagAdmin(tag: string): Promise<Message[]>;
  getAllMessagesByTagForDeletion(userId: number, tag: string): Promise<Message[]>;
  searchMessages(userId: number, query: string): Promise<Message[]>;
  getMessageById(messageId: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(messageId: number): Promise<void>;
  deleteMessagesByTag(userId: number, tag: string): Promise<void>;
  getTags(userId: number): Promise<string[]>;
  getRecentMessagesBySender(userId: number, senderId: string, since: Date): Promise<Message[]>;
  updateMessageTags(messageId: number, tags: string[]): Promise<void>;
  updateMessage(messageId: number, content: string, tags: string[]): Promise<Message>;
  updateMessageEnrichmentStatus(messageId: number, status: string): Promise<void>;
  updateMessageEnrichment(messageId: number, data: {
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    ogSiteName: string | null;
    enrichmentStatus: string;
  }): Promise<void>;
  
  // Shared board management
  getSharedBoards(userId: number): Promise<SharedBoard[]>;
  createSharedBoard(board: InsertSharedBoard): Promise<SharedBoard>;
  getSharedBoard(boardId: number): Promise<SharedBoard | undefined>;
  getSharedBoardByName(name: string): Promise<SharedBoard | undefined>;
  addBoardMember(membership: InsertBoardMembership): Promise<BoardMembership>;
  getBoardMembers(boardId: number): Promise<(BoardMembership & { user: User })[]>;
  getUserBoardMemberships(userId: number): Promise<(BoardMembership & { board: SharedBoard })[]>;
  removeBoardMember(boardId: number, userId: number): Promise<void>;
  deleteSharedBoard(boardId: number): Promise<void>;
  getSharedMessages(userId: number, boardName: string): Promise<Message[]>;
  getUsersForSharedBoardNotification(tags: string[]): Promise<number[]>;
  getBoardMembersPhoneNumbers(boardName: string, excludeUserId?: number): Promise<string[]>;
  getSharedBoardsByNameForUser(boardName: string, userId: number): Promise<SharedBoard[]>;
  getSharedBoardMessageCounts(userId: number): Promise<{ boardName: string; totalCount: number; thisWeekCount: number }[]>;
  
  // Notification preferences management
  getUserNotificationPreferences(userId: number): Promise<NotificationPreference[]>;
  getBoardNotificationPreference(userId: number, boardId: number): Promise<NotificationPreference | undefined>;
  updateNotificationPreference(userId: number, boardId: number, smsEnabled: boolean): Promise<NotificationPreference>;
  deleteNotificationPreference(userId: number, boardId: number): Promise<void>;
  
  // Admin methods
  getAdminStats(): Promise<{
    totalUsers: number;
    totalMessages: number;
    totalSharedBoards: number;
    recentSignups: number;
  }>;
  getAdminUsers(): Promise<{
    id: number;
    phoneNumber: string;
    displayName: string;
    createdAt: string;
    messageCount: number;
    lastActivity: string | null;
  }[]>;
  deleteUserCompletely(userId: number): Promise<{
    success: boolean;
    error?: string;
    deletedMessages: number;
    deletedBoardMemberships: number;
    deletedSharedBoards: number;
  }>;
  bulkDeleteUsers(userIds: number[]): Promise<{
    deletedUsers: number;
    totalMessages: number;
    totalBoardMemberships: number;
    totalSharedBoards: number;
  }>;

  // Onboarding methods
  updateUserOnboardingStep(userId: number, step: string): Promise<void>;
  markOnboardingCompleted(userId: number): Promise<void>;

  // Onboarding messages management
  getOnboardingMessages(): Promise<OnboardingMessage[]>;
  getOnboardingMessage(step: string): Promise<OnboardingMessage | undefined>;
  updateOnboardingMessage(step: string, data: UpdateOnboardingMessage): Promise<OnboardingMessage>;

  // Invite management
  createInvite(invite: InsertInvite): Promise<Invite>;
  getInviteByCode(code: string): Promise<Invite | null>;
  incrementInviteConversions(inviteId: number): Promise<void>;
  updateUserReferral(userId: number, inviteCode: string, signupMethod: string): Promise<void>;
  
  // Embedding methods for hybrid search
  saveMessageEmbedding(messageId: number, embedding: number[]): Promise<void>;
  getMessageEmbedding(messageId: number): Promise<number[] | null>;
  hybridSearch(userId: number, query: string, queryEmbedding: number[], alpha: number, limit: number): Promise<Message[]>;
  getAllMessagesWithoutEmbeddings(limit?: number): Promise<Message[]>;
}

export class DatabaseStorage implements IStorage {
  // User management methods
  async getUserById(userId: number): Promise<User | undefined> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      return user || undefined;
    } catch (error) {
      log(`Error getting user by ID ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    try {
      // Normalize phone number for lookup - remove +1 prefix if present
      const normalizedPhone = phoneNumber.replace(/^\+?1?/, '');
      
      // Try exact match first
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.phoneNumber, phoneNumber));
      
      // If not found, try normalized version
      if (!user) {
        [user] = await db
          .select()
          .from(users)
          .where(eq(users.phoneNumber, normalizedPhone));
      }
      
      // If still not found, try with +1 prefix
      if (!user) {
        [user] = await db
          .select()
          .from(users)
          .where(eq(users.phoneNumber, `+1${normalizedPhone}`));
      }
      
      log(`Phone lookup for ${phoneNumber}: found user ${user?.id || 'none'}`);
      return user || undefined;
    } catch (error) {
      log("Error fetching user by phone number:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      log("Creating new user:", JSON.stringify(insertUser, null, 2));
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning();
      return user;
    } catch (error) {
      log("Error creating user:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateUserLastLogin(userId: number): Promise<void> {
    try {
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, userId));
    } catch (error) {
      log("Error updating user last login:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateUserProfile(userId: number, profileData: UpdateProfile): Promise<User | undefined> {
    try {
      const result = await db
        .update(users)
        .set(profileData)
        .where(eq(users.id, userId))
        .returning();
      
      return result[0];
    } catch (error) {
      log("Error updating user profile:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    const result = await this.deleteUserCompletely(userId);
    if (!result.success) {
      throw new Error(result.error || "Failed to delete user");
    }
  }

  // Auth session management methods
  async createAuthSession(insertSession: InsertAuthSession): Promise<AuthSession> {
    try {
      log("Creating auth session for phone:", insertSession.phoneNumber);
      const [session] = await db
        .insert(authSessions)
        .values(insertSession)
        .returning();
      return session;
    } catch (error) {
      log("Error creating auth session:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getValidAuthSession(phoneNumber: string, code: string): Promise<AuthSession | undefined> {
    try {
      const [session] = await db
        .select()
        .from(authSessions)
        .where(and(
          eq(authSessions.phoneNumber, phoneNumber),
          eq(authSessions.verificationCode, code),
          gte(authSessions.expiresAt, new Date()),
          eq(authSessions.verified, "false")
        ))
        .orderBy(desc(authSessions.createdAt));
      return session || undefined;
    } catch (error) {
      log("Error fetching valid auth session:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async markSessionAsVerified(sessionId: number): Promise<void> {
    try {
      await db
        .update(authSessions)
        .set({ verified: "true" })
        .where(eq(authSessions.id, sessionId));
    } catch (error) {
      log("Error marking session as verified:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Magic link token management methods
  async createMagicLinkToken(insertToken: InsertMagicLinkToken): Promise<MagicLinkToken> {
    try {
      log(`Creating magic link token for user: ${insertToken.userId}`);
      const [token] = await db
        .insert(magicLinkTokens)
        .values(insertToken)
        .returning();
      return token;
    } catch (error) {
      log("Error creating magic link token:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getValidMagicLinkToken(token: string): Promise<MagicLinkToken | undefined> {
    try {
      const [magicToken] = await db
        .select()
        .from(magicLinkTokens)
        .where(and(
          eq(magicLinkTokens.token, token),
          gte(magicLinkTokens.expiresAt, new Date()),
          eq(magicLinkTokens.used, "false")
        ))
        .orderBy(desc(magicLinkTokens.createdAt));
      return magicToken || undefined;
    } catch (error) {
      log("Error fetching valid magic link token:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async markTokenAsUsed(tokenId: number): Promise<void> {
    try {
      await db
        .update(magicLinkTokens)
        .set({ used: "true" })
        .where(eq(magicLinkTokens.id, tokenId));
    } catch (error) {
      log("Error marking token as used:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await db
        .delete(magicLinkTokens)
        .where(or(
          lt(magicLinkTokens.expiresAt, new Date()),
          eq(magicLinkTokens.used, "true")
        ));
      log("Cleaned up expired/used magic link tokens");
    } catch (error) {
      log("Error cleaning up expired tokens:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getRecentTokenCount(userId: number, sinceMinutes: number): Promise<number> {
    try {
      const since = new Date(Date.now() - sinceMinutes * 60 * 1000);
      const result = await db
        .select({ count: count() })
        .from(magicLinkTokens)
        .where(and(
          eq(magicLinkTokens.userId, userId),
          gte(magicLinkTokens.createdAt, since)
        ));
      
      return result[0]?.count || 0;
    } catch (error) {
      log("Error counting recent tokens:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Message management methods (now user-scoped)
  async getMessages(userId: number): Promise<Message[]> {
    try {
      log(`Fetching all messages from database for user ${userId}`);
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.timestamp));
      
      // Filter out hashtag-only messages (messages that are just hashtags with no other content)
      const filteredMessages = result.filter(message => {
        // Remove hashtags and whitespace to see if there's any actual content
        const contentWithoutHashtags = message.content.replace(/#\w+/g, '').replace(/\s/g, '');
        const isHashtagOnly = contentWithoutHashtags.length === 0;
        return !isHashtagOnly;
      });
      
      log(`Successfully retrieved ${result.length} messages, ${filteredMessages.length} after filtering hashtag-only messages`);
      return filteredMessages;
    } catch (error) {
      log("Error fetching messages:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getAllMessagesByTagAdmin(tag: string): Promise<Message[]> {
    try {
      log(`Admin fetching ALL messages with tag: ${tag}`);
      
      const result = await db
        .select()
        .from(messages)
        .where(sql`${messages.tags} @> ARRAY[${tag}]`)
        .orderBy(desc(messages.timestamp));

      log(`Found ${result.length} messages with tag ${tag} (admin view)`);
      return result;
    } catch (error) {
      log("Error fetching admin messages by tag:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getMessagesByTag(userId: number, tag: string): Promise<Message[]> {
    try {
      log(`Fetching private messages with tag: ${tag} for user ${userId}`);
      
      // Always return private tag messages - don't automatically redirect to shared boards
      // Shared boards should only be accessed through explicit shared board navigation
      const result = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.userId, userId),
          sql`${messages.tags} @> ARRAY[${tag}]::text[]`
        ))
        .orderBy(desc(messages.timestamp));
      
      // Filter out hashtag-only messages (messages that are just hashtags with no other content)
      const filteredMessages = result.filter(message => {
        // Remove hashtags and whitespace to see if there's any actual content
        const contentWithoutHashtags = message.content.replace(/#\w+/g, '').replace(/\s/g, '');
        const isHashtagOnly = contentWithoutHashtags.length === 0;
        return !isHashtagOnly;
      });
      
      log(`Successfully retrieved ${result.length} private messages for tag ${tag}, ${filteredMessages.length} after filtering hashtag-only messages`);
      return filteredMessages;
    } catch (error) {
      log(`Error fetching messages by tag ${tag}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async searchMessages(userId: number, query: string): Promise<Message[]> {
    try {
      log(`Searching messages for user ${userId} with query: "${query}"`);
      
      // Search in content using case-insensitive LIKE pattern
      const result = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.userId, userId),
          sql`LOWER(${messages.content}) LIKE LOWER(${'%' + query + '%'})`
        ))
        .orderBy(desc(messages.timestamp));
      
      // Filter out hashtag-only messages
      const filteredMessages = result.filter(message => {
        const contentWithoutHashtags = message.content.replace(/#\w+/g, '').replace(/\s/g, '');
        const isHashtagOnly = contentWithoutHashtags.length === 0;
        return !isHashtagOnly;
      });
      
      log(`Search found ${result.length} messages, ${filteredMessages.length} after filtering hashtag-only messages`);
      return filteredMessages;
    } catch (error) {
      log(`Error searching messages with query "${query}":`, String(error));
      throw error;
    }
  }

  async getMessageById(messageId: number): Promise<Message | undefined> {
    try {
      log(`Fetching message by ID: ${messageId}`);
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId));
      
      log(`Message ${messageId} ${message ? 'found' : 'not found'}`);
      return message || undefined;
    } catch (error) {
      log(`Error fetching message by ID ${messageId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      log("Creating new message:", JSON.stringify(insertMessage, null, 2));

      // BULLETPROOF DEDUPLICATION: Use upsert for MessageSid-based deduplication
      if (insertMessage.messageSid) {
        log(`Attempting upsert for MessageSid: ${insertMessage.messageSid}`);
        
        try {
          // Try to insert the message; if MessageSid already exists, do nothing
          const insertResult = await db
            .insert(messages)
            .values({
              ...insertMessage,
              timestamp: new Date(),
            })
            .onConflictDoNothing({ target: messages.messageSid })
            .returning();

          // If insert succeeded (returned a row), we have the new message
          if (insertResult.length > 0) {
            log("Successfully created new message via upsert:", JSON.stringify(insertResult[0], null, 2));
            return insertResult[0];
          } else {
            // If no rows returned, the MessageSid already exists - fetch existing message
            log(`MessageSid ${insertMessage.messageSid} already exists, fetching existing message`);
            const existing = await db
              .select()
              .from(messages)
              .where(eq(messages.messageSid, insertMessage.messageSid))
              .limit(1);
            
            if (existing.length > 0) {
              log("Returning existing message:", JSON.stringify(existing[0], null, 2));
              return existing[0];
            } else {
              throw new Error(`Failed to find existing message with MessageSid: ${insertMessage.messageSid}`);
            }
          }
        } catch (error) {
          log("Error in upsert operation:", error instanceof Error ? error.message : String(error));
          throw error;
        }
      }

      // For messages without MessageSid, keep existing logic for content merging
      // Look for recent messages from the same sender (within 5 seconds) for content merging
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentMessages = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.senderId, insertMessage.senderId),
          eq(messages.userId, insertMessage.userId),
          gte(messages.timestamp, fiveSecondsAgo)
        ));

      log(`Found ${recentMessages.length} recent messages from sender`);

      // If we found a recent message, only merge if they have the same tags (same intent)
      if (recentMessages.length > 0) {
        const existingMessage = recentMessages[0];
        log("Found recent message, checking if merge is appropriate:", JSON.stringify(existingMessage, null, 2));

        // Only merge if both messages have the same hashtags (indicates same conversation context)
        const existingTagsSet = new Set(existingMessage.tags);
        const newTagsSet = new Set(insertMessage.tags);
        const tagsMatch = existingTagsSet.size === newTagsSet.size && 
                         Array.from(existingTagsSet).every(tag => newTagsSet.has(tag));

        if (tagsMatch) {
          log("Tags match, merging messages");
          const updatedMessage = await db
            .update(messages)
            .set({
              content: `${existingMessage.content} ${insertMessage.content}`.trim(),
            })
            .where(eq(messages.id, existingMessage.id))
            .returning()
            .then(rows => rows[0]);

          log("Successfully merged message:", JSON.stringify(updatedMessage, null, 2));
          return updatedMessage;
        } else {
          log("Tags don't match, creating separate message instead of merging");
        }
      }

      // Otherwise create a new message (fallback for messages without MessageSid)
      log("Creating new message record (no MessageSid provided)");
      const [message] = await db
        .insert(messages)
        .values({
          ...insertMessage,
          timestamp: new Date(),
        })
        .returning();

      log("Successfully created new message:", JSON.stringify(message, null, 2));
      return message;
    } catch (error) {
      log("Error creating message:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    try {
      log(`Deleting message ${messageId}`);
      await db
        .delete(messages)
        .where(eq(messages.id, messageId));
      
      log(`Successfully deleted message ${messageId}`);
    } catch (error) {
      log(`Error deleting message ${messageId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteMessagesByTag(userId: number, tag: string): Promise<void> {
    try {
      log(`Deleting private messages with tag "${tag}" for user ${userId}, preserving shared board messages`);
      
      // First, check if this tag corresponds to any shared board
      const sharedBoard = await this.getSharedBoardByName(tag);
      
      if (sharedBoard) {
        // If it's a shared board, only delete hashtag-only messages (private board creation artifacts)
        // These are messages that are exactly "#tagname" with no other content
        await db
          .delete(messages)
          .where(and(
            eq(messages.userId, userId),
            sql`${messages.tags} @> ARRAY[${tag}]::text[]`,
            eq(messages.content, `#${tag}`)
          ));
        log(`Deleted only hashtag-only messages for shared board tag "${tag}" for user ${userId}`);
      } else {
        // If it's not a shared board, delete all messages with this tag (traditional private board deletion)
        await db
          .delete(messages)
          .where(and(
            eq(messages.userId, userId),
            sql`${messages.tags} @> ARRAY[${tag}]::text[]`
          ));
        log(`Deleted all messages with private tag "${tag}" for user ${userId}`);
      }
    } catch (error) {
      log(`Error deleting messages with tag "${tag}":`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Get all messages with a tag WITHOUT filtering hashtag-only messages (for tag deletion count)
  async getAllMessagesByTagForDeletion(userId: number, tag: string): Promise<Message[]> {
    try {
      log(`Fetching ALL messages (including hashtag-only) with tag: ${tag} for user ${userId}`);
      
      // Check if this tag corresponds to any shared board
      const sharedBoard = await this.getSharedBoardByName(tag);
      
      let result;
      if (sharedBoard) {
        // If it's a shared board, only count hashtag-only messages for deletion
        result = await db
          .select()
          .from(messages)
          .where(and(
            eq(messages.userId, userId),
            sql`${messages.tags} @> ARRAY[${tag}]::text[]`,
            eq(messages.content, `#${tag}`)
          ))
          .orderBy(desc(messages.timestamp));
        log(`Found ${result.length} hashtag-only messages for shared board tag "${tag}"`);
      } else {
        // If it's not a shared board, count all messages with this tag
        result = await db
          .select()
          .from(messages)
          .where(and(
            eq(messages.userId, userId),
            sql`${messages.tags} @> ARRAY[${tag}]::text[]`
          ))
          .orderBy(desc(messages.timestamp));
        log(`Found ${result.length} total messages for private tag "${tag}"`);
      }
      
      return result;
    } catch (error) {
      log(`Error fetching all messages by tag ${tag}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getTags(userId: number): Promise<string[]> {
    try {
      log(`Fetching all unique tags for user ${userId}`);
      const result = await db.execute<{ tag: string }>(sql`
        SELECT DISTINCT unnest(tags) as tag 
        FROM messages 
        WHERE user_id = ${userId}
        ORDER BY tag
      `);
      
      let tags = result.rows.map(row => row.tag);
      
      // Filter out tags that correspond to shared boards the user is a member of
      // These should not appear in private boards since they're handled by shared boards
      const userSharedBoards = await this.getUserBoardMemberships(userId);
      const sharedBoardNames = userSharedBoards.map(membership => membership.board.name);
      
      // Remove tags that match shared board names
      tags = tags.filter(tag => !sharedBoardNames.includes(tag));
      
      log(`Successfully retrieved ${result.rows.length} total tags, ${tags.length} after filtering shared board tags`);
      return tags;
    } catch (error) {
      log("Error fetching tags:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getRecentMessagesBySender(userId: number, senderId: string, since: Date): Promise<Message[]> {
    try {
      log(`Fetching recent messages from ${senderId} since ${since.toISOString()} for user ${userId}`);
      const result = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.senderId, senderId),
          eq(messages.userId, userId),
          gte(messages.timestamp, since)
        ))
        .orderBy(desc(messages.timestamp));
      log(`Found ${result.length} recent messages from sender`);
      return result;
    } catch (error) {
      log("Error fetching recent messages by sender:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateMessageTags(messageId: number, tags: string[]): Promise<void> {
    try {
      log(`Updating message ${messageId} with tags: [${tags.join(', ')}]`);
      await db
        .update(messages)
        .set({
          tags: tags
        })
        .where(eq(messages.id, messageId));
      log(`Successfully updated message ${messageId} tags`);
    } catch (error) {
      log("Error updating message tags:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateMessage(messageId: number, content: string, tags: string[]): Promise<Message> {
    try {
      log(`Updating message ${messageId} with content and tags: [${tags.join(', ')}]`);
      const [updatedMessage] = await db
        .update(messages)
        .set({
          content: content,
          tags: tags
        })
        .where(eq(messages.id, messageId))
        .returning();
      
      log(`Successfully updated message ${messageId}`);
      return updatedMessage;
    } catch (error) {
      log("Error updating message:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateMessageEnrichmentStatus(messageId: number, status: string): Promise<void> {
    try {
      await db
        .update(messages)
        .set({
          enrichmentStatus: status,
          enrichedAt: status === 'completed' ? new Date() : null
        })
        .where(eq(messages.id, messageId));
      
      log(`Updated enrichment status for message ${messageId}: ${status}`);
    } catch (error) {
      log(`Error updating enrichment status for message ${messageId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateMessageEnrichment(messageId: number, data: {
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    ogSiteName: string | null;
    ogIsBlocked?: boolean;
    ogIsFallback?: boolean;
    enrichmentStatus: string;
  }): Promise<void> {
    try {
      await db
        .update(messages)
        .set({
          ogTitle: data.ogTitle,
          ogDescription: data.ogDescription,
          ogImage: data.ogImage,
          ogSiteName: data.ogSiteName,
          ogIsBlocked: data.ogIsBlocked ? 'true' : null,
          ogIsFallback: data.ogIsFallback ? 'true' : null,
          enrichmentStatus: data.enrichmentStatus,
          enrichedAt: new Date()
        })
        .where(eq(messages.id, messageId));
      
      log(`Updated enrichment data for message ${messageId}: ${data.ogTitle || 'No title'}`);
    } catch (error) {
      log(`Error updating enrichment data for message ${messageId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Shared board management methods
  async getSharedBoards(userId: number): Promise<SharedBoard[]> {
    try {
      log(`Fetching shared boards created by user ${userId}`);
      const result = await db
        .select()
        .from(sharedBoards)
        .where(eq(sharedBoards.createdBy, userId))
        .orderBy(sharedBoards.name);
      log(`Found ${result.length} shared boards created by user`);
      return result;
    } catch (error) {
      log("Error fetching shared boards:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async createSharedBoard(board: InsertSharedBoard): Promise<SharedBoard> {
    try {
      log(`Creating shared board: ${board.name}`);
      const [result] = await db
        .insert(sharedBoards)
        .values(board)
        .returning();
      
      // Add creator as owner
      await this.addBoardMember({
        boardId: result.id,
        userId: board.createdBy,
        role: "owner",
        invitedBy: board.createdBy,
      });
      
      log(`Successfully created shared board ${result.id}`);
      return result;
    } catch (error) {
      log("Error creating shared board:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSharedBoard(boardId: number): Promise<SharedBoard | undefined> {
    try {
      const [result] = await db
        .select()
        .from(sharedBoards)
        .where(eq(sharedBoards.id, boardId));
      return result || undefined;
    } catch (error) {
      log("Error fetching shared board:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSharedBoardByName(name: string): Promise<SharedBoard | undefined> {
    try {
      const [result] = await db
        .select()
        .from(sharedBoards)
        .where(eq(sharedBoards.name, name));
      return result || undefined;
    } catch (error) {
      log("Error fetching shared board by name:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async addBoardMember(membership: InsertBoardMembership): Promise<BoardMembership> {
    try {
      log(`Adding user ${membership.userId} to board ${membership.boardId}`);
      const [result] = await db
        .insert(boardMemberships)
        .values(membership)
        .returning();
      log(`Successfully added board member ${result.id}`);
      return result;
    } catch (error) {
      log("Error adding board member:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getBoardMembers(boardId: number): Promise<(BoardMembership & { user: User })[]> {
    try {
      const result = await db
        .select({
          id: boardMemberships.id,
          boardId: boardMemberships.boardId,
          userId: boardMemberships.userId,
          role: boardMemberships.role,
          invitedBy: boardMemberships.invitedBy,
          joinedAt: boardMemberships.joinedAt,
          user: {
            id: users.id,
            phoneNumber: users.phoneNumber,
            displayName: users.displayName,
            firstName: users.firstName,
            lastName: users.lastName,
            avatarUrl: users.avatarUrl,
            onboardingStep: users.onboardingStep,
            onboardingCompletedAt: users.onboardingCompletedAt,
            referredBy: users.referredBy,
            signupMethod: users.signupMethod,
            createdAt: users.createdAt,
            lastLoginAt: users.lastLoginAt,
          },
        })
        .from(boardMemberships)
        .innerJoin(users, eq(boardMemberships.userId, users.id))
        .where(eq(boardMemberships.boardId, boardId));
      return result;
    } catch (error) {
      log("Error fetching board members:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getUserBoardMemberships(userId: number): Promise<(BoardMembership & { board: SharedBoard })[]> {
    try {
      log(`Fetching board memberships for user ${userId}`);
      const result = await db
        .select({
          id: boardMemberships.id,
          boardId: boardMemberships.boardId,
          userId: boardMemberships.userId,
          role: boardMemberships.role,
          invitedBy: boardMemberships.invitedBy,
          joinedAt: boardMemberships.joinedAt,
          board: sharedBoards,
        })
        .from(boardMemberships)
        .innerJoin(sharedBoards, eq(boardMemberships.boardId, sharedBoards.id))
        .where(eq(boardMemberships.userId, userId))
        .orderBy(sharedBoards.name);
      log(`Found ${result.length} board memberships for user`);
      return result;
    } catch (error) {
      log("Error fetching user board memberships:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async removeBoardMember(boardId: number, userId: number): Promise<void> {
    try {
      log(`Removing user ${userId} from board ${boardId}`);
      await db
        .delete(boardMemberships)
        .where(and(
          eq(boardMemberships.boardId, boardId),
          eq(boardMemberships.userId, userId)
        ));
      log(`Successfully removed board member`);
    } catch (error) {
      log("Error removing board member:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteSharedBoard(boardId: number): Promise<void> {
    try {
      log(`Deleting shared board ${boardId}`);
      
      // First delete all board memberships
      await db
        .delete(boardMemberships)
        .where(eq(boardMemberships.boardId, boardId));
      
      // Then delete the board itself
      await db
        .delete(sharedBoards)
        .where(eq(sharedBoards.id, boardId));
        
      log(`Successfully deleted shared board ${boardId} and all its memberships`);
    } catch (error) {
      log("Error deleting shared board:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async renameSharedBoard(boardId: number, newName: string): Promise<SharedBoard> {
    try {
      log(`Renaming shared board ${boardId} to ${newName}`);
      
      const [updatedBoard] = await db
        .update(sharedBoards)
        .set({ name: newName })
        .where(eq(sharedBoards.id, boardId))
        .returning();
        
      log(`Successfully renamed shared board ${boardId} to ${newName}`);
      return updatedBoard;
    } catch (error) {
      log("Error renaming shared board:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async renamePrivateBoard(userId: number, oldTag: string, newTag: string): Promise<void> {
    try {
      log(`Renaming private board hashtag from ${oldTag} to ${newTag} for user ${userId}`);
      
      // Get all messages that contain the old tag
      const messagesToUpdate = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.userId, userId),
          sql`${oldTag} = ANY(tags)`
        ));
      
      log(`Found ${messagesToUpdate.length} messages to update`);
      
      // Update each message's tags array
      for (const message of messagesToUpdate) {
        const updatedTags = message.tags.map(tag => tag === oldTag ? newTag : tag);
        await db
          .update(messages)
          .set({ tags: updatedTags })
          .where(eq(messages.id, message.id));
      }
      
      log(`Successfully renamed private board hashtag from ${oldTag} to ${newTag}`);
    } catch (error) {
      log("Error renaming private board:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSharedMessages(userId: number, boardName: string): Promise<Message[]> {
    try {
      log(`Fetching shared messages for board ${boardName} accessible to user ${userId}`);
      
      // First, check if user has access to this shared board
      const boardMembership = await db
        .select({
          board: sharedBoards,
        })
        .from(boardMemberships)
        .innerJoin(sharedBoards, eq(boardMemberships.boardId, sharedBoards.id))
        .where(and(
          eq(boardMemberships.userId, userId),
          eq(sharedBoards.name, boardName)
        ));
      
      if (boardMembership.length === 0) {
        log(`User ${userId} does not have access to board ${boardName}`);
        return [];
      }

      // Get all members of this board
      const boardMembers = await db
        .select({
          userId: boardMemberships.userId,
        })
        .from(boardMemberships)
        .innerJoin(sharedBoards, eq(boardMemberships.boardId, sharedBoards.id))
        .where(eq(sharedBoards.name, boardName));

      const memberIds = boardMembers.map(m => m.userId);
      
      if (memberIds.length === 0) {
        return [];
      }

      // Get messages with the shared tag from all board members, including sender info
      const result = await db
        .select({
          id: messages.id,
          content: messages.content,
          senderId: messages.senderId,
          userId: messages.userId,
          timestamp: messages.timestamp,
          tags: messages.tags,
          mediaUrl: messages.mediaUrl,
          mediaType: messages.mediaType,
          messageSid: messages.messageSid,
          ogTitle: messages.ogTitle,
          ogDescription: messages.ogDescription,
          ogImage: messages.ogImage,
          ogSiteName: messages.ogSiteName,
          ogIsBlocked: messages.ogIsBlocked,
          ogIsFallback: messages.ogIsFallback,
          enrichmentStatus: messages.enrichmentStatus,
          enrichedAt: messages.enrichedAt,
          // Include sender profile information
          senderFirstName: users.firstName,
          senderLastName: users.lastName,
          senderAvatarUrl: users.avatarUrl,
          senderDisplayName: users.displayName,
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(and(
          inArray(messages.userId, memberIds),
          sql`${messages.tags} @> ARRAY[${boardName}]`
        ))
        .orderBy(desc(messages.timestamp));

      // Filter out hashtag-only messages for cleaner UI
      const filteredMessages = result.filter(message => 
        message.content && message.content.trim() !== `#${boardName}`
      );

      log(`Found ${filteredMessages.length} shared messages in board ${boardName}`);
      return filteredMessages;
    } catch (error) {
      log("Error fetching shared messages:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getSharedBoardMessageCounts(userId: number): Promise<{ boardName: string; totalCount: number; thisWeekCount: number }[]> {
    try {
      log(`Fetching shared board message counts for user ${userId}`);
      
      // Get all boards user has access to
      const userBoards = await db
        .select({
          boardId: boardMemberships.boardId,
          boardName: sharedBoards.name,
        })
        .from(boardMemberships)
        .innerJoin(sharedBoards, eq(boardMemberships.boardId, sharedBoards.id))
        .where(eq(boardMemberships.userId, userId));
      
      if (userBoards.length === 0) {
        return [];
      }
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // For each board, get all member IDs and count messages efficiently
      const boardCounts = await Promise.all(
        userBoards.map(async (board) => {
          // Get all members of this board
          const boardMembers = await db
            .select({ userId: boardMemberships.userId })
            .from(boardMemberships)
            .where(eq(boardMemberships.boardId, board.boardId));
          
          const memberIds = boardMembers.map(m => m.userId);
          
          if (memberIds.length === 0) {
            return { boardName: board.boardName, totalCount: 0, thisWeekCount: 0 };
          }
          
          // Count total messages (excluding hashtag-only messages)
          const totalResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
              inArray(messages.userId, memberIds),
              sql`${messages.tags} @> ARRAY[${board.boardName}]`,
              sql`trim(${messages.content}) != ${`#${board.boardName}`}`
            ));
          
          // Count messages this week (excluding hashtag-only messages)
          const thisWeekResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(and(
              inArray(messages.userId, memberIds),
              sql`${messages.tags} @> ARRAY[${board.boardName}]`,
              sql`trim(${messages.content}) != ${`#${board.boardName}`}`,
              sql`${messages.timestamp} >= ${oneWeekAgo}`
            ));
          
          return {
            boardName: board.boardName,
            totalCount: Number(totalResult[0]?.count || 0),
            thisWeekCount: Number(thisWeekResult[0]?.count || 0),
          };
        })
      );
      
      log(`Retrieved message counts for ${boardCounts.length} shared boards`);
      return boardCounts;
    } catch (error) {
      log("Error fetching shared board message counts:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getUsersForSharedBoardNotification(tags: string[]): Promise<number[]> {
    try {
      if (tags.length === 0) {
        return [];
      }

      log(`Finding users to notify for tags: [${tags.join(', ')}]`);
      
      // Find all shared boards that match any of the tags
      const matchingBoards = await db
        .select({ id: sharedBoards.id, name: sharedBoards.name, createdBy: sharedBoards.createdBy })
        .from(sharedBoards)
        .where(inArray(sharedBoards.name, tags));

      if (matchingBoards.length === 0) {
        log("No shared boards found for the given tags");
        return [];
      }

      const userIds = new Set<number>();
      
      for (const board of matchingBoards) {
        // Add the board creator
        userIds.add(board.createdBy);
        
        // Add all board members
        const memberships = await db
          .select({ userId: boardMemberships.userId })
          .from(boardMemberships)
          .where(eq(boardMemberships.boardId, board.id));
        
        memberships.forEach(membership => userIds.add(membership.userId));
      }

      const resultArray = Array.from(userIds);
      log(`Found ${resultArray.length} users to notify: [${resultArray.join(', ')}]`);
      return resultArray;
    } catch (error) {
      log(`Error getting users for shared board notification: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getBoardMembersPhoneNumbers(boardName: string, excludeUserId?: number): Promise<string[]> {
    try {
      log(`Getting phone numbers for board members of ${boardName}, excluding user ${excludeUserId || 'none'}`);
      
      // Find the shared board
      const board = await db
        .select({ id: sharedBoards.id, createdBy: sharedBoards.createdBy })
        .from(sharedBoards)
        .where(eq(sharedBoards.name, boardName));

      if (board.length === 0) {
        log(`No shared board found with name ${boardName}`);
        return [];
      }

      const boardInfo = board[0];
      const phoneNumbers: string[] = [];

      // Helper function to check if SMS notifications are enabled for a user
      const isSmsEnabled = async (userId: number): Promise<boolean> => {
        const preference = await this.getBoardNotificationPreference(userId, boardInfo.id);
        // Default to enabled if no preference is set
        return preference ? preference.smsEnabled === "true" : true;
      };

      // Get creator's phone number (if not excluded and notifications enabled)
      if (!excludeUserId || boardInfo.createdBy !== excludeUserId) {
        const smsEnabled = await isSmsEnabled(boardInfo.createdBy);
        if (smsEnabled) {
          const [creator] = await db
            .select({ phoneNumber: users.phoneNumber })
            .from(users)
            .where(eq(users.id, boardInfo.createdBy));
          
          if (creator) {
            phoneNumbers.push(creator.phoneNumber);
          }
        } else {
          log(`SMS notifications disabled for board creator ${boardInfo.createdBy}`);
        }
      }

      // Get all board members' phone numbers (excluding the specified user and those with disabled notifications)
      const membersQuery = db
        .select({ 
          phoneNumber: users.phoneNumber,
          userId: boardMemberships.userId 
        })
        .from(boardMemberships)
        .innerJoin(users, eq(boardMemberships.userId, users.id))
        .where(eq(boardMemberships.boardId, boardInfo.id));

      const members = await membersQuery;
      
      for (const member of members) {
        if (!excludeUserId || member.userId !== excludeUserId) {
          const smsEnabled = await isSmsEnabled(member.userId);
          if (smsEnabled) {
            phoneNumbers.push(member.phoneNumber);
          } else {
            log(`SMS notifications disabled for member ${member.userId}`);
          }
        }
      }

      log(`Found ${phoneNumbers.length} phone numbers for board ${boardName} notifications (after filtering preferences)`);
      return phoneNumbers;
    } catch (error) {
      log(`Error getting board members phone numbers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getSharedBoardsByNameForUser(boardName: string, userId: number): Promise<SharedBoard[]> {
    try {
      log(`Getting shared boards named ${boardName} where user ${userId} is a member or creator`);
      
      // Find shared boards with the given name where user is creator OR member
      const creatorBoards = await db
        .select()
        .from(sharedBoards)
        .where(and(
          eq(sharedBoards.name, boardName),
          eq(sharedBoards.createdBy, userId)
        ));

      // Find shared boards with the given name where user is a member
      const memberBoards = await db
        .select({
          id: sharedBoards.id,
          name: sharedBoards.name,
          createdBy: sharedBoards.createdBy,
          createdAt: sharedBoards.createdAt
        })
        .from(sharedBoards)
        .innerJoin(boardMemberships, eq(sharedBoards.id, boardMemberships.boardId))
        .where(and(
          eq(sharedBoards.name, boardName),
          eq(boardMemberships.userId, userId)
        ));

      // Combine and deduplicate results
      const allBoards = [...creatorBoards, ...memberBoards];
      const uniqueBoards = allBoards.filter((board, index, self) => 
        index === self.findIndex(b => b.id === board.id)
      );

      log(`Found ${uniqueBoards.length} shared boards named ${boardName} for user ${userId}`);
      return uniqueBoards;
    } catch (error) {
      log(`Error getting shared boards by name for user: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Admin methods
  async getAdminStats() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [totalUsersResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users);

      const [totalMessagesResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages);

      const [totalSharedBoardsResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sharedBoards);

      const [recentSignupsResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(gte(users.createdAt, sevenDaysAgo));

      return {
        totalUsers: totalUsersResult.count,
        totalMessages: totalMessagesResult.count,
        totalSharedBoards: totalSharedBoardsResult.count,
        recentSignups: recentSignupsResult.count
      };
    } catch (error) {
      log(`Error getting admin stats: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async getAdminUsers() {
    try {
      const userList = await db
        .select({
          id: users.id,
          phoneNumber: users.phoneNumber,
          displayName: users.displayName,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt
        })
        .from(users)
        .orderBy(desc(users.createdAt));

      // Get message counts for each user
      const result = [];
      for (const user of userList) {
        const [messageCountResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(eq(messages.userId, user.id));

        result.push({
          id: user.id,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName || `User ${user.phoneNumber.slice(-4)}`,
          createdAt: user.createdAt.toISOString(),
          messageCount: messageCountResult.count,
          lastActivity: user.lastLoginAt?.toISOString() || null
        });
      }

      return result;
    } catch (error) {
      log(`Error getting admin users: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async deleteUserCompletely(userId: number) {
    try {
      // Check if user exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!existingUser) {
        return {
          success: false,
          error: "User not found",
          deletedMessages: 0,
          deletedBoardMemberships: 0,
          deletedSharedBoards: 0
        };
      }

      // Get counts before deletion
      const [messageCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(eq(messages.userId, userId));

      const [membershipCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(boardMemberships)
        .where(eq(boardMemberships.userId, userId));

      const [ownedBoardsCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sharedBoards)
        .where(eq(sharedBoards.createdBy, userId));

      // Delete in correct order to respect foreign key constraints
      
      // 1. Delete messages created by this user
      log(`Deleting ${messageCount.count} messages for user ${userId} (phone: ${existingUser.phoneNumber})`);
      await db
        .delete(messages)
        .where(eq(messages.userId, userId));

      // 2. Delete board memberships for this user
      await db
        .delete(boardMemberships)
        .where(eq(boardMemberships.userId, userId));

      // 3. For shared boards created by this user, delete ALL memberships first, then the boards
      const ownedBoards = await db
        .select({ id: sharedBoards.id })
        .from(sharedBoards)
        .where(eq(sharedBoards.createdBy, userId));
        
      for (const board of ownedBoards) {
        // Delete all memberships to this board (including other users)
        await db
          .delete(boardMemberships)
          .where(eq(boardMemberships.boardId, board.id));
        
        // Now safe to delete the board itself
        await db
          .delete(sharedBoards)
          .where(eq(sharedBoards.id, board.id));
      }

      // 4. Delete auth sessions (both by user phone number and any orphaned sessions)
      await db
        .delete(authSessions)
        .where(eq(authSessions.phoneNumber, existingUser.phoneNumber));

      // 5. Double-check: Remove any remaining messages that might reference this phone number as senderId
      // This handles edge cases where messages might exist with senderId but wrong userId
      log(`Double-checking: Removing any orphaned messages with senderId ${existingUser.phoneNumber}`);
      const orphanedResult = await db
        .delete(messages)
        .where(eq(messages.senderId, existingUser.phoneNumber));
      log(`Cleaned up any orphaned messages for phone number ${existingUser.phoneNumber}`);

      // 6. Finally delete the user
      await db
        .delete(users)
        .where(eq(users.id, userId));

      return {
        success: true,
        deletedMessages: messageCount.count,
        deletedBoardMemberships: membershipCount.count,
        deletedSharedBoards: ownedBoardsCount.count
      };
    } catch (error) {
      log(`Error deleting user completely: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  async bulkDeleteUsers(userIds: number[]) {
    try {
      let totalMessages = 0;
      let totalBoardMemberships = 0;
      let totalSharedBoards = 0;
      let deletedUsers = 0;

      // Process each user individually to get accurate counts and handle constraints
      for (const userId of userIds) {
        const result = await this.deleteUserCompletely(userId);
        if (result.success) {
          deletedUsers++;
          totalMessages += result.deletedMessages;
          totalBoardMemberships += result.deletedBoardMemberships;
          totalSharedBoards += result.deletedSharedBoards;
        }
      }

      return {
        deletedUsers,
        totalMessages,
        totalBoardMemberships,
        totalSharedBoards
      };
    } catch (error) {
      log(`Error bulk deleting users: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  // Notification preferences methods
  async getUserNotificationPreferences(userId: number): Promise<NotificationPreference[]> {
    try {
      log(`Getting notification preferences for user ${userId}`);
      
      const preferences = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
      
      log(`Found ${preferences.length} notification preferences for user ${userId}`);
      return preferences;
    } catch (error) {
      log("Error getting user notification preferences:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getBoardNotificationPreference(userId: number, boardId: number): Promise<NotificationPreference | undefined> {
    try {
      log(`Getting notification preference for user ${userId} and board ${boardId}`);
      
      const preference = await db
        .select()
        .from(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.boardId, boardId)
        ))
        .limit(1);
      
      return preference[0];
    } catch (error) {
      log("Error getting board notification preference:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateNotificationPreference(userId: number, boardId: number, smsEnabled: boolean): Promise<NotificationPreference> {
    try {
      log(`Updating notification preference for user ${userId}, board ${boardId}, smsEnabled: ${smsEnabled}`);
      
      // Check if preference already exists
      const existing = await this.getBoardNotificationPreference(userId, boardId);
      
      if (existing) {
        // Update existing preference
        const updated = await db
          .update(notificationPreferences)
          .set({ 
            smsEnabled: smsEnabled ? "true" : "false",
            updatedAt: sql`NOW()`
          })
          .where(and(
            eq(notificationPreferences.userId, userId),
            eq(notificationPreferences.boardId, boardId)
          ))
          .returning();
        
        return updated[0];
      } else {
        // Create new preference
        const newPreference: InsertNotificationPreference = {
          userId,
          boardId,
          smsEnabled: smsEnabled ? "true" : "false"
        };
        
        const created = await db
          .insert(notificationPreferences)
          .values(newPreference)
          .returning();
        
        return created[0];
      }
    } catch (error) {
      log("Error updating notification preference:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async deleteNotificationPreference(userId: number, boardId: number): Promise<void> {
    try {
      log(`Deleting notification preference for user ${userId} and board ${boardId}`);
      
      await db
        .delete(notificationPreferences)
        .where(and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.boardId, boardId)
        ));
      
      log(`Deleted notification preference for user ${userId} and board ${boardId}`);
    } catch (error) {
      log("Error deleting notification preference:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Onboarding methods
  async updateUserOnboardingStep(userId: number, step: string): Promise<void> {
    try {
      log(`Updating onboarding step for user ${userId} to ${step}`);
      
      await db
        .update(users)
        .set({ onboardingStep: step })
        .where(eq(users.id, userId));
      
      log(`Updated onboarding step for user ${userId} to ${step}`);
    } catch (error) {
      log("Error updating onboarding step:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async markOnboardingCompleted(userId: number): Promise<void> {
    try {
      log(`Marking onboarding completed for user ${userId}`);
      
      await db
        .update(users)
        .set({ 
          onboardingStep: "completed",
          onboardingCompletedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      log(`Marked onboarding completed for user ${userId}`);
    } catch (error) {
      log("Error marking onboarding completed:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Onboarding messages management
  async getOnboardingMessages(): Promise<OnboardingMessage[]> {
    try {
      const messages = await db
        .select()
        .from(onboardingMessages)
        .orderBy(asc(onboardingMessages.step));
      
      return messages;
    } catch (error) {
      log("Error getting onboarding messages:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getOnboardingMessage(step: string): Promise<OnboardingMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(onboardingMessages)
        .where(eq(onboardingMessages.step, step));
      
      return message;
    } catch (error) {
      log("Error getting onboarding message:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateOnboardingMessage(step: string, data: UpdateOnboardingMessage): Promise<OnboardingMessage> {
    try {
      log(`Updating onboarding message for step ${step}`);
      
      const [updated] = await db
        .update(onboardingMessages)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(onboardingMessages.step, step))
        .returning();
      
      if (!updated) {
        throw new Error(`Onboarding message for step ${step} not found`);
      }
      
      log(`Updated onboarding message for step ${step}`);
      return updated;
    } catch (error) {
      log("Error updating onboarding message:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Invite management methods
  async createInvite(invite: InsertInvite): Promise<Invite> {
    try {
      const [newInvite] = await db
        .insert(invites)
        .values(invite)
        .returning();
      
      log(`Created invite with code ${newInvite.code}`);
      return newInvite;
    } catch (error) {
      log("Error creating invite:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getInviteByCode(code: string): Promise<Invite | null> {
    try {
      const [invite] = await db
        .select()
        .from(invites)
        .where(eq(invites.code, code));
      
      return invite || null;
    } catch (error) {
      log("Error getting invite by code:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async incrementInviteConversions(inviteId: number): Promise<void> {
    try {
      await db
        .update(invites)
        .set({
          conversions: sql`${invites.conversions} + 1`
        })
        .where(eq(invites.id, inviteId));
      
      log(`Incremented conversions for invite ${inviteId}`);
    } catch (error) {
      log("Error incrementing invite conversions:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async updateUserReferral(userId: number, inviteCode: string, signupMethod: string): Promise<void> {
    try {
      await db
        .update(users)
        .set({
          referredBy: inviteCode,
          signupMethod: signupMethod
        })
        .where(eq(users.id, userId));
      
      log(`Updated user ${userId} referral info: code=${inviteCode}, method=${signupMethod}`);
    } catch (error) {
      log("Error updating user referral:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Embedding methods for hybrid search
  async saveMessageEmbedding(messageId: number, embedding: number[]): Promise<void> {
    try {
      // Format embedding as PostgreSQL vector string
      const embeddingString = `[${embedding.join(',')}]`;
      
      await db
        .insert(messageEmbeddings)
        .values({
          messageId: messageId,
          embedding: sql`${embeddingString}::vector`
        })
        .onConflictDoUpdate({
          target: messageEmbeddings.messageId,
          set: { embedding: sql`${embeddingString}::vector` }
        });
      
      log(`Saved embedding for message ${messageId}`);
    } catch (error) {
      log(`Error saving embedding for message ${messageId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getMessageEmbedding(messageId: number): Promise<number[] | null> {
    try {
      const result = await db
        .select()
        .from(messageEmbeddings)
        .where(eq(messageEmbeddings.messageId, messageId))
        .limit(1);
      
      if (result.length === 0) {
        return null;
      }
      
      // The embedding is stored as a vector type, convert to array
      return result[0].embedding as unknown as number[];
    } catch (error) {
      log(`Error getting embedding for message ${messageId}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async hybridSearch(userId: number, query: string, queryEmbedding: number[], alpha: number = 0.7, limit: number = 20): Promise<Message[]> {
    try {
      log(`Performing hybrid search for user ${userId} with query: "${query}", alpha: ${alpha}`);
      
      // Format query embedding as PostgreSQL vector
      const embeddingString = `[${queryEmbedding.join(',')}]`;
      
      // Hybrid search using BM25 (keyword) + vector similarity
      // Alpha determines the weight: 0 = pure keyword, 1 = pure semantic
      // We use alpha=0.7 to lean toward semantic search for conversational queries
      const results = await db.execute(sql`
        WITH keyword_scores AS (
          SELECT 
            m.id,
            ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', ${query})) as keyword_score
          FROM ${messages} m
          WHERE m.user_id = ${userId}
            AND to_tsvector('english', m.content) @@ plainto_tsquery('english', ${query})
        ),
        vector_scores AS (
          SELECT 
            m.id,
            1 - (me.embedding <=> ${embeddingString}::vector) as vector_score
          FROM ${messages} m
          INNER JOIN ${messageEmbeddings} me ON m.id = me.message_id
          WHERE m.user_id = ${userId}
          ORDER BY me.embedding <=> ${embeddingString}::vector
          LIMIT 100
        ),
        combined_scores AS (
          SELECT 
            COALESCE(ks.id, vs.id) as id,
            COALESCE(ks.keyword_score, 0) * ${1 - alpha} + COALESCE(vs.vector_score, 0) * ${alpha} as hybrid_score
          FROM keyword_scores ks
          FULL OUTER JOIN vector_scores vs ON ks.id = vs.id
        )
        SELECT 
          m.id, m.content, m.sender_id, m.user_id, m.timestamp, m.tags, 
          m.media_url, m.media_type, m.message_sid, m.og_title, m.og_description,
          m.og_image, m.og_site_name, m.og_is_blocked, m.og_is_fallback, 
          m.enrichment_status, m.enriched_at
        FROM ${messages} m
        INNER JOIN combined_scores cs ON m.id = cs.id
        WHERE cs.hybrid_score > 0.4
          AND LENGTH(m.content) >= 2
        ORDER BY cs.hybrid_score DESC
        LIMIT ${limit}
      `);
      
      log(`Hybrid search returned ${results.rows.length} results`);
      return results.rows as Message[];
    } catch (error) {
      log(`Error performing hybrid search:`, error instanceof Error ? error.message : String(error));
      // Fallback to simple keyword search if hybrid fails
      log("Falling back to keyword search");
      return this.searchMessages(userId, query);
    }
  }

  async keywordSearch(userId: number, query: string, limit: number = 50): Promise<Message[]> {
    try {
      log(`Performing enhanced keyword search for user ${userId} with query: "${query}"`);
      
      // Enhanced search with exact matching, prefix matching, and fuzzy matching
      // Exact matches score highest, prefix matches medium, fuzzy/similarity matches lower
      const prefixQuery = query.split(/\s+/).map(word => `${word}:*`).join(' & ');
      
      const results = await db.execute(sql`
        WITH combined_text AS (
          SELECT 
            m.*,
            COALESCE(m.content, '') || ' ' || 
            COALESCE(m.og_title, '') || ' ' || 
            COALESCE(m.og_description, '') || ' ' ||
            COALESCE(array_to_string(m.tags, ' '), '') as full_text
          FROM ${messages} m
          WHERE m.user_id = ${userId}
        ),
        scored_results AS (
          SELECT 
            ct.*,
            -- Exact match score (highest priority)
            ts_rank(
              to_tsvector('english', ct.full_text),
              plainto_tsquery('english', ${query})
            ) * 10 as exact_score,
            -- Prefix match score (medium priority)
            ts_rank(
              to_tsvector('english', ct.full_text),
              to_tsquery('english', ${prefixQuery})
            ) * 5 as prefix_score,
            -- Fuzzy/similarity score (lower priority, handles typos)
            GREATEST(
              similarity(ct.content, ${query}),
              similarity(ct.og_title, ${query}),
              similarity(ct.og_description, ${query})
            ) * 2 as fuzzy_score
          FROM combined_text ct
          WHERE 
            -- Match if any scoring method finds it
            to_tsvector('english', ct.full_text) @@ plainto_tsquery('english', ${query})
            OR to_tsvector('english', ct.full_text) @@ to_tsquery('english', ${prefixQuery})
            OR similarity(ct.full_text, ${query}) > 0.1
        )
        SELECT 
          id, content, sender_id, user_id, timestamp, tags, media_url, 
          media_type, message_sid, og_title, og_description,
          og_image, og_site_name, og_is_blocked, og_is_fallback, 
          enrichment_status, enriched_at,
          (exact_score + prefix_score + fuzzy_score) as total_score
        FROM scored_results
        WHERE (exact_score + prefix_score + fuzzy_score) > 0
        ORDER BY total_score DESC, timestamp DESC
        LIMIT ${limit}
      `);
      
      log(`Enhanced keyword search returned ${results.rows.length} results`);
      return results.rows as Message[];
    } catch (error) {
      log(`Error performing keyword search:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getAllMessagesWithoutEmbeddings(limit: number = 1000): Promise<Message[]> {
    try {
      const results = await db
        .select()
        .from(messages)
        .leftJoin(messageEmbeddings, eq(messages.id, messageEmbeddings.messageId))
        .where(sql`${messageEmbeddings.id} IS NULL`)
        .orderBy(asc(messages.timestamp))
        .limit(limit);
      
      log(`Found ${results.length} messages without embeddings`);
      return results.map(r => r.messages);
    } catch (error) {
      log(`Error getting messages without embeddings:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();