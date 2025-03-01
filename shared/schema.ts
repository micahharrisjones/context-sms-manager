import { pgTable, text, serial, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: varchar("sender_id", { length: 20 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  tags: text("tags").array().notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 20 }),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
