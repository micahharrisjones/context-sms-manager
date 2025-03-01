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
    const id = this.currentId++;
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);
    return message;
  }

  async getTags(): Promise<string[]> {
    const tags = new Set<string>();
    for (const message of this.messages.values()) {
      message.tags.forEach(tag => tags.add(tag));
    }
    return Array.from(tags);
  }
}

export const storage = new MemStorage();
