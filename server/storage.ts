import { type Message, type InsertMessage } from "@shared/schema";

export interface IStorage {
  getMessages(): Promise<Message[]>;
  getMessagesByTag(tag: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  getTags(): Promise<string[]>;
}

export class MemStorage implements IStorage {
  private messages: Map<number, Message>;
  private currentId: number;

  constructor() {
    this.messages = new Map();
    this.currentId = 1;

    // Add some initial test messages
    const testMessages: InsertMessage[] = [
      {
        content: "Important meeting notes #work #notes",
        senderId: "test-user",
        tags: ["work", "notes"],
        mediaUrl: null,
        mediaType: null,
      },
      {
        content: "Remember to buy groceries #shopping #todo",
        senderId: "test-user",
        tags: ["shopping", "todo"],
        mediaUrl: null,
        mediaType: null,
      },
      {
        content: "Great article about React #dev #learning",
        senderId: "test-user",
        tags: ["dev", "learning"],
        mediaUrl: null,
        mediaType: null,
      }
    ];

    // Initialize with test messages
    testMessages.forEach(msg => {
      const message: Message = {
        ...msg,
        id: this.currentId++,
        timestamp: new Date(),
        mediaUrl: null,
        mediaType: null
      };
      this.messages.set(message.id, message);
    });
  }

  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getMessagesByTag(tag: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.tags.includes(tag))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    // Check for recent duplicate messages (within 5 seconds)
    const recentMessages = Array.from(this.messages.values())
      .filter(msg => 
        msg.content === insertMessage.content &&
        msg.senderId === insertMessage.senderId &&
        (new Date().getTime() - new Date(msg.timestamp).getTime()) < 5000
      );

    if (recentMessages.length > 0) {
      return recentMessages[0]; // Return the existing message instead of creating a duplicate
    }

    const id = this.currentId++;
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      mediaUrl: insertMessage.mediaUrl || null,
      mediaType: insertMessage.mediaType || null
    };
    this.messages.set(id, message);
    return message;
  }

  async getTags(): Promise<string[]> {
    const tags = new Set<string>();
    for (const message of this.messages.values()) {
      message.tags.forEach(tag => tags.add(tag));
    }
    return Array.from(tags).sort();
  }
}

export const storage = new MemStorage();