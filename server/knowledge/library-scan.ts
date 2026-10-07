import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { knowledgeLibraryScans, knowledgeItems, knowledgeSettings, messages } from "@shared/schema";
import type { LibraryScanStatus } from "@shared/knowledge";
import { fingerprint } from "./core";
import { enqueue, KnowledgeError, settings } from "./repository";
import { providerAvailable } from "./provider";
import { summarizeScan, type ScanOutcome } from "./library-scan-summary";

// Match the established card list: standalone hashtag commands aren't saved cards.
function isSavedCard(m: { content: string }) {
  return m.content.replace(/#\w+/g, "").replace(/\s/g, "").length > 0;
}
async function preferences(userId: number) {
  const prefs = await settings(userId);
  return { available: providerAvailable(), photoEnabled: prefs.photoEnabled, analysisEnabled: prefs.enabled };
}
async function snapshot(userId: number) {
  // Ownership, not shared-board membership: one user's scan never processes another's saves.
  const saves = (await db.select().from(messages).where(eq(messages.userId, userId))).filter(isSavedCard);
  const outcomes = await db.select({
    messageId: knowledgeItems.messageId, fingerprint: knowledgeItems.fingerprint,
    status: knowledgeItems.status, errorCode: knowledgeItems.errorCode,
    hasText: sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements(${knowledgeItems.sources}) s
      WHERE length(trim(coalesce(s->>'text',''))) > 0 OR length(trim(coalesce(s->>'observations',''))) > 0)`,
    sources: sql<ScanOutcome["sources"]>`coalesce((SELECT jsonb_agg(jsonb_build_object(
      'kind',s->>'kind','status',s->>'status','reason',s->>'reason'))
      FROM jsonb_array_elements(${knowledgeItems.sources}) s),'[]'::jsonb)`,
  }).from(knowledgeItems).innerJoin(messages, eq(messages.id, knowledgeItems.messageId))
    .where(eq(messages.userId, userId));
  return { saves, outcomes };
}
export async function libraryScanStatus(userId: number): Promise<LibraryScanStatus> {
  const [run] = await db.select().from(knowledgeLibraryScans).where(eq(knowledgeLibraryScans.userId, userId));
  const prefs = await preferences(userId);
  if (!run) {
    const cards = await db.select({ content: messages.content }).from(messages).where(eq(messages.userId, userId));
    return { status: "intro", total: cards.filter(isSavedCard).length, processed: 0, indexed: 0, partial: 0, notIndexed: 0, reasons: [], ...prefs };
  }
  if (run.report) return { ...run.report, ...prefs, status: run.acknowledgedAt ? "dismissed" : "completed" };
  const { saves, outcomes } = await snapshot(userId);
  const report = summarizeScan(run.entries, run.cursor, new Map(saves.map(m => [m.id, fingerprint(m)])), outcomes, prefs);
  if (report.status === "completed") {
    // Freeze the completion snapshot; later edits/deletes must not change a past report.
    await db.update(knowledgeLibraryScans).set({ status: "completed", report })
      .where(and(eq(knowledgeLibraryScans.userId, userId), eq(knowledgeLibraryScans.status, "running")));
  }
  return report;
}
export async function startLibraryScan(userId: number): Promise<LibraryScanStatus> {
  if (!providerAvailable()) throw new KnowledgeError(503, "AI indexing is temporarily unavailable. Please try again later.");
  await db.transaction(async tx => {
    // Serializes double-taps and concurrent devices for this account.
    await tx.execute(sql`SELECT id FROM users WHERE id=${userId} FOR UPDATE`);
    const [existing] = await tx.select().from(knowledgeLibraryScans).where(eq(knowledgeLibraryScans.userId, userId));
    if (existing) return;
    const saves = (await tx.select().from(messages).where(eq(messages.userId, userId))).filter(isSavedCard);
    const previous = await tx.select({ messageId: knowledgeItems.messageId, fingerprint: knowledgeItems.fingerprint,
      status: knowledgeItems.status }).from(knowledgeItems).innerJoin(messages, eq(messages.id, knowledgeItems.messageId))
      .where(eq(messages.userId, userId));
    const byId = new Map(previous.map(item => [item.messageId, item]));
    const entries = saves.map(m => {
      const version = fingerprint(m), item = byId.get(m.id);
      // Reuse useful extracts rather than deleting/rebilling previously indexed cards.
      return { messageId: m.id, fingerprint: version, reuse: item?.fingerprint === version && ["ready", "partial"].includes(item.status) };
    });
    // The disclosed Start action opts in to text/link analysis only; never enable photos.
    await tx.insert(knowledgeSettings).values({ userId, enabled: true, photoEnabled: false })
      .onConflictDoUpdate({ target: knowledgeSettings.userId, set: { enabled: true, updatedAt: new Date() } });
    await tx.insert(knowledgeLibraryScans).values({ userId, entries });
  });
  return libraryScanStatus(userId);
}
export async function dismissLibraryScan(userId: number) {
  const result = await libraryScanStatus(userId);
  if (result.status !== "completed" && result.status !== "dismissed") throw new KnowledgeError(409, "The scan is still processing.");
  await db.update(knowledgeLibraryScans).set({ acknowledgedAt: new Date() }).where(eq(knowledgeLibraryScans.userId, userId));
}

// Persistent admission cursor: closing the modal, server restart, or interrupted
// admission cannot lose a batch. The existing leased worker does the actual AI work.
export async function admitLibraryScanBatch(onlyUserId?: number): Promise<boolean> {
  const [run] = await db.select().from(knowledgeLibraryScans)
    .where(and(sql`${knowledgeLibraryScans.status}='running'
      AND ${knowledgeLibraryScans.cursor}<jsonb_array_length(${knowledgeLibraryScans.entries})`,
      onlyUserId === undefined ? undefined : eq(knowledgeLibraryScans.userId, onlyUserId)))
    .orderBy(knowledgeLibraryScans.startedAt).limit(1);
  if (!run) return false;
  const end = Math.min(run.cursor + 20, run.entries.length);
  for (const entry of run.entries.slice(run.cursor, end)) {
    if (entry.reuse) continue;
    const [m] = await db.select().from(messages).where(and(eq(messages.id, entry.messageId), eq(messages.userId, run.userId)));
    if (!m || fingerprint(m) !== entry.fingerprint) continue;
    const [item] = await db.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, m.id));
    if (item?.fingerprint === entry.fingerprint && (["queued", "processing", "ready", "partial"].includes(item.status) || item.updatedAt >= run.startedAt)) continue;
    await enqueue(entry.messageId, true, { ownerId: run.userId, fingerprint: entry.fingerprint, startedAt: run.startedAt });
  }
  await db.update(knowledgeLibraryScans).set({ cursor: end })
    .where(and(eq(knowledgeLibraryScans.userId, run.userId), eq(knowledgeLibraryScans.cursor, run.cursor)));
  return true;
}
