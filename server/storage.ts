import { 
  type Message, 
  type InsertMessage, 
  type User, 
  type InsertUser, 
  type AuthSession, 
  type InsertAuthSession, 
  messages, 
  users, 
  authSessions 
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, gte, and } from "drizzle-orm";
import { log } from "./vite";

export interface IStorage {
  // User management
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(userId: number): Promise<void>;
  
  // Auth session management
  createAuthSession(session: InsertAuthSession): Promise<AuthSession>;
  getValidAuthSession(phoneNumber: string, code: string): Promise<AuthSession | undefined>;
  markSessionAsVerified(sessionId: number): Promise<void>;
  
  // Message management (now user-scoped)
  getMessages(userId: number): Promise<Message[]>;
  getMessagesByTag(userId: number, tag: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getTags(userId: number): Promise<string[]>;
  getRecentMessagesBySender(userId: number, senderId: string, since: Date): Promise<Message[]>;
  updateMessageTags(messageId: number, tags: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User management methods
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
      log("Error fetching user by phone number:", error);
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
      log("Error creating user:", error);
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
      log("Error updating user last login:", error);
      throw error;
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
      log("Error creating auth session:", error);
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
      log("Error fetching valid auth session:", error);
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
      log("Error marking session as verified:", error);
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
      log("Error fetching messages:", error);
      throw error;
    }
  }

  async getMessagesByTag(userId: number, tag: string): Promise<Message[]> {
    try {
      log(`Fetching messages with tag: ${tag} for user ${userId}`);
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
      
      log(`Successfully retrieved ${result.length} messages for tag ${tag}, ${filteredMessages.length} after filtering hashtag-only messages`);
      return filteredMessages;
    } catch (error) {
      log(`Error fetching messages by tag ${tag}:`, error);
      throw error;
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      log("Creating new message:", JSON.stringify(insertMessage, null, 2));

      // Look for recent messages from the same sender (within 5 seconds)
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

      // If we found a recent message, merge the content and tags
      if (recentMessages.length > 0) {
        const existingMessage = recentMessages[0];
        log("Merging with existing message:", JSON.stringify(existingMessage, null, 2));

        const uniqueTags = Array.from(new Set([...existingMessage.tags, ...insertMessage.tags]));

        const updatedMessage = await db
          .update(messages)
          .set({
            content: `${existingMessage.content} ${insertMessage.content}`.trim(),
            tags: uniqueTags,
          })
          .where(eq(messages.id, existingMessage.id))
          .returning()
          .then(rows => rows[0]);

        log("Successfully updated existing message:", JSON.stringify(updatedMessage, null, 2));
        return updatedMessage;
      }

      // Otherwise create a new message
      log("Creating new message record");
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
      log("Error creating message:", error);
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
      log(`Successfully retrieved ${result.rows.length} unique tags`);
      return result.rows.map(row => row.tag);
    } catch (error) {
      log("Error fetching tags:", error);
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
      log("Error fetching recent messages by sender:", error);
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
      log("Error updating message tags:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();