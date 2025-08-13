import { type Message, type InsertMessage, messages } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, gte, and } from "drizzle-orm";
import { log } from "./vite";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessagesByTag(tag: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getTags(): Promise<string[]>;
  getRecentMessagesBySender(senderId: string, since: Date): Promise<Message[]>;
  updateMessageTags(messageId: number, tags: string[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getMessages(): Promise<Message[]> {
    try {
      log("Fetching all messages from database");
      const result = await db
        .select()
        .from(messages)
        .orderBy(desc(messages.timestamp));
      log(`Successfully retrieved ${result.length} messages`);
      return result;
    } catch (error) {
      log("Error fetching messages:", error);
      throw error;
    }
  }

  async getMessagesByTag(tag: string): Promise<Message[]> {
    try {
      log(`Fetching messages with tag: ${tag}`);
      const result = await db
        .select()
        .from(messages)
        .where(sql`${messages.tags} @> ARRAY[${tag}]::text[]`)
        .orderBy(desc(messages.timestamp));
      log(`Successfully retrieved ${result.length} messages for tag ${tag}`);
      return result;
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

  async getTags(): Promise<string[]> {
    try {
      log("Fetching all unique tags");
      const result = await db.execute<{ tag: string }>(sql`
        SELECT DISTINCT unnest(tags) as tag 
        FROM messages 
        ORDER BY tag
      `);
      log(`Successfully retrieved ${result.rows.length} unique tags`);
      return result.rows.map(row => row.tag);
    } catch (error) {
      log("Error fetching tags:", error);
      throw error;
    }
  }

  async getRecentMessagesBySender(senderId: string, since: Date): Promise<Message[]> {
    try {
      log(`Fetching recent messages from ${senderId} since ${since.toISOString()}`);
      const result = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.senderId, senderId),
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