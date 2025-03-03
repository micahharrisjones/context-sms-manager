import { type Message, type InsertMessage, messages } from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql } from "drizzle-orm";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessagesByTag(tag: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getTags(): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  async getMessages(): Promise<Message[]> {
    try {
      return await db
        .select()
        .from(messages)
        .orderBy(desc(messages.timestamp));
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  }

  async getMessagesByTag(tag: string): Promise<Message[]> {
    try {
      return await db
        .select()
        .from(messages)
        .where(sql`${messages.tags} @> ARRAY[${tag}]::text[]`)
        .orderBy(desc(messages.timestamp));
    } catch (error) {
      console.error("Error fetching messages by tag:", error);
      throw error;
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      // Look for recent messages from the same sender (within 5 seconds)
      const recentMessages = await db
        .select()
        .from(messages)
        .where(sql`
          sender_id = ${insertMessage.senderId} 
          AND timestamp > NOW() - INTERVAL '5 seconds'
        `);

      // If we found a recent message, merge the content and tags
      if (recentMessages.length > 0) {
        const existingMessage = recentMessages[0];
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

        return updatedMessage;
      }

      // Otherwise create a new message
      const [message] = await db
        .insert(messages)
        .values({
          ...insertMessage,
          timestamp: new Date(),
        })
        .returning();

      return message;
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  async getTags(): Promise<string[]> {
    try {
      const result = await db.execute<{ tag: string }>(sql`
        SELECT DISTINCT unnest(tags) as tag 
        FROM messages 
        ORDER BY tag
      `);
      return result.rows.map(row => row.tag);
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();