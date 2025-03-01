import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { WebSocketManager } from "./websocket";
import { log } from "./vite";

const clicksendWebhookSchema = z.object({
  message: z.string(),
  from: z.string(),
  media_url: z.string().optional().nullable(),
  media_type: z.string().optional().nullable(),
});

const processSMSWebhook = async (body: unknown) => {
  log("Raw webhook payload:", JSON.stringify(body, null, 2));

  const validatedData = clicksendWebhookSchema.parse(body);
  const { message: content, from: senderId, media_url: mediaUrl, media_type: mediaType } = validatedData;

  // Extract hashtags from the message content
  const tags = (content.match(/#\w+/g) || []).map((tag: string) => tag.slice(1));

  // If no tags were found, use "untagged" as default
  if (tags.length === 0) {
    tags.push("untagged");
  }

  // Remove any duplicate tags
  const uniqueTags = [...new Set(tags)];

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

  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.get("/api/messages/tag/:tag", async (req, res) => {
    const tag = req.params.tag;
    const messages = await storage.getMessagesByTag(tag);
    res.json(messages);
  });

  app.get("/api/tags", async (_req, res) => {
    const tags = await storage.getTags();
    res.json(tags);
  });

  // ClickSend webhook endpoint
  app.post("/api/webhook/sms", async (req, res) => {
    try {
      log("Received webhook request:", {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });

      const smsData = await processSMSWebhook(req.body);
      const message = insertMessageSchema.parse(smsData);
      const created = await storage.createMessage(message);

      log("Successfully created message:", JSON.stringify(created, null, 2));

      // Add logging for WebSocket broadcast
      log("Broadcasting new message to WebSocket clients");
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
        receivedPayload: req.body 
      });
    }
  });

  return httpServer;
}