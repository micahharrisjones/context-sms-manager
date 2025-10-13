import { pgTable, text, serial, timestamp, varchar, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations, sql } from "drizzle-orm";

// Users table - each phone number is a unique user
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  displayName: varchar("display_name", { length: 100 }), // Keep for backward compatibility
  firstName: varchar("first_name", { length: 50 }),
  lastName: varchar("last_name", { length: 50 }),
  avatarUrl: text("avatar_url"), // For profile pictures
  onboardingStep: varchar("onboarding_step", { length: 20 }).default("welcome_sent"), // Track onboarding progress
  onboardingCompletedAt: timestamp("onboarding_completed_at"), // When they completed onboarding
  referredBy: varchar("referred_by", { length: 10 }), // Invite code that referred this user
  signupMethod: varchar("signup_method", { length: 20 }).default("direct"), // "invite_link" | "direct" | "squarespace"
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

// Magic link tokens for secure auto-login (replaces insecure phone-based auto-login)
export const magicLinkTokens = pgTable("magic_link_tokens", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  userId: integer("user_id").references(() => users.id).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: text("used").default("false").notNull(), // "true" or "false"
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
  messageSid: text("message_sid"), // Twilio MessageSid for deduplication
}, (table) => ({
  // Unique constraint on messageSid to prevent duplicate webhook processing
  // Using plain unique index (allows multiple NULLs by default in PostgreSQL)
  messageSidUnique: uniqueIndex("messages_message_sid_unique").on(table.messageSid),
}));

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
  notificationPreferences: many(notificationPreferences),
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
  notificationPreferences: many(notificationPreferences),
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

// Notification preferences - controls SMS notifications for shared boards
export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  boardId: integer("board_id").references(() => sharedBoards.id).notNull(),
  smsEnabled: text("sms_enabled").default("true").notNull(), // "true" or "false" 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure one preference record per user per board
  userBoardUnique: uniqueIndex("notification_prefs_user_board_idx").on(table.userId, table.boardId),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
  board: one(sharedBoards, {
    fields: [notificationPreferences.boardId],
    references: [sharedBoards.id],
  }),
}));

// Onboarding messages table - configurable SMS messages for onboarding flow
export const onboardingMessages = pgTable("onboarding_messages", {
  id: serial("id").primaryKey(),
  step: varchar("step", { length: 20 }).notNull().unique(), // welcome, first_text, first_hashtag, first_link, completion
  title: varchar("title", { length: 100 }).notNull(), // Display title for admin UI
  content: text("content").notNull(), // The actual SMS message content
  isActive: varchar("is_active", { length: 5 }).default("true").notNull(), // "true" or "false"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invites table - tracks invite codes and conversions
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 10 }).notNull().unique(), // 5-character invite code
  invitedBy: integer("invited_by").references(() => users.id).notNull(), // User who created the invite
  type: varchar("type", { length: 20 }).default("sms_link").notNull(), // "sms_link" | "web" | "qr"
  conversions: integer("conversions").default(0).notNull(), // Number of signups via this code
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invitesRelations = relations(invites, ({ one }) => ({
  inviter: one(users, {
    fields: [invites.invitedBy],
    references: [users.id],
  }),
}));

// Schema exports
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

// Profile update schema - allows updating profile fields
export const updateProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  avatarUrl: true,
}).extend({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  avatarUrl: z.string().url().optional(),
});

export const insertAuthSessionSchema = createInsertSchema(authSessions).omit({
  id: true,
  createdAt: true,
});

export const insertMagicLinkTokenSchema = createInsertSchema(magicLinkTokens).omit({
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

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateNotificationPreferenceSchema = createInsertSchema(notificationPreferences).pick({
  smsEnabled: true,
}).extend({
  smsEnabled: z.enum(["true", "false"]),
});

export const insertOnboardingMessageSchema = createInsertSchema(onboardingMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateOnboardingMessageSchema = createInsertSchema(onboardingMessages).pick({
  title: true,
  content: true,
  isActive: true,
});

export const insertInviteSchema = createInsertSchema(invites).omit({
  id: true,
  conversions: true,
  createdAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type AuthSession = typeof authSessions.$inferSelect;
export type InsertAuthSession = z.infer<typeof insertAuthSessionSchema>;
export type MagicLinkToken = typeof magicLinkTokens.$inferSelect;
export type InsertMagicLinkToken = z.infer<typeof insertMagicLinkTokenSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect & {
  // Optional sender information for shared board display
  senderFirstName?: string | null;
  senderLastName?: string | null;
  senderAvatarUrl?: string | null;
  senderDisplayName?: string | null;
};
export type SharedBoard = typeof sharedBoards.$inferSelect;
export type InsertSharedBoard = z.infer<typeof insertSharedBoardSchema>;
export type BoardMembership = typeof boardMemberships.$inferSelect;
export type InsertBoardMembership = z.infer<typeof insertBoardMembershipSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type UpdateNotificationPreference = z.infer<typeof updateNotificationPreferenceSchema>;
export type OnboardingMessage = typeof onboardingMessages.$inferSelect;
export type InsertOnboardingMessage = z.infer<typeof insertOnboardingMessageSchema>;
export type UpdateOnboardingMessage = z.infer<typeof updateOnboardingMessageSchema>;
export type Invite = typeof invites.$inferSelect;
export type InsertInvite = z.infer<typeof insertInviteSchema>;
