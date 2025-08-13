import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { WebSocketManager } from "./websocket";
import { log } from "./vite";
import { pool } from "./db";
import { AuthService, generateTwilioResponse, requireAuth } from "./auth";

// Middleware to check database connection
async function checkDatabaseConnection(req: any, res: any, next: any) {
  try {
    const client = await pool.connect();
    client.release();
    next();
  } catch (error) {
    log("Database connection check failed:", error instanceof Error ? error.message : String(error));
    res.status(503).json({ 
      error: "Database connection unavailable",
      message: "Please try again in a few moments"
    });
  }
}

// Helper function to extract hashtags from content
function extractHashtags(content: string): string[] {
  const tags = (content.match(/#\w+/g) || []).map((tag: string) => tag.slice(1));
  return Array.from(new Set(tags)); // Remove duplicates
}

const twilioWebhookSchema = z.object({
  Body: z.string(),
  From: z.string(),
  To: z.string(),
  MessageSid: z.string(),
  AccountSid: z.string(),
  NumMedia: z.string().optional().default("0"),
  MediaUrl0: z.string().optional().nullable(),
  MediaContentType0: z.string().optional().nullable(),
  // Handle multi-part SMS messages
  NumSegments: z.string().optional(),
  MessageStatus: z.string().optional(),
  SmsStatus: z.string().optional(),
});

// Helper function to get recent tags from the same sender for a specific user
async function getRecentTagsFromSender(userId: number, senderId: string): Promise<string[]> {
  try {
    // Get messages from the last 5 minutes from the same sender for this user
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentMessages = await storage.getRecentMessagesBySender(userId, senderId, fiveMinutesAgo);
    
    // Find the most recent message with hashtags (excluding "untagged")
    for (const message of recentMessages) {
      const nonUntaggedTags = message.tags.filter(tag => tag !== "untagged");
      if (nonUntaggedTags.length > 0) {
        return nonUntaggedTags;
      }
    }
    return [];
  } catch (error) {
    log("Error getting recent tags:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

// Post-processing function to fix untagged URL messages
async function fixUntaggedUrlMessage(messageId: number, userId: number, senderId: string, wsManager: WebSocketManager): Promise<void> {
  try {
    // Wait a bit for any concurrent messages to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const recentTags = await getRecentTagsFromSender(userId, senderId);
    if (recentTags.length > 0) {
      await storage.updateMessageTags(messageId, recentTags);
      log(`Updated message ${messageId} with inherited tags: [${recentTags.join(', ')}]`);
      
      // Broadcast WebSocket update for the corrected message
      wsManager.broadcastNewMessage();
    }
  } catch (error) {
    log("Error in post-processing:", error instanceof Error ? error.message : String(error));
  }
}

// Support both ClickSend and Twilio webhook formats
const clicksendWebhookSchema = z.object({
  message: z.preprocess(val => typeof val === "undefined" ? "" : val, z.string().optional().default("")),
  from: z.preprocess(val => typeof val === "undefined" ? "" : val, z.string().optional().default("")),
  sms: z.string().optional(),
  originalsenderid: z.string(),
  to: z.string(),
  body: z.string(),
  media_url: z.string().optional().nullable(),
  media_type: z.string().optional().nullable(),
  originalmessage: z.string().optional(),
  custom_string: z.string().optional(),
}).refine((data) => data.from !== "" || data.originalsenderid, {
  message: "Either 'from' or 'originalsenderid' must be provided",
  path: ["from"],
});

const processSMSWebhook = async (body: unknown) => {
  log("Raw webhook payload:", JSON.stringify(body, null, 2));

  // Try Twilio format first
  const twilioResult = twilioWebhookSchema.safeParse(body);
  if (twilioResult.success) {
    log("Processing as Twilio webhook");
    const validatedData = twilioResult.data;

    // Log multi-part message info
    if (validatedData.NumSegments) {
      log(`Multi-part message detected: ${validatedData.NumSegments} segments`);
    }

    // Verify this is from our Twilio account
    if (validatedData.AccountSid !== process.env.TWILIO_ACCOUNT_SID) {
      throw new Error("Invalid account SID");
    }

    const content = validatedData.Body;
    const senderId = validatedData.From;
    const recipientNumber = validatedData.To; // The Context phone number that received the message
    
    log(`Message from ${senderId} to Context number ${recipientNumber}`);
    
    // IMPORTANT: For SMS messages sent TO the Context phone number,
    // we need to find which user account this message belongs to.
    // Since we currently have one Twilio number shared across users,
    // we'll associate messages with the user who sent them (their authenticated account)
    
    // Find the user account based on the sender's phone number
    let user = await storage.getUserByPhoneNumber(senderId);
    if (!user) {
      // If this sender doesn't have an account yet, create one
      // This allows people to start using Context without explicit signup
      user = await storage.createUser({
        phoneNumber: senderId,
        displayName: `User ${senderId.slice(-4)}`
      });
      log(`Created new user account for phone ${senderId}`);
    } else {
      log(`Found existing user account for phone ${senderId}: User ${user.id}`);
    }

    // Extract hashtags from the message content
    let tags = extractHashtags(content);

    // If no tags were found, try to inherit from recent message from same sender
    if (tags.length === 0) {
      const recentTags = await getRecentTagsFromSender(user.id, senderId);
      if (recentTags.length > 0) {
        tags = recentTags;
        log(`Inherited tags [${tags.join(', ')}] from recent message by ${senderId}`);
      } else {
        tags.push("untagged");
      }
    }

    // Remove any duplicate tags
    const uniqueTags = Array.from(new Set(tags));

    // Handle media if present
    const numMedia = parseInt(validatedData.NumMedia || "0");
    const mediaUrl = numMedia > 0 ? validatedData.MediaUrl0 : null;
    const mediaType = numMedia > 0 ? validatedData.MediaContentType0 : null;

    const processedData = {
      content,
      senderId,
      userId: user.id,
      tags: uniqueTags,
      mediaUrl,
      mediaType,
    };

    log("Processed Twilio webhook data:", JSON.stringify(processedData, null, 2));
    return processedData;
  }

  // Try ClickSend format as fallback
  log("Trying ClickSend webhook format");
  const clicksendResult = clicksendWebhookSchema.safeParse(body);
  if (!clicksendResult.success) {
    log("Failed to parse as both Twilio and ClickSend format");
    throw new Error("Invalid webhook format: " + JSON.stringify(clicksendResult.error.issues));
  }
  const validatedData = clicksendResult.data;

  // Skip processing if this is a "Message saved with tags" notification
  if (validatedData.originalmessage?.includes("Message saved with tags")) {
    log("Skipping tag confirmation message");
    return null;
  }

  // Use originalsenderid if from is not provided
  const senderId = validatedData.from || validatedData.originalsenderid;
  // Use message if available, otherwise use body
  const content = validatedData.message || validatedData.body;

  log(`ClickSend message from ${senderId}`);

  // Get or create user based on phone number
  let user = await storage.getUserByPhoneNumber(senderId);
  if (!user) {
    user = await storage.createUser({
      phoneNumber: senderId,
      displayName: `User ${senderId.slice(-4)}`
    });
    log(`Created new user account for phone ${senderId}`);
  } else {
    log(`Found existing user account for phone ${senderId}: User ${user.id}`);
  }

  // Extract hashtags from the message content
  let tags = extractHashtags(content);

  // If no tags were found, try to inherit from recent message from same sender
  if (tags.length === 0) {
    const recentTags = await getRecentTagsFromSender(user.id, senderId);
    if (recentTags.length > 0) {
      tags = recentTags;
      log(`Inherited tags [${tags.join(', ')}] from recent message by ${senderId}`);
    } else {
      tags.push("untagged");
    }
  }

  // Remove any duplicate tags
  const uniqueTags = Array.from(new Set(tags));

  const processedData = {
    content,
    senderId,
    userId: user.id,
    tags: uniqueTags,
    mediaUrl: validatedData.media_url || null,
    mediaType: validatedData.media_type || null,
  };

  log("Processed ClickSend webhook data:", JSON.stringify(processedData, null, 2));
  return processedData;
};

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  const wsManager = new WebSocketManager(httpServer);

  // Add request logging middleware
  app.use(logRequest);

  // Add database connection check middleware to all API routes
  app.use("/api", checkDatabaseConnection);

  // Authentication routes
  app.post("/api/auth/request-code", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      const verificationCode = await AuthService.initializeVerification(phoneNumber);
      
      // In a real app, this would be sent via SMS
      // For now, return it in the response for testing
      res.json({ 
        message: "Verification code sent",
        code: verificationCode // Remove this in production
      });
    } catch (error) {
      log("Error requesting verification code:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { phoneNumber, code } = req.body;
      
      if (!phoneNumber || !code) {
        return res.status(400).json({ error: "Phone number and code are required" });
      }
      
      const result = await AuthService.verifyAndAuthenticate(phoneNumber, code);
      
      if (result.success && result.user) {
        // Set session
        req.session.userId = result.user.id;
        res.json({ 
          success: true, 
          user: result.user,
          message: result.message 
        });
      } else {
        res.status(401).json({ 
          success: false, 
          message: result.message 
        });
      }
    } catch (error) {
      log("Error verifying code:", error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", (req, res) => {
    if (req.session.userId) {
      res.json({ authenticated: true, userId: req.session.userId });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Protected message routes (require authentication)
  app.get("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const messages = await storage.getMessages(userId);
      log(`Retrieved ${messages.length} messages for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error retrieving messages: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });

  app.get("/api/messages/tag/:tag", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const tag = req.params.tag;
      const messages = await storage.getMessagesByTag(userId, tag);
      log(`Retrieved ${messages.length} messages for tag ${tag} for user ${userId}`);
      res.json(messages);
    } catch (error) {
      log(`Error retrieving messages for tag ${req.params.tag}: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve messages by tag" });
    }
  });

  app.get("/api/tags", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const tags = await storage.getTags(userId);
      log(`Retrieved ${tags.length} tags for user ${userId}`);
      res.json(tags);
    } catch (error) {
      log(`Error retrieving tags: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to retrieve tags" });
    }
  });

  // POST endpoint for creating messages via UI
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Validate request body
      const { content, source = 'ui' } = req.body;
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: "Content is required" });
      }

      // Extract hashtags from content
      const tags = extractHashtags(content);
      
      // Create message data
      const messageData = {
        content: content.trim(),
        senderId: `user-${userId}`, // Use a special sender ID for UI messages
        userId,
        tags: tags.length > 0 ? tags : ["untagged"],
        source
      };

      // Validate with schema
      const message = insertMessageSchema.parse(messageData);
      
      // Create message in storage
      const created = await storage.createMessage(message);
      log(`Created UI message for user ${userId}:`, JSON.stringify(created, null, 2));

      // Broadcast to WebSocket clients for this user
      wsManager.broadcastNewMessageToUser(userId);
      
      // Also notify shared board members if message has relevant tags
      if (created.tags && created.tags.length > 0) {
        const sharedBoardUsers = await storage.getUsersForSharedBoardNotification(created.tags);
        if (sharedBoardUsers.length > 0) {
          log(`Notifying shared board users of UI message: [${sharedBoardUsers.join(', ')}]`);
          wsManager.broadcastNewMessageToUsers(sharedBoardUsers);
        }
      }

      res.status(201).json(created);
    } catch (error) {
      log(`Error creating UI message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // DELETE endpoint for removing messages
  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ error: "Invalid message ID" });
      }

      // Check if message exists and belongs to the user
      const existingMessage = await storage.getMessageById(messageId);
      if (!existingMessage) {
        return res.status(404).json({ error: "Message not found" });
      }

      if (existingMessage.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized to delete this message" });
      }

      // Delete the message
      await storage.deleteMessage(messageId);
      log(`Deleted message ${messageId} for user ${userId}`);

      // Broadcast to WebSocket clients for this user
      wsManager.broadcastNewMessageToUser(userId);

      res.json({ success: true, message: "Message deleted successfully" });
    } catch (error) {
      log(`Error deleting message: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // DELETE endpoint for removing all messages with a specific tag
  app.delete("/api/tags/:tag", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const tag = decodeURIComponent(req.params.tag);
      
      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ error: "Tag is required" });
      }

      // Get all messages with this tag to count them (including hashtag-only messages)
      const messagesToDelete = await storage.getAllMessagesByTagForDeletion(userId, tag);
      log(`Found ${messagesToDelete.length} messages with tag "${tag}" for user ${userId}`);
      
      if (messagesToDelete.length === 0) {
        return res.status(404).json({ error: "No messages found with this tag" });
      }

      // Delete all messages with this tag (including hashtag-only messages)
      await storage.deleteMessagesByTag(userId, tag);
      log(`Deleted ${messagesToDelete.length} messages with tag "${tag}" for user ${userId}`);

      // Broadcast to WebSocket clients for this user
      wsManager.broadcastNewMessageToUser(userId);

      res.json({ 
        success: true, 
        message: `Deleted ${messagesToDelete.length} messages with tag #${tag}`,
        deletedCount: messagesToDelete.length
      });
    } catch (error) {
      log(`Error deleting tag "${req.params.tag}": ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Shared boards endpoints
  // Get shared boards for the current user (boards they created + boards they're members of)
  app.get("/api/shared-boards", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      log(`Fetching shared boards for user ${userId}`);
      
      // Get boards created by user and boards user is a member of
      const [createdBoards, membershipBoards] = await Promise.all([
        storage.getSharedBoards(userId),
        storage.getUserBoardMemberships(userId)
      ]);
      
      // Combine and deduplicate
      const allBoardNames = new Set();
      const allBoards = [];
      
      for (const board of createdBoards) {
        if (!allBoardNames.has(board.name)) {
          allBoardNames.add(board.name);
          allBoards.push({ ...board, role: "owner" });
        }
      }
      
      for (const membership of membershipBoards) {
        if (!allBoardNames.has(membership.board.name)) {
          allBoardNames.add(membership.board.name);
          allBoards.push({ ...membership.board, role: membership.role });
        }
      }
      
      log(`Found ${allBoards.length} shared boards for user ${userId}`);
      res.json(allBoards);
    } catch (error) {
      log(`Error fetching shared boards: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch shared boards" });
    }
  });

  // Get messages for a shared board
  app.get("/api/shared-boards/:boardName/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      
      log(`Fetching shared messages for board ${boardName}, user ${userId}`);
      const messages = await storage.getSharedMessages(userId, boardName);
      
      log(`Successfully retrieved ${messages.length} messages for shared board ${boardName}`);
      res.json(messages);
    } catch (error) {
      log(`Error fetching shared messages: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to fetch shared messages" });
    }
  });

  // Create a new shared board
  app.post("/api/shared-boards", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Board name is required" });
      }
      
      const boardName = name.trim().toLowerCase();
      
      // Check if board already exists
      const existingBoard = await storage.getSharedBoardByName(boardName);
      if (existingBoard) {
        return res.status(400).json({ error: "A shared board with this name already exists" });
      }
      
      // Create the board
      const board = await storage.createSharedBoard({
        name: boardName,
        createdBy: userId
      });
      
      log(`Created shared board ${board.id} (${boardName}) by user ${userId}`);
      res.status(201).json(board);
    } catch (error) {
      log(`Error creating shared board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to create shared board" });
    }
  });

  // Invite user to shared board (by phone number)
  app.post("/api/shared-boards/:boardName/invite", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      const { phoneNumber } = req.body;
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return res.status(400).json({ error: "Phone number is required" });
      }
      
      // Check if board exists
      const board = await storage.getSharedBoardByName(boardName);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user has permission to invite (must be owner or member)
      const userMemberships = await storage.getUserBoardMemberships(userId);
      const userMembership = userMemberships.find(m => m.board.id === board.id);
      const isCreator = board.createdBy === userId;
      
      if (!isCreator && !userMembership) {
        return res.status(403).json({ error: "You don't have permission to invite users to this board" });
      }
      
      // Find user by phone number
      const invitedUser = await storage.getUserByPhoneNumber(phoneNumber);
      if (!invitedUser) {
        return res.status(404).json({ error: "User with this phone number not found. They need to create an account first." });
      }
      
      // Check if user is already a member
      const existingMemberships = await storage.getUserBoardMemberships(invitedUser.id);
      const alreadyMember = existingMemberships.some(m => m.board.id === board.id);
      
      if (alreadyMember) {
        return res.status(400).json({ error: "User is already a member of this board" });
      }
      
      // Add user to board
      const membership = await storage.addBoardMember({
        boardId: board.id,
        userId: invitedUser.id,
        role: "member",
        invitedBy: userId
      });
      
      log(`Added user ${invitedUser.id} to board ${board.id} (${boardName})`);
      res.status(201).json({
        success: true,
        message: `Successfully invited ${phoneNumber} to board #${boardName}`,
        membership
      });
    } catch (error) {
      log(`Error inviting user to board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to invite user to board" });
    }
  });

  // Remove user from shared board
  app.delete("/api/shared-boards/:boardName/members/:phoneNumber", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const boardName = decodeURIComponent(req.params.boardName);
      const phoneNumber = decodeURIComponent(req.params.phoneNumber);
      
      // Check if board exists
      const board = await storage.getSharedBoardByName(boardName);
      if (!board) {
        return res.status(404).json({ error: "Shared board not found" });
      }
      
      // Check if current user has permission (must be owner)
      if (board.createdBy !== userId) {
        return res.status(403).json({ error: "Only the board owner can remove members" });
      }
      
      // Find user to remove
      const userToRemove = await storage.getUserByPhoneNumber(phoneNumber);
      if (!userToRemove) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Remove user from board
      await storage.removeBoardMember(board.id, userToRemove.id);
      
      log(`Removed user ${userToRemove.id} from board ${board.id} (${boardName})`);
      res.json({
        success: true,
        message: `Successfully removed ${phoneNumber} from board #${boardName}`
      });
    } catch (error) {
      log(`Error removing user from board: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: "Failed to remove user from board" });
    }
  });

  // Twilio webhook endpoint - handle both /api/webhook/sms and /webhook/sms
  const handleWebhook = async (req: any, res: any) => {
    log("Entering handleWebhook function");
    try {
      log("Received webhook request:", JSON.stringify({
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        query: req.query,
      }, null, 2));

      const smsData = await processSMSWebhook(req.body);
      log("processSMSWebhook completed");

      // If smsData is null, this was a tag confirmation message we want to skip
      if (!smsData) {
        log("Skipping message due to null smsData");
        return res.json({ status: "skipped" });
      }

      log("Parsing smsData with insertMessageSchema");
      const message = insertMessageSchema.parse(smsData);
      log("insertMessageSchema parsing complete");

      log("Creating message in storage");
      const created = await storage.createMessage(message);
      log("Message creation complete");

      log("Successfully created message:", JSON.stringify(created, null, 2));

      // If this message was untagged and contains a URL, schedule post-processing to check for recent hashtags
      const hasUrl = /https?:\/\/[^\s]+/.test(created.content);
      if (created.tags.includes("untagged") && hasUrl) {
        log("Scheduling post-processing for potentially untagged URL message");
        // Don't await this - let it run in the background
        fixUntaggedUrlMessage(created.id, created.userId, created.senderId, wsManager);
      }

      // Add logging for WebSocket broadcast
      log("Broadcasting new message to WebSocket clients:", JSON.stringify(created, null, 2));
      log("Before broadcastNewMessage");
      
      // Notify the original user
      wsManager.broadcastNewMessageToUser(created.userId);
      
      // Also notify all users who have shared boards matching this message's tags
      if (created.tags && created.tags.length > 0) {
        const sharedBoardUsers = await storage.getUsersForSharedBoardNotification(created.tags);
        if (sharedBoardUsers.length > 0) {
          log(`Notifying shared board users: [${sharedBoardUsers.join(', ')}]`);
          wsManager.broadcastNewMessageToUsers(sharedBoardUsers);
        }
      }
      
      log("After broadcastNewMessage");
      log("Broadcast complete");

      res.json(created);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      log("SMS webhook error:", errorMessage);

      // Send a more detailed error response
      res.status(400).json({
        error: "Failed to process SMS",
        details: errorMessage,
        receivedPayload: req.body,
      });
    }
    log("Exiting handleWebhook function");
  };

  // Register Twilio webhook handler for both paths
  app.post("/api/webhook/sms", handleWebhook);
  app.post("/webhook/sms", handleWebhook); // Add alternate path without /api prefix
  app.post("/api/webhook/twilio", handleWebhook); // Twilio-specific endpoint
  app.post("/webhook/twilio", handleWebhook); // Twilio-specific endpoint without /api prefix

  return httpServer;
}

// Request logging middleware
function logRequest(req: any, res: any, next: any) {
  log("Request received:", JSON.stringify({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    query: req.query,
  }, null, 2));
  next();
}