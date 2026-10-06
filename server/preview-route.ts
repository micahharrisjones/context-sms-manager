import type { Express, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { resolvePublicPreviewUrl, UnsafePreviewUrlError } from "./safe-preview-fetch";
import { microlinkQueue } from "./request-queue";

interface PreviewService {
  shouldFetchOpenGraph(url: string): boolean;
  fetchOpenGraph(url: string): Promise<unknown>;
}

export function registerPreviewRoute(app: Express, requireAuth: RequestHandler, service: PreviewService) {
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => String(req.userId),
    message: { error: "Too many preview requests. Please try again shortly." },
  });
  app.get("/api/og-preview", requireAuth, limiter, async (req, res) => {
    const url = req.query.url;
    if (typeof url !== "string" || !url || url.length > 8192) {
      return res.status(400).json({ error: "A valid URL parameter is required" });
    }
    try {
      await resolvePublicPreviewUrl(url);
      if (!service.shouldFetchOpenGraph(url)) return res.json({ skip: true });
      const data = await microlinkQueue.add(() => service.fetchOpenGraph(url));
      if (!data) return res.json({ error: "Failed to fetch Open Graph data" });
      return res.json(data);
    } catch (error) {
      if (error instanceof UnsafePreviewUrlError) {
        return res.status(400).json({ error: "Only public HTTP(S) preview URLs are allowed" });
      }
      return res.status(502).json({ error: "Failed to fetch Open Graph data" });
    }
  });
}
