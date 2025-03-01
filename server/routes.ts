import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { WebSocketManager } from "./websocket";
import { log } from "./vite";

const processSMSWebhook = async (body: any) => {
  if (!body.message || !body.from) {
    throw new Error("Invalid SMS webhook payload");
  }

  const content = body.message;
  const senderId = body.from;

  // Extract hashtags from the message content
  const tags = (content.match(/#\w+/g) || []).map((tag: string) => tag.slice(1));

  // If no tags were found, use "untagged" as default
  if (tags.length === 0) {
    tags.push("untagged");
  }

  // Remove any duplicate tags
  const uniqueTags = [...new Set(tags)];

  return {
    content,
    senderId,
    tags: uniqueTags,
    mediaUrl: body.media_url || null,
    mediaType: body.media_type || null,
  };
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
      log("Received SMS webhook payload:", JSON.stringify(req.body, null, 2));
      const smsData = await processSMSWebhook(req.body);
      log("Processed SMS data:", JSON.stringify(smsData, null, 2));
      const message = insertMessageSchema.parse(smsData);
      const created = await storage.createMessage(message);
      log("Created message:", JSON.stringify(created, null, 2));
      wsManager.broadcastNewMessage();
      res.json(created);
    } catch (error) {
      log("SMS webhook error:", error);
      res.status(500).json({ error: "Failed to process SMS" });
    }
  });

  return httpServer;
}