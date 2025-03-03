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
    return await db
      .select()
      .from(messages)
      .orderBy(desc(messages.timestamp));
  }

  async getMessagesByTag(tag: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(sql`${messages.tags} @> ARRAY[${tag}]::text[]`)
      .orderBy(desc(messages.timestamp));
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
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
      const updatedMessage = await db
        .update(messages)
        .set({
          content: `${existingMessage.content} ${insertMessage.content}`.trim(),
          tags: [...new Set([...existingMessage.tags, ...insertMessage.tags])],
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
  }

  async getTags(): Promise<string[]> {
    const result = await db.execute<{ tag: string }>(sql`
      SELECT DISTINCT unnest(tags) as tag 
      FROM messages 
      ORDER BY tag
    `);
    return result.rows.map(row => row.tag);
  }
}

export const storage = new DatabaseStorage();