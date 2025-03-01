import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express) {
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

  app.post("/api/messages", async (req, res) => {
    try {
      const message = insertMessageSchema.parse(req.body);
      const created = await storage.createMessage(message);
      res.json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
