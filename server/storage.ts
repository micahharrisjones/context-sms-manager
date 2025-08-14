import { 
  type Message, 
  type InsertMessage, 
  type User, 
  type InsertUser, 
  type AuthSession, 
  type InsertAuthSession,
  type SharedBoard,
  type InsertSharedBoard,
  type BoardMembership,
  type InsertBoardMembership,
  messages, 
  users, 
  authSessions,
  sharedBoards,
  boardMemberships
} from "@shared/schema";
import { db } from "./db";
import { desc, eq, sql, gte, and, inArray } from "drizzle-orm";
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
  getAllMessagesByTagForDeletion(userId: number, tag: string): Promise<Message[]>;
  getMessageById(messageId: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  deleteMessage(messageId: number): Promise<void>;
  deleteMessagesByTag(userId: number, tag: string): Promise<void>;
  getTags(userId: number): Promise<string[]>;
  getRecentMessagesBySender(userId: number, senderId: string, since: Date): Promise<Message[]>;
  updateMessageTags(messageId: number, tags: string[]): Promise<void>;
  updateMessage(messageId: number, content: string, tags: string[]): Promise<Message>;
  
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
      log(`Error fetching message by ID ${messageId}:`, error);
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

  async deleteMessage(messageId: number): Promise<void> {
    try {
      log(`Deleting message ${messageId}`);
      await db
        .delete(messages)
        .where(eq(messages.id, messageId));
      
      log(`Successfully deleted message ${messageId}`);
    } catch (error) {
      log(`Error deleting message ${messageId}:`, error);
      throw error;
    }
  }

  async deleteMessagesByTag(userId: number, tag: string): Promise<void> {
    try {
      log(`Deleting all messages with tag "${tag}" for user ${userId}`);
      await db
        .delete(messages)
        .where(and(
          eq(messages.userId, userId),
          sql`${messages.tags} @> ARRAY[${tag}]::text[]`
        ));
      
      log(`Successfully deleted all messages with tag "${tag}" for user ${userId}`);
    } catch (error) {
      log(`Error deleting messages with tag "${tag}":`, error);
      throw error;
    }
  }

  // Get all messages with a tag WITHOUT filtering hashtag-only messages (for tag deletion count)
  async getAllMessagesByTagForDeletion(userId: number, tag: string): Promise<Message[]> {
    try {
      log(`Fetching ALL messages (including hashtag-only) with tag: ${tag} for user ${userId}`);
      const result = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.userId, userId),
          sql`${messages.tags} @> ARRAY[${tag}]::text[]`
        ))
        .orderBy(desc(messages.timestamp));
      
      log(`Successfully retrieved ${result.length} total messages for tag ${tag} (including hashtag-only)`);
      return result;
    } catch (error) {
      log(`Error fetching all messages by tag ${tag}:`, error);
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
      log("Error updating message:", error);
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
      log("Error fetching shared boards:", error);
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
      log("Error creating shared board:", error);
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
      log("Error fetching shared board:", error);
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
      log("Error fetching shared board by name:", error);
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
      log("Error adding board member:", error);
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
          user: users,
        })
        .from(boardMemberships)
        .innerJoin(users, eq(boardMemberships.userId, users.id))
        .where(eq(boardMemberships.boardId, boardId));
      return result;
    } catch (error) {
      log("Error fetching board members:", error);
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
      log("Error fetching user board memberships:", error);
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
      log("Error removing board member:", error);
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
      log("Error deleting shared board:", error);
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

      // Get messages with the shared tag from all board members
      const result = await db
        .select()
        .from(messages)
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
      log("Error fetching shared messages:", error);
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

      // Get creator's phone number (if not excluded)
      if (!excludeUserId || boardInfo.createdBy !== excludeUserId) {
        const [creator] = await db
          .select({ phoneNumber: users.phoneNumber })
          .from(users)
          .where(eq(users.id, boardInfo.createdBy));
        
        if (creator) {
          phoneNumbers.push(creator.phoneNumber);
        }
      }

      // Get all board members' phone numbers (excluding the specified user)
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
          phoneNumbers.push(member.phoneNumber);
        }
      }

      log(`Found ${phoneNumbers.length} phone numbers for board ${boardName} notifications`);
      return phoneNumbers;
    } catch (error) {
      log(`Error getting board members phone numbers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();