import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { and, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";

const control = vi.hoisted(() => ({ embeddingFailure: false, answerFailure: false, mime: "image/jpeg", largeImage: false }));
vi.mock("../vite", () => ({ log: vi.fn() }));
vi.mock("../knowledge/provider", async original => {
  const actual = await original<typeof import("../knowledge/provider")>();
  return { ...actual, providerAvailable: () => true,
    embed: vi.fn(async (texts: string[]) => {
      if (control.embeddingFailure) throw new Error("provider unavailable");
      return texts.map(text => {
        const v = Array(1536).fill(0); v[/gin|agave|cocktail/i.test(text) ? 0 : 1] = 1; return v;
      });
    }),
    readPhoto: vi.fn(async () => ({ visibleText: "2 oz gin, 1 oz lime, 3/4 oz agave", observations: "Printed cocktail recipe.", uncertain: false })),
    answer: vi.fn(async (_q: string, evidence: any[]) => {
      if (control.answerFailure) throw new Error("provider unavailable");
      return actual.validateAnswer({ sufficient: true, claims: [{ text: "Your save contains a cocktail recipe.",
        citations: [{ id: evidence[0].id, quote: evidence[0].excerpt.slice(0, 40) }] }] }, evidence);
    }),
  };
});
vi.mock("../knowledge/ingestion", async original => ({
  ...await original<typeof import("../knowledge/ingestion")>(), startKnowledgeWorker: vi.fn(),
}));
vi.mock("../safe-preview-fetch", async original => {
  const actual = await original<typeof import("../safe-preview-fetch")>();
  return { ...actual, safePreviewFetch: vi.fn(async (url: string) => {
    if (url.includes("127.0.0.1")) return actual.safePreviewFetch(url);
    if (url.includes("/timeout")) throw new Error("timeout");
    if (url.includes("/pdf")) return new Response("pdf", { headers: { "content-type": "application/pdf" } });
    if (url.includes("/blocked")) return new Response("Access denied", { status: 403 });
    const para = "This cocktail recipe contains gin, freshly squeezed lime juice and agave syrup. Shake with ice and strain into a chilled glass. ";
    return new Response(`<html><head><title>Garden Gin Cocktail</title></head><body><article><h1>Garden Gin Cocktail</h1><p>${para.repeat(9)}</p></article></body></html>`,
      { headers: { "content-type": "text/html" } });
  }) };
});
vi.mock("@aws-sdk/client-s3", async original => {
  const actual = await original<typeof import("@aws-sdk/client-s3")>();
  return { ...actual, S3Client: class {
    async send() {
      const bytes = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).jpeg().toBuffer();
      return { ContentType: control.mime, ContentLength: control.largeImage ? 7 * 1024 * 1024 : bytes.length,
        Body: (async function* () { yield bytes; })() };
    }
    destroy() {}
  } };
});
vi.mock("../s3-service", () => ({ s3Service: { generateSignedUrlsForMessages: async (m: any[]) => m } }));

import { db, pool } from "../db";
import { users, messages, sharedBoards, boardMemberships, knowledgeItems, knowledgeChunks, knowledgeSettings, knowledgeUsage } from "@shared/schema";
import { storage } from "../storage";
import { claimJob as claimFixtureJob, enqueue, finishJob, takeBudget } from "../knowledge/repository";
import { fingerprint } from "../knowledge/core";
import { processOneJob as processFixtureJob } from "../knowledge/ingestion";
import { searchKnowledge } from "../knowledge/search";
import { registerKnowledgeRoutes } from "../knowledge/routes";
import { answer, embed, readPhoto } from "../knowledge/provider";

// Explicit opt-in: uses ONLY temporary development fixtures and mock providers.
// Stop the app worker while running this suite; never point it at production.
describe.skipIf(process.env.KNOWLEDGE_DB_TESTS !== "1")("knowledge database integration (synthetic fixtures)", () => {
  let owner = 0, viewer = 0, stranger = 0, boardId = 0;
  let fixtureIds: number[] = [];
  let boards: number[] = [];
  let actor = 0;
  let app: express.Express;
  beforeEach(async () => {
    control.embeddingFailure = false; control.answerFailure = false; control.mime = "image/jpeg"; control.largeImage = false;
    vi.clearAllMocks();
    const marker = randomUUID().slice(0, 8);
    const seeded = await db.insert(users).values(["o", "v", "x"].map(s => ({
      phoneNumber: `kb-test-${marker}-${s}`, firstName: "Fixture", lastName: "Only",
    }))).returning();
    fixtureIds = seeded.map(u => u.id); [owner, viewer, stranger] = fixtureIds; actor = owner;
    await db.insert(knowledgeSettings).values(fixtureIds.map(userId => ({ userId, enabled: true, photoEnabled: false })));
    const [board] = await db.insert(sharedBoards).values({ name: `kb-${marker}`, createdBy: owner }).returning();
    boardId = board.id; boards = [boardId];
    await db.insert(boardMemberships).values([{ boardId, userId: owner, role: "owner" }, { boardId, userId: viewer, role: "member" }]);
    app = express(); app.use(express.json());
    registerKnowledgeRoutes(app, (req, _res, next) => { (req as any).userId = actor; next(); });
  });
  afterEach(async () => {
    if (boards.length) { await db.delete(boardMemberships).where(inArray(boardMemberships.boardId, boards)); await db.delete(sharedBoards).where(inArray(sharedBoards.id, boards)); }
    if (fixtureIds.length) { await db.delete(messages).where(inArray(messages.userId, fixtureIds)); await db.delete(users).where(inArray(users.id, fixtureIds)); }
    boards = []; fixtureIds = [];
  });
  afterAll(async () => { await pool.end(); });
  async function save(content = "Gin and agave cocktail note", tags: string[] = []) {
    return storage.createMessage({ userId: owner, senderId: "fixture", content, tags, messageSid: `kb-${randomUUID()}` });
  }
  // Never claim jobs belonging to existing development users.
  async function fixtureMessageId() {
    const [m] = await db.select({ id: messages.id }).from(messages).where(eq(messages.userId, owner)).limit(1);
    if (!m) throw new Error("Missing temporary fixture");
    return m.id;
  }
  async function processOneJob() { return processFixtureJob(await fixtureMessageId()); }
  async function claimJob() { return claimFixtureJob(await fixtureMessageId()); }
  it("persists a save job once and indexes each link separately plus the note", async () => {
    const m = await save("My cocktail https://fixtures.example/a https://fixtures.example/b");
    expect(await enqueue(m.id)).toBe(false);
    expect(await processOneJob()).toBe(true);
    const [item] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, m.id));
    expect(item.status).toBe("ready"); expect(item.sources).toHaveLength(3);
    const chunks = await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.messageId, m.id));
    expect(new Set(chunks.map(c => c.sourceId)).size).toBe(3);
    expect(chunks.every(c => c.embedding?.length === 1536)).toBe(true);
    const result = await searchKnowledge(owner, "which cocktails contain gin?");
    expect(result.messages[0].id).toBe(m.id); expect(result.answerStatus).toBe("ready");
    expect(result.citations[0].messageId).toBe(m.id);
  });
  it("bounds source records as well as fetches when a save has too many links", async () => {
    const m = await save(Array.from({ length: 12 }, (_, i) => `https://fixtures.example/link${i}`).join(" "));
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    expect(detail.body.status).toBe("partial"); expect(detail.body.sources).toHaveLength(9);
    expect(detail.body.sources.at(-1).reason).toMatch(/4 links exceeded/);
  });
  it("deduplicates a replayed SMS webhook and invalidates media versions", async () => {
    const m = await save();
    const replay = await storage.createMessage({ userId: owner, senderId: "fixture", content: m.content, tags: [], messageSid: m.messageSid });
    expect(replay.id).toBe(m.id);
    await processOneJob();
    await storage.updateMessageMedia(m.id, "fixture/photo.jpg", "image", "image/jpeg");
    const [item] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, m.id));
    expect(item.status).toBe("queued"); expect(item.fingerprint).not.toBe(fingerprint(m));
  });
  it("preserves readable evidence but marks blocked, unsupported and failed sources", async () => {
    const m = await save("Gin note https://fixtures.example/blocked https://fixtures.example/pdf https://fixtures.example/timeout");
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    expect(detail.body.status).toBe("partial");
    expect(detail.body.sources.map((s: any) => s.status)).toEqual(["ready", "blocked", "unsupported", "failed"]);
  });
  it("rejects private destinations without acquiring any source text", async () => {
    const m = await save("http://127.0.0.1/private");
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    expect(detail.body.status).toBe("blocked"); expect(detail.body.sources[0].text).toBe("");
  });
  it("never sends a photo before opt-in; stores OCR separately after opt-in", async () => {
    const m = await save("Recipe");
    await storage.updateMessageMedia(m.id, "fixture/photo.jpg", "image", "image/jpeg");
    await processOneJob();
    expect(readPhoto).not.toHaveBeenCalled();
    await db.update(knowledgeSettings).set({ photoEnabled: true }).where(eq(knowledgeSettings.userId, owner));
    await enqueue(m.id, true); await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    const photo = detail.body.sources.find((s: any) => s.kind === "photo");
    expect(photo.text).toContain("2 oz gin"); expect(photo.observations).toBe("Printed cocktail recipe.");
    expect(readPhoto).toHaveBeenCalledTimes(1);
  });
  it.each(["application/pdf", "too-large"])("does not analyze invalid photo bytes (%s)", async bad => {
    await db.update(knowledgeSettings).set({ photoEnabled: true }).where(eq(knowledgeSettings.userId, owner));
    if (bad === "too-large") control.largeImage = true; else control.mime = bad;
    const m = await save("Recipe"); await storage.updateMessageMedia(m.id, "fixture/photo.jpg", "image");
    await processOneJob();
    expect(readPhoto).not.toHaveBeenCalled();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    expect(detail.body.sources.find((s: any) => s.kind === "photo").status).toBe("failed");
  });
  it("discards newly generated photo evidence if opt-in is revoked in flight", async () => {
    await db.update(knowledgeSettings).set({ photoEnabled: true }).where(eq(knowledgeSettings.userId, owner));
    vi.mocked(readPhoto).mockImplementationOnce(async () => {
      await db.update(knowledgeSettings).set({ photoEnabled: false }).where(eq(knowledgeSettings.userId, owner));
      return { visibleText: "Secret new photo text", observations: "Secret observations", uncertain: false };
    });
    const m = await save("Recipe"); await storage.updateMessageMedia(m.id, "fixture/photo.jpg", "image");
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    const photo = detail.body.sources.find((s: any) => s.kind === "photo");
    expect(photo.text).toBe(""); expect(photo.observations).toBe(""); expect(photo.status).toBe("paused");
    const chunks = await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.messageId, m.id));
    expect(chunks.every(c => c.sourceId !== "photo")).toBe(true);
  });
  it("protects private saves and same-name boards, then honors membership removal", async () => {
    const [board] = await db.select().from(sharedBoards).where(eq(sharedBoards.id, boardId));
    const m = await save("Gin shared recipe", [board.name]); await processOneJob();
    expect((await searchKnowledge(viewer, "gin", { boardId })).messages.map(m => m.id)).toContain(m.id);
    expect((await searchKnowledge(viewer, "gin")).messages).toEqual([]);
    await expect(searchKnowledge(stranger, "gin", { boardId })).rejects.toMatchObject({ status: 403 });
    actor = stranger; expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(404);
    const [other] = await db.insert(sharedBoards).values({ name: board.name, createdBy: stranger }).returning(); boards.push(other.id);
    await db.insert(boardMemberships).values({ boardId: other.id, userId: viewer });
    await expect(searchKnowledge(viewer, "gin", { boardId })).rejects.toMatchObject({ status: 403 });
    await db.delete(boardMemberships).where(eq(boardMemberships.boardId, other.id));
    await db.delete(boardMemberships).where(and(eq(boardMemberships.boardId, boardId), eq(boardMemberships.userId, viewer)));
    await expect(searchKnowledge(viewer, "gin", { boardId })).rejects.toMatchObject({ status: 403 });
  });
  it("denies shared search and source details when only the author has same-name boards", async () => {
    const [board] = await db.select().from(sharedBoards).where(eq(sharedBoards.id, boardId));
    const m = await save("Gin recipe intended for a same-name board", [board.name]);
    await processOneJob();
    // Establish a previously authorized result to exercise live reauthorization.
    expect((await searchKnowledge(viewer, "gin", { boardId })).messages.map(row => row.id)).toContain(m.id);
    actor = viewer;
    expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(200);
    const [other] = await db.insert(sharedBoards).values({ name: board.name, createdBy: owner }).returning();
    boards.push(other.id);
    await db.insert(boardMemberships).values([
      { boardId: other.id, userId: owner, role: "owner" },
      { boardId: other.id, userId: stranger, role: "member" },
    ]);
    vi.mocked(answer).mockClear();
    const denied = await searchKnowledge(viewer, "gin", { boardId });
    expect(denied.messages).toEqual([]);
    expect(denied.citations).toEqual([]);
    expect(denied.aiSummary).toBeNull();
    expect(answer).not.toHaveBeenCalled();
    expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(404);
    const response = await request(app).get("/api/ai-search").query({ q: "gin", boardId });
    expect(response.status).toBe(200);
    expect(response.body.messages).toEqual([]);
    expect(response.body.citations).toEqual([]);
    await expect(searchKnowledge(viewer, "gin", { boardId: other.id })).rejects.toMatchObject({ status: 403 });
    actor = stranger;
    expect((await searchKnowledge(stranger, "gin", { boardId: other.id })).messages).toEqual([]);
    expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(404);
    // Ambiguous sharing must not deny the author their own saved evidence.
    actor = owner;
    expect((await searchKnowledge(owner, "gin")).messages.map(row => row.id)).toContain(m.id);
    expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(200);
    await db.delete(boardMemberships).where(and(eq(boardMemberships.boardId, other.id), eq(boardMemberships.userId, owner)));
    expect((await searchKnowledge(viewer, "gin", { boardId })).messages.map(row => row.id)).toContain(m.id);
    actor = viewer;
    expect((await request(app).get(`/api/knowledge/items/${m.id}`)).status).toBe(200);
  });
  it("rejects an obsolete worker result after editing or deleting the save", async () => {
    const m = await save(); const job = await claimJob();
    expect(job?.messageId).toBe(m.id);
    await storage.updateMessage(m.id, "Tequila instead of gin", []);
    expect(await finishJob(job!, [], [], "ready")).toBe(false);
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    expect(detail.body.sources[0].text).toContain("Tequila");
    await storage.deleteMessage(m.id);
    expect((await db.select().from(knowledgeChunks).where(eq(knowledgeChunks.messageId, m.id))).length).toBe(0);
  });
  it("recovers an expired lease after a restart and rejects the old worker token", async () => {
    const m = await save(); const first = await claimJob();
    expect(await claimJob()).toBeNull();
    await db.update(knowledgeItems).set({ leaseUntil: new Date(Date.now() - 1000) }).where(eq(knowledgeItems.messageId, m.id));
    const recovered = await claimJob();
    expect(recovered?.messageId).toBe(m.id); expect(recovered?.token).not.toBe(first?.token);
    expect(await finishJob(first!, [], [], "ready")).toBe(false);
    expect(await finishJob(recovered!, [], [], "failed", "test_restart")).toBe(true);
  });
  it("labels an illegible photo as incomplete, without invented source text", async () => {
    await db.update(knowledgeSettings).set({ photoEnabled: true }).where(eq(knowledgeSettings.userId, owner));
    vi.mocked(readPhoto).mockResolvedValueOnce({ visibleText: "", observations: "Text is not readable with confidence.", uncertain: true });
    const m = await save("Recipe"); await storage.updateMessageMedia(m.id, "fixture/photo.jpg", "image");
    await processOneJob();
    const detail = await request(app).get(`/api/knowledge/items/${m.id}`);
    const photo = detail.body.sources.find((s: any) => s.kind === "photo");
    expect(photo.text).toBe(""); expect(photo.status).toBe("partial");
    expect(photo.observations).toMatch(/not readable/);
  });
  it("rechecks membership after generating an answer, not only before sending evidence", async () => {
    const [board] = await db.select().from(sharedBoards).where(eq(sharedBoards.id, boardId));
    await save("Gin shared cocktail", [board.name]); await processOneJob();
    vi.mocked(answer).mockImplementationOnce(async (_q, evidence) => {
      await db.delete(boardMemberships).where(and(eq(boardMemberships.boardId, boardId), eq(boardMemberships.userId, viewer)));
      return { text: "A stale answer", citations: [evidence[0]] };
    });
    await expect(searchKnowledge(viewer, "gin", { boardId })).rejects.toMatchObject({ status: 403 });
  });
  it("keeps keyword search and genuine failure states when embedding and answering fail", async () => {
    const m = await save(); await processOneJob();
    control.embeddingFailure = true; control.answerFailure = true;
    const result = await searchKnowledge(owner, "gin? agave?");
    expect(result.messages.map(m => m.id)).toContain(m.id);
    expect(result.searchMethod).toBe("keyword"); expect(result.answerStatus).toBe("unavailable"); expect(result.aiSummary).toBeNull();
  });
  it("keeps keyword results after the daily AI quota is exhausted", async () => {
    const m = await save(); await processOneJob();
    await takeBudget(owner, "search", 100, 100);
    const result = await searchKnowledge(owner, "agave?");
    expect(result.searchMethod).toBe("keyword"); expect(result.messages.map(m => m.id)).toContain(m.id);
    expect(result.warnings.join(" ")).toMatch(/limit reached/);
  });
  it("enforces persisted budgets even with concurrent reservations", async () => {
    const results = await Promise.all(Array.from({ length: 7 }, () => takeBudget(owner, "concurrency-test", 1, 3)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
  it("pauses new analysis and still searches saved text when disabled", async () => {
    const m = await save();
    await request(app).put("/api/knowledge/settings").send({ enabled: false, photoEnabled: false }).expect(200);
    await processOneJob();
    expect(embed).not.toHaveBeenCalled();
    const result = await searchKnowledge(owner, "gin");
    expect(result.answerStatus).toBe("disabled"); expect(result.messages[0].id).toBe(m.id);
    expect((await request(app).post(`/api/knowledge/items/${m.id}/retry`)).status).toBe(409);
  });
  it("requires owner permission and explicit confirmation for bounded backfill work", async () => {
    const m = await save("Gin private note");
    await db.delete(knowledgeItems).where(eq(knowledgeItems.messageId, m.id));
    const dry = await request(app).post("/api/knowledge/backfill").send({ dryRun: true, limit: 20 });
    expect(dry.body.count).toBe(1);
    expect((await db.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, m.id))).length).toBe(0);
    await request(app).post("/api/knowledge/backfill").send({ dryRun: false, limit: 20 }).expect(400);
    const run = await request(app).post("/api/knowledge/backfill").send({ dryRun: false, confirm: true, limit: 20 });
    expect(run.body.queued).toBe(1);
    actor = viewer; await request(app).post(`/api/knowledge/items/${m.id}/retry`).expect(404);
    await request(app).post("/api/knowledge/backfill").send({ dryRun: false, confirm: true, limit: 3000 }).expect(400);
  });
  it("validates queries and local date boundaries without exposing invalid input", async () => {
    await request(app).get("/api/ai-search").query({ q: "gin", from: "2026-02-31" }).expect(400);
    await request(app).get("/api/ai-search").query({ q: "gin", tz: "Unknown/Zone" }).expect(400);
    await request(app).get("/api/ai-search").query({ q: "x".repeat(801) }).expect(400);
    const m = await save();
    await db.update(messages).set({ timestamp: new Date("2026-10-02T05:00:00Z") }).where(eq(messages.id, m.id));
    const result = await searchKnowledge(owner, "gin", { from: "2026-10-01", to: "2026-10-01", timeZone: "America/Los_Angeles", generateAnswer: false });
    expect(result.messages.map(m => m.id)).toContain(m.id);
  });
  it("does not present a missing result as a fabricated AI overview", async () => {
    const result = await searchKnowledge(owner, "unrelated no matching fixture");
    expect(result.messages).toEqual([]); expect(result.answerStatus).toBe("insufficient");
    expect(result.aiSummary).toBeNull(); expect(result.citations).toEqual([]);
  });
});
