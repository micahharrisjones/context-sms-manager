import { pgTable, text, serial, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table - each phone number is a unique user
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// Auth sessions for SMS verification codes
export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  verificationCode: varchar("verification_code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: text("verified").default("false").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: varchar("sender_id", { length: 20 }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  tags: text("tags").array().notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 20 }),
});

// Shared boards table
export const sharedBoards = pgTable("shared_boards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(), // The hashtag name (e.g., "recipes")
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Board memberships - who has access to which shared boards
export const boardMemberships = pgTable("board_memberships", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").references(() => sharedBoards.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(), // "owner" or "member"
  invitedBy: integer("invited_by").references(() => users.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  messages: many(messages),
  createdBoards: many(sharedBoards),
  boardMemberships: many(boardMemberships),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));

export const sharedBoardsRelations = relations(sharedBoards, ({ one, many }) => ({
  creator: one(users, {
    fields: [sharedBoards.createdBy],
    references: [users.id],
  }),
  memberships: many(boardMemberships),
}));

export const boardMembershipsRelations = relations(boardMemberships, ({ one }) => ({
  board: one(sharedBoards, {
    fields: [boardMemberships.boardId],
    references: [sharedBoards.id],
  }),
  user: one(users, {
    fields: [boardMemberships.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [boardMemberships.invitedBy],
    references: [users.id],
  }),
}));

// Schema exports
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export const insertAuthSessionSchema = createInsertSchema(authSessions).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertSharedBoardSchema = createInsertSchema(sharedBoards).omit({
  id: true,
  createdAt: true,
});

export const insertBoardMembershipSchema = createInsertSchema(boardMemberships).omit({
  id: true,
  joinedAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AuthSession = typeof authSessions.$inferSelect;
export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type SharedBoard = typeof sharedBoards.$inferSelect;
export type InsertSharedBoard = z.infer<typeof insertSharedBoardSchema>;
export type BoardMembership = typeof boardMemberships.$inferSelect;
export type InsertBoardMembership = z.infer<typeof insertBoardMembershipSchema>;
