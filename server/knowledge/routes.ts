import type { Express, RequestHandler } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { knowledgeItems, knowledgeSettings } from "@shared/schema";
import type { KnowledgePreferences, KnowledgeState } from "@shared/knowledge";
import { fingerprint, LIMITS } from "./core";
import { providerAvailable } from "./provider";
import { accessibleMessage, backfillCandidates, enqueue, KnowledgeError, settings } from "./repository";
import { searchKnowledge } from "./search";
import { startKnowledgeWorker } from "./ingestion";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
const searchInput = z.object({
  q: z.string().trim().min(1).max(800),
  boardId: z.coerce.number().int().positive().optional(),
  from: date.optional(), to: date.optional(),
  tz: z.string().max(80).refine(v => {
    try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
  }).optional(),
}).refine(v => !v.from || !v.to || v.from <= v.to);
const preferences = z.object({ enabled: z.boolean(), photoEnabled: z.boolean() }).strict();
const boundedBatch = z.object({ dryRun: z.boolean(), confirm: z.boolean().optional(), limit: z.number().int().min(1).max(LIMITS.backfillBatch).default(20) }).strict();
const disclosure = "Aside sends extracted page text and saved notes to OpenAI for indexing and answers. Photos are sent only when you enable photo analysis. Turning analysis off stops new AI processing and answers, but does not delete existing extracts. Private, paywalled and blocked pages may not be readable. Daily limits reset at midnight UTC.";
export function registerKnowledgeRoutes(app: Express, requireAuth: RequestHandler) {
  const wrap = (handler: (req: any, res: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      if (res.headersSent || res.destroyed) return;
      if (error instanceof z.ZodError) { res.status(400).json({ error: "Invalid request parameters." }); return; }
      if (error instanceof KnowledgeError) { res.status(error.status).json({ error: error.message }); return; }
      console.warn("[Knowledge] Request failed; details omitted to protect saved content.");
      res.status(503).json({ error: "Knowledge processing is unavailable. Check the database schema or try again later." });
    }
  };
  const rate = rateLimit({ windowMs: 60_000, limit: 10, keyGenerator: req => String((req as any).userId),
    standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests. Please wait a minute." } });
  app.get("/api/knowledge/settings", requireAuth, wrap(async (req, res) => {
    const prefs = await settings(req.userId);
    const result: KnowledgePreferences = { enabled: prefs.enabled, photoEnabled: prefs.photoEnabled,
      available: providerAvailable(), disclosure, limits: LIMITS };
    res.set("Cache-Control", "no-store").json(result);
  }));
  app.put("/api/knowledge/settings", requireAuth, rate, wrap(async (req, res) => {
    const data = preferences.parse(req.body);
    await db.insert(knowledgeSettings).values({ userId: req.userId, ...data })
      .onConflictDoUpdate({ target: knowledgeSettings.userId, set: { ...data, updatedAt: new Date() } });
    res.set("Cache-Control", "no-store").json({ ...data, available: providerAvailable(), disclosure, limits: LIMITS });
  }));
  app.get("/api/knowledge/scopes", requireAuth, wrap(async (req, res) => {
    const result = await db.execute(sql`SELECT b.id,b.name FROM shared_boards b
      JOIN board_memberships bm ON bm.board_id=b.id WHERE bm.user_id=${req.userId} ORDER BY b.name`);
    res.set("Cache-Control", "no-store").json({ boards: result.rows.map(b => ({
      id: b.id, name: b.name, ambiguous: result.rows.filter(other => other.name === b.name).length > 1,
    })) });
  }));
  app.get("/api/knowledge/items/:id", requireAuth, wrap(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const m = await accessibleMessage(req.userId, id);
    const [item] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, id));
    const current = item && item.fingerprint === fingerprint(m);
    // Re-authorize after the second database operation.
    const latest = await accessibleMessage(req.userId, id);
    if (fingerprint(latest) !== fingerprint(m)) throw new KnowledgeError(409, "Save changed. Reload its sources.");
    res.set("Cache-Control", "no-store").json({
      messageId: id, status: current ? item.status as KnowledgeState : "not_indexed",
      sources: current ? item.sources : [], errorCode: current ? item.errorCode : null, canRetry: m.userId === req.userId,
    });
  }));
  app.post("/api/knowledge/items/:id/retry", requireAuth, rate, wrap(async (req, res) => {
    const id = z.coerce.number().int().positive().parse(req.params.id);
    const m = await accessibleMessage(req.userId, id);
    if (m.userId !== req.userId) throw new KnowledgeError(403, "Only the save's owner can retry analysis.");
    if (!(await settings(req.userId)).enabled) throw new KnowledgeError(409, "Enable analysis before retrying.");
    res.json({ queued: await enqueue(id, true) });
  }));
  app.post("/api/knowledge/backfill", requireAuth, rate, wrap(async (req, res) => {
    const input = boundedBatch.parse(req.body);
    const ids = await backfillCandidates(req.userId, input.limit);
    if (input.dryRun) {
      res.json({ count: ids.length, limit: input.limit, estimatedPassagesUpperBound: ids.length * LIMITS.passagesPerSave }); return;
    }
    if (!input.confirm) throw new KnowledgeError(400, "Confirm provider charges before processing a batch.");
    if (!(await settings(req.userId)).enabled) throw new KnowledgeError(409, "Enable analysis first.");
    let queued = 0;
    for (const id of ids) if (await enqueue(id, true)) queued++;
    res.json({ queued });
  }));
  const search = wrap(async (req, res) => {
    const input = searchInput.parse(req.query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", abort);
    try {
      const result = await searchKnowledge(req.userId, input.q, {
        boardId: input.boardId, from: input.from, to: input.to, timeZone: input.tz, signal: controller.signal,
        generateAnswer: req.path === "/api/ai-search",
      });
      res.set("Cache-Control", "no-store").json(req.path === "/api/ai-search" ? result : result.messages);
    } finally { clearTimeout(timer); res.off("close", abort); }
  });
  app.get("/api/ai-search", requireAuth, rate, search);
  app.get("/api/messages/hybrid-search", requireAuth, rate, search);
  startKnowledgeWorker();
}
