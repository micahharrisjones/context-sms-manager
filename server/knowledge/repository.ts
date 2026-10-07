import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { messages, knowledgeItems, knowledgeChunks, knowledgeSettings, knowledgeUsage } from "@shared/schema";
import type { Message } from "@shared/schema";
import type { KnowledgeSource } from "@shared/knowledge";
import { fingerprint, LIMITS } from "./core";

export class KnowledgeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function settings(userId: number) {
  const [row] = await db.select().from(knowledgeSettings).where(eq(knowledgeSettings.userId, userId));
  return row || { userId, enabled: true, photoEnabled: false };
}
export async function takeBudget(userId: number, action: string, amount: number, limit: number): Promise<boolean> {
  if (amount < 1 || amount > limit) return false;
  const result = await db.execute(sql`
    INSERT INTO knowledge_usage (user_id, day, action, used)
    VALUES (${userId}, ${new Date().toISOString().slice(0, 10)}, ${action}, ${amount})
    ON CONFLICT (user_id, day, action) DO UPDATE SET used = knowledge_usage.used + ${amount}
    WHERE knowledge_usage.used + ${amount} <= ${limit}
    RETURNING used`);
  return result.rows.length > 0;
}
// IDs authorize; names only select the established hashtag association.
// All checks are in the SQL statement, not a cached membership list.
// Both the viewer and author must have an unambiguous name-to-board association.
export function scopeCondition(userId: number, boardId?: number): SQL {
  if (!boardId) return sql`m.user_id = ${userId}`;
  return sql`
    EXISTS (SELECT 1 FROM board_memberships mine WHERE mine.user_id = ${userId} AND mine.board_id = ${boardId})
    AND m.tags @> ARRAY[(SELECT name FROM shared_boards WHERE id = ${boardId})]::text[]
    AND m.user_id IN (SELECT user_id FROM board_memberships WHERE board_id = ${boardId})
    AND (SELECT count(*) FROM board_memberships bm JOIN shared_boards b ON b.id = bm.board_id
      WHERE bm.user_id = ${userId} AND b.name = (SELECT name FROM shared_boards WHERE id = ${boardId})) = 1
    AND (SELECT count(*) FROM board_memberships author JOIN shared_boards b ON b.id = author.board_id
      WHERE author.user_id = m.user_id AND b.name = (SELECT name FROM shared_boards WHERE id = ${boardId})) = 1`;
}
export function itemAccess(userId: number): SQL {
  return sql`(m.user_id = ${userId} OR EXISTS (
    SELECT 1 FROM board_memberships mine JOIN shared_boards b ON b.id = mine.board_id
    WHERE mine.user_id = ${userId} AND m.tags @> ARRAY[b.name]::text[]
      AND EXISTS (SELECT 1 FROM board_memberships author WHERE author.board_id = b.id AND author.user_id = m.user_id)
      AND (SELECT count(*) FROM board_memberships other JOIN shared_boards ob ON ob.id = other.board_id
        WHERE other.user_id = ${userId} AND ob.name = b.name) = 1
      AND (SELECT count(*) FROM board_memberships authorBoards JOIN shared_boards ab ON ab.id = authorBoards.board_id
         WHERE authorBoards.user_id = m.user_id AND ab.name = b.name) = 1
  ))`;
}
export async function assertScope(userId: number, boardId?: number) {
  if (!boardId) return;
  const result = await db.execute(sql`SELECT b.id FROM shared_boards b
    JOIN board_memberships bm ON bm.board_id = b.id
    WHERE b.id = ${boardId} AND bm.user_id = ${userId}
      AND (SELECT count(*) FROM board_memberships other JOIN shared_boards ob ON ob.id=other.board_id
           WHERE other.user_id=${userId} AND ob.name=b.name)=1`);
  if (!result.rows.length) throw new KnowledgeError(403, "This board is unavailable or its name is ambiguous.");
}
export function decodeMessage(row: Record<string, any>): Message {
  const converted = Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()), value,
  ]));
  converted.timestamp = new Date(converted.timestamp);
  if (converted.enrichedAt) converted.enrichedAt = new Date(converted.enrichedAt);
  return converted as Message;
}
export async function accessibleMessage(userId: number, messageId: number): Promise<Message> {
  const result = await db.execute(sql`SELECT to_jsonb(m) AS message FROM messages m
    WHERE m.id = ${messageId} AND ${itemAccess(userId)}`);
  if (!result.rows.length) throw new KnowledgeError(404, "Save not found.");
  return decodeMessage(result.rows[0].message as Record<string, any>);
}
// This writes only a persistent job, never calls a provider on the save path.
export async function enqueue(messageId: number, force = false, scan?: { ownerId: number; fingerprint: string; startedAt: Date }): Promise<boolean> {
  return db.transaction(async tx => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, messageId)).for("update");
    if (!m || (scan && m.userId !== scan.ownerId)) return false;
    const version = fingerprint(m);
    if (scan && version !== scan.fingerprint) return false;
    const [existing] = await tx.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, messageId));
    // Another coordinator may have finished this version since the admission read.
    if (scan && existing?.fingerprint === version &&
      (["ready", "partial"].includes(existing.status) || existing.updatedAt >= scan.startedAt)) return false;
    if (existing?.fingerprint === version && !force) return false;
    // A forced retry cannot invalidate work already queued/running.
    if (existing?.fingerprint === version && ["queued", "processing"].includes(existing.status)) return false;
    await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.messageId, messageId));
    const values = { messageId, fingerprint: version, status: "queued", sources: [] as KnowledgeSource[],
      attempts: 0, availableAt: new Date(), leaseUntil: null, leaseToken: null, errorCode: null, updatedAt: new Date() };
    await tx.insert(knowledgeItems).values(values).onConflictDoUpdate({ target: knowledgeItems.messageId, set: values });
    return true;
  });
}
export async function queueSavedItem(messageId: number) {
  try { await enqueue(messageId); }
  catch { console.warn("[Knowledge] Save retained, but its ingestion job could not be persisted. Retry from source details."); }
}
export async function claimJob(onlyMessageId?: number) {
  const token = randomUUID();
  const result = await db.execute(sql`
    UPDATE knowledge_items SET status='processing', attempts=attempts+1,
      lease_until=now()+interval '8 minutes', lease_token=${token}, updated_at=now()
    WHERE message_id = (
      SELECT message_id FROM knowledge_items WHERE
        ((status='queued' AND available_at<=now()) OR
        (status='processing' AND lease_until<now()))
        AND ${onlyMessageId === undefined ? sql`true` : sql`message_id=${onlyMessageId}`}
      ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED
    ) RETURNING message_id AS "messageId", fingerprint, attempts`);
  const row = result.rows[0];
  return row ? { messageId: Number(row.messageId), fingerprint: String(row.fingerprint), attempts: Number(row.attempts), token } : null;
}
export async function finishJob(job: { messageId: number; fingerprint: string; token: string },
  sources: KnowledgeSource[], passages: { sourceId: string; content: string; embedding: number[] | null }[], status: string, errorCode?: string) {
  return db.transaction(async tx => {
    const [m] = await tx.select().from(messages).where(eq(messages.id, job.messageId)).for("update");
    if (!m || fingerprint(m) !== job.fingerprint) return false;
    const [current] = await tx.select().from(knowledgeItems).where(eq(knowledgeItems.messageId, m.id)).for("update");
    if (!current || current.fingerprint !== job.fingerprint || current.leaseToken !== job.token) return false;
    await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.messageId, m.id));
    for (let i = 0; i < passages.length; i += 20) {
      await tx.insert(knowledgeChunks).values(passages.slice(i, i + 20).map((p, j) => ({
        messageId: m.id, fingerprint: job.fingerprint, sourceId: p.sourceId, ordinal: i + j,
        content: p.content, embedding: p.embedding,
      })));
    }
    await tx.update(knowledgeItems).set({
      sources, status, errorCode: errorCode || null, leaseToken: null, leaseUntil: null, updatedAt: new Date(),
    }).where(eq(knowledgeItems.messageId, m.id));
    return true;
  });
}
export async function failJob(job: { messageId: number; token: string; attempts: number }) {
  await db.update(knowledgeItems).set({
    status: job.attempts < 3 ? "queued" : "failed", errorCode: "ingestion_failed",
    availableAt: new Date(Date.now() + job.attempts * 30_000), leaseToken: null, leaseUntil: null, updatedAt: new Date(),
  }).where(and(eq(knowledgeItems.messageId, job.messageId), eq(knowledgeItems.leaseToken, job.token)));
}
export async function backfillCandidates(userId: number, limit: number) {
  const result = await db.execute(sql`
    SELECT m.id FROM messages m LEFT JOIN knowledge_items ki ON ki.message_id=m.id
    WHERE m.user_id=${userId} AND (ki.message_id IS NULL OR ki.status IN ('failed','blocked','unsupported','paused','partial'))
    ORDER BY m.timestamp DESC LIMIT ${limit}`);
  return result.rows.map(r => Number(r.id));
}
