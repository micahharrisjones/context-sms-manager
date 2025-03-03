import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { WebSocketManager } from "./websocket";
import { log } from "./vite";
import { pool } from "./db";

// Middleware to check database connection
async function checkDatabaseConnection(req: any, res: any, next: any) {
  try {
    const client = await pool.connect();
    client.release();
    next();
  } catch (error) {
    log("Database connection check failed:", error);
    res.status(503).json({ 
      error: "Database connection unavailable",
      message: "Please try again in a few moments"
    });
  }
}

// Request logging middleware
function logRequest(req: any, res: any, next: any) {
  log(`${req.method} ${req.url}`, {
    headers: req.headers,
    body: req.body,
    query: req.query,
  });
  next();
}

const clicksendWebhookSchema = z.object({
  message: z.string(),
  from: z.string(),
  media_url: z.string().optional().nullable(),
  media_type: z.string().optional().nullable(),
  originalmessage: z.string().optional(),
});

const processSMSWebhook = async (body: unknown) => {
  log("Raw webhook payload:", JSON.stringify(body, null, 2));

  const validatedData = clicksendWebhookSchema.parse(body);

  // Skip processing if this is a "Message saved with tags" notification
  if (validatedData.originalmessage?.includes("Message saved with tags")) {
    log("Skipping tag confirmation message");
    return null;
  }

  const { message: content, from: senderId, media_url: mediaUrl, media_type: mediaType } = validatedData;

  // Extract hashtags from the message content
  const tags = (content.match(/#\w+/g) || []).map((tag: string) => tag.slice(1));

  // If no tags were found, use "untagged" as default
  if (tags.length === 0) {
    tags.push("untagged");
  }

  // Remove any duplicate tags
  const uniqueTags = Array.from(new Set(tags));

  const processedData = {
    content,
    senderId,
    tags: uniqueTags,
    mediaUrl: mediaUrl || null,
    mediaType: mediaType || null,
  };

  log("Processed webhook data:", JSON.stringify(processedData, null, 2));
  return processedData;
};

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);
  const wsManager = new WebSocketManager(httpServer);

  // Add request logging middleware
  app.use(logRequest);

  // Add database connection check middleware to all API routes
  app.use("/api", checkDatabaseConnection);

  app.get("/api/messages", async (_req, res) => {
    try {
      const messages = await storage.getMessages();
      log("Retrieved messages:", messages.length);
      res.json(messages);
    } catch (error) {
      log("Error retrieving messages:", error);
      res.status(500).json({ error: "Failed to retrieve messages" });
    }
  });

  app.get("/api/messages/tag/:tag", async (req, res) => {
    try {
      const tag = req.params.tag;
      const messages = await storage.getMessagesByTag(tag);
      log(`Retrieved messages for tag ${tag}:`, messages.length);
      res.json(messages);
    } catch (error) {
      log(`Error retrieving messages for tag ${req.params.tag}:`, error);
      res.status(500).json({ error: "Failed to retrieve messages by tag" });
    }
  });

  app.get("/api/tags", async (_req, res) => {
    try {
      const tags = await storage.getTags();
      log("Retrieved tags:", tags);
      res.json(tags);
    } catch (error) {
      log("Error retrieving tags:", error);
      res.status(500).json({ error: "Failed to retrieve tags" });
    }
  });

  // ClickSend webhook endpoint - handle both /api/webhook/sms and /webhook/sms
  const handleWebhook = async (req: any, res: any) => {
    try {
      log("Received webhook request:", {
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        query: req.query,
      });

      const smsData = await processSMSWebhook(req.body);

      // If smsData is null, this was a tag confirmation message we want to skip
      if (!smsData) {
        return res.json({ status: "skipped" });
      }

      const message = insertMessageSchema.parse(smsData);
      const created = await storage.createMessage(message);

      log("Successfully created message:", JSON.stringify(created, null, 2));

      // Add logging for WebSocket broadcast
      log("Broadcasting new message to WebSocket clients:", JSON.stringify(created, null, 2));
      wsManager.broadcastNewMessage();
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
  };

  // Register webhook handler for both paths
  app.post("/api/webhook/sms", handleWebhook);
  app.post("/webhook/sms", handleWebhook); // Add alternate path without /api prefix

  return httpServer;
}