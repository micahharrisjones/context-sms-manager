import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { KnowledgeCitation, KnowledgeSearchResponse, KnowledgeSource } from "@shared/knowledge";
import { fingerprint, keywordQuery, LIMITS, parseFilters } from "./core";
import { answer, embed, providerAvailable } from "./provider";
import { assertScope, decodeMessage, KnowledgeError, scopeCondition, settings, takeBudget } from "./repository";
import { s3Service } from "../s3-service";

const embeddings = new Map<string, { vector: number[]; expires: number }>();
async function queryVector(userId: number, q: string, signal?: AbortSignal) {
  const key = `${userId}:${createHash("sha256").update(q).digest("hex")}`;
  const cached = embeddings.get(key);
  if (cached && cached.expires > Date.now()) return cached.vector;
  const [vector] = await embed([q], signal);
  if (embeddings.size >= 128) embeddings.delete(embeddings.keys().next().value!);
  embeddings.set(key, { vector, expires: Date.now() + 5 * 60_000 });
  return vector;
}
export async function searchKnowledge(userId: number, q: string, options: {
  boardId?: number; from?: string; to?: string; timeZone?: string; signal?: AbortSignal; generateAnswer?: boolean;
} = {}): Promise<KnowledgeSearchResponse> {
  await assertScope(userId, options.boardId);
  const prefs = await settings(userId);
  const timeZone = options.timeZone || "UTC";
  const filters = { ...parseFilters(q, options.from, options.to, new Date(), timeZone), boardId: options.boardId };
  const where = sql`${scopeCondition(userId, options.boardId)}
    ${filters.from ? sql`AND m.timestamp >= ((${filters.from}::date::timestamp AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')` : sql``}
    ${filters.to ? sql`AND m.timestamp < (((${filters.to}::date + interval '1 day') AT TIME ZONE ${timeZone}) AT TIME ZONE 'UTC')` : sql``}
    ${filters.tags.length ? sql`AND m.tags @> ${`{${filters.tags.join(",")}}`}::text[]` : sql``}`;
  const warnings: string[] = [];
  let vector: number[] | null = null;
  let aiAllowed = prefs.enabled && providerAvailable();
  if (aiAllowed) {
    if (!await takeBudget(userId, "search", 1, LIMITS.searchesPerDay)) {
      aiAllowed = false;
      warnings.push("Daily AI-search limit reached. Keyword search remains available.");
    }
  }
  if (aiAllowed) {
    try { vector = await queryVector(userId, q, options.signal); }
    catch { options.signal?.throwIfAborted(); warnings.push("Semantic search is unavailable; using saved text and keywords."); }
  }
  const kw = keywordQuery(q) || "asideimpossiblesearchterm";
  const keyword = sql`to_tsquery('simple', ${kw})`;
  const query = vector ? `[${vector.join(",")}]` : null;
  const chunkScore = vector ? sql`COALESCE(1-(c.embedding <=> ${query}::vector),0)` : sql`0`;
  const chunkText = sql`(c.content || ' ' || array_to_string(m.tags,' ') || ' ' ||
    COALESCE((SELECT s->>'title' FROM jsonb_array_elements(ki.sources) s WHERE s->>'id'=c.source_id LIMIT 1),''))`;
  const legacyScore = vector ? sql`COALESCE(1-(me.embedding <=> ${query}::vector),0)` : sql`0`;
  const chunkRows = await db.execute(sql`
    SELECT c.id, c.source_id, c.content, ki.fingerprint, ki.sources, ki.status,
      to_jsonb(m) AS message,
      (${chunkScore} + LEAST(ts_rank(to_tsvector('simple', ${chunkText}), ${keyword})*3, 0.5)) AS score
    FROM knowledge_chunks c JOIN messages m ON m.id=c.message_id
      JOIN knowledge_items ki ON ki.message_id=m.id AND ki.fingerprint=c.fingerprint
    WHERE ${where} AND (
      to_tsvector('simple', ${chunkText}) @@ ${keyword}
      OR ${chunkScore} >= 0.38
    ) ORDER BY score DESC LIMIT 40`);
  // Existing notes/metadata remain usable during ingestion or provider outages.
  const legacyRows = await db.execute(sql`
    SELECT to_jsonb(m) AS message, ki.fingerprint, ki.status, ki.sources,
      (${legacyScore} + LEAST(ts_rank(to_tsvector('simple',
        m.content || ' ' || COALESCE(m.og_title,'') || ' ' || COALESCE(m.og_description,'') || ' ' || array_to_string(m.tags,' ')), ${keyword})*3,0.5)) AS score
    FROM messages m LEFT JOIN message_embeddings me ON me.message_id=m.id
      LEFT JOIN knowledge_items ki ON ki.message_id=m.id
    WHERE ${where} AND (
      to_tsvector('simple', m.content || ' ' || COALESCE(m.og_title,'') || ' ' ||
        COALESCE(m.og_description,'') || ' ' || array_to_string(m.tags,' ')) @@ ${keyword}
      OR ${legacyScore} >= 0.38
    ) ORDER BY score DESC LIMIT 20`);
  const candidates: KnowledgeCitation[] = [];
  const found = new Map<number, KnowledgeSearchResponse["messages"][number]>();
  for (const row of chunkRows.rows) {
    const m = decodeMessage(row.message as Record<string, any>);
    if (fingerprint(m) !== row.fingerprint) continue;
    const source = (row.sources as KnowledgeSource[]).find(s => s.id === row.source_id);
    if (!source) continue;
    found.set(m.id, { ...m, knowledgeStatus: row.status as any });
    if (candidates.filter(c => c.messageId === m.id).length >= 3) continue;
    candidates.push({ id: `passage:${row.id}`, messageId: m.id, sourceId: source.id,
      title: source.title, kind: source.kind, url: source.url,
      excerpt: String(row.content), coverage: source.status });
  }
  for (const row of legacyRows.rows) {
    const m = decodeMessage(row.message as Record<string, any>);
    const current = row.fingerprint === fingerprint(m);
    if (!found.has(m.id)) found.set(m.id, { ...m, knowledgeStatus: current ? row.status as any : "not_indexed" });
    if (candidates.some(c => c.messageId === m.id)) continue;
    // Metadata and the note are explicitly evidence about a save, not a full article.
    const excerpt = [
      `User's saved text: ${m.content.slice(0, 1800)}`,
      m.ogTitle ? `Preview title (not article body): ${m.ogTitle.slice(0, 300)}` : "",
      m.ogDescription ? `Preview description only: ${m.ogDescription.slice(0, 500)}` : "",
      m.mediaUrl ? "Attached media contents are unknown unless a photo passage is supplied." : "",
      "The linked page has not been supplied as evidence here.",
    ].filter(Boolean).join("\n");
    candidates.push({ id: `save:${m.id}`, messageId: m.id, sourceId: "saved-text",
      title: m.ogTitle || "Saved text", kind: "preview", excerpt, coverage: "partial" });
  }
  const selected = [...found.values()].slice(0, 20);
  const ids = selected.map(m => m.id);
  const evidence: KnowledgeCitation[] = [];
  let chars = 0;
  for (const c of candidates) {
    if (!ids.includes(c.messageId) || evidence.length >= 12 || chars + c.excerpt.length > 14_000) continue;
    chars += c.excerpt.length; evidence.push(c);
  }
  const result: KnowledgeSearchResponse = {
    messages: selected, query: q, aiSummary: null, answerStatus: !prefs.enabled ? "disabled" : aiAllowed ? "insufficient" : "unavailable",
    citations: [], searchMethod: vector ? "hybrid" : "keyword", filters, warnings,
    coverage: { total: 0, ready: 0, partial: 0, pending: 0, failed: 0, unindexed: 0 },
  };
  const counts = await db.execute(sql`
    SELECT count(*)::int AS total,
      count(*) FILTER(WHERE ki.status='ready')::int AS ready,
      count(*) FILTER(WHERE ki.status='partial')::int AS partial,
      count(*) FILTER(WHERE ki.status IN ('queued','processing'))::int AS pending,
      count(*) FILTER(WHERE ki.status IN ('failed','blocked','unsupported','paused'))::int AS failed,
      count(*) FILTER(WHERE ki.message_id IS NULL)::int AS unindexed
    FROM messages m LEFT JOIN knowledge_items ki ON ki.message_id=m.id WHERE ${where}`);
  result.coverage = counts.rows[0] as unknown as KnowledgeSearchResponse["coverage"];
  if (result.coverage.unindexed || result.coverage.partial || result.coverage.failed) warnings.push("Some saves have incomplete or unavailable source content. Answers can only use the evidence retrieved.");
  if (evidence.length && aiAllowed && options.generateAnswer !== false) {
    const before = await settings(userId);
    await assertScope(userId, options.boardId);
    if (!before.enabled) result.answerStatus = "disabled";
    else try {
      // Re-authorize selected IDs after the embedding call and before model context.
      const allowed = await db.execute(sql`SELECT m.id FROM messages m WHERE ${where} AND m.id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`);
      if (allowed.rows.length !== ids.length) throw new KnowledgeError(403, "Save access changed. Search again.");
      const generated = await answer(q, evidence, options.signal);
      result.aiSummary = generated.text; result.citations = generated.citations;
      result.answerStatus = generated.text ? "ready" : "insufficient";
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      options.signal?.throwIfAborted();
      result.answerStatus = "unavailable"; warnings.push("The AI answer could not be generated or verified. Saved search results are still available.");
    }
  }
  options.signal?.throwIfAborted();
  await assertScope(userId, options.boardId);
  if (ids.length) {
    const current = await db.execute(sql`SELECT to_jsonb(m) AS message FROM messages m WHERE ${where} AND m.id IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`);
    if (current.rows.length !== ids.length || current.rows.some(row => {
      const m = decodeMessage(row.message as Record<string, any>);
      return fingerprint(m) !== fingerprint(selected.find(old => old.id === m.id)!);
    })) throw new KnowledgeError(409, "Saves or access changed while searching. Please search again.");
  }
  if (!(await settings(userId)).enabled) { result.aiSummary = null; result.citations = []; result.answerStatus = "disabled"; }
  result.messages = await s3Service.generateSignedUrlsForMessages(selected);
  return result;
}
