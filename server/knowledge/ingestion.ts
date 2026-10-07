import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { messages } from "@shared/schema";
import { extractPreviewUrls } from "@shared/preview-urls";
import type { KnowledgeSource } from "@shared/knowledge";
import { safePreviewFetch, UnsafePreviewUrlError } from "../safe-preview-fetch";
import { aggregateState, extractPage, fingerprint, LIMITS, noteText, sourceId, splitPassages } from "./core";
import { embed, providerAvailable, readPhoto } from "./provider";
import { claimJob, failJob, finishJob, settings, takeBudget } from "./repository";

export async function ingestPage(url: string): Promise<KnowledgeSource> {
  const empty: KnowledgeSource = { id: sourceId(url), kind: "page", title: new URL(url).hostname,
    url, text: "", observations: "", retrievedAt: new Date().toISOString(), status: "failed" };
  try {
    const response = await safePreviewFetch(url, {
      headers: { "User-Agent": "AsideBot/1.0", Accept: "text/html, text/plain;q=0.9" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { ...empty, status: [401, 403, 429].includes(response.status) ? "blocked" : "failed", reason: `Page retrieval returned HTTP ${response.status}.` };
    const mime = response.headers.get("content-type") || "";
    if (/text\/html|application\/xhtml\+xml/i.test(mime)) return extractPage(await response.text(), url);
    if (/text\/plain/i.test(mime)) {
      const text = (await response.text()).trim();
      return { ...empty, text: text.slice(0, LIMITS.sourceCharacters),
        status: text.length < 40 ? "unsupported" : text.length > LIMITS.sourceCharacters ? "partial" : "ready",
        truncated: text.length > LIMITS.sourceCharacters };
    }
    return { ...empty, status: "unsupported", reason: "Only readable HTML and plain-text pages are currently supported." };
  } catch (error) {
    return { ...empty, status: error instanceof UnsafePreviewUrlError ? "blocked" : "failed",
      reason: error instanceof UnsafePreviewUrlError ? "Unsafe destination was rejected." : "Page retrieval failed or exceeded safe size/time limits." };
  }
}
// Read a trusted stored S3 key through the SDK, not an arbitrary user URL.
// Server bytes are bounded before image decoding or transmission to OpenAI.
export async function imageData(key: string): Promise<string> {
  if (!key || key.includes("://") || key.startsWith("/") || key.includes("..") || key.length > 1024) throw new Error("Invalid stored image key");
  const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
  const signal = AbortSignal.timeout(20_000);
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }), { abortSignal: signal });
    if (!result.Body || !/^image\/(jpeg|png|webp|gif)$/i.test(result.ContentType || "") || (result.ContentLength || 0) > 5 * 1024 * 1024) throw new Error("Unsupported image");
    const parts: Buffer[] = []; let bytes = 0;
    for await (const part of result.Body as AsyncIterable<Uint8Array>) {
      signal.throwIfAborted(); bytes += part.length;
      if (bytes > 5 * 1024 * 1024) throw new Error("Image exceeds limit");
      parts.push(Buffer.from(part));
    }
    const input = Buffer.concat(parts);
    const magic = await fileTypeFromBuffer(input);
    if (!magic || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(magic.mime)) throw new Error("Unsupported image bytes");
    const normalized = await sharp(input, { limitInputPixels: 20_000_000 })
      .rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${normalized.toString("base64")}`;
  } finally { s3.destroy(); }
}
export async function processOneJob(onlyMessageId?: number): Promise<boolean> {
  const job = await claimJob(onlyMessageId);
  if (!job) return false;
  try {
    if (job.attempts > 3) { await failJob(job); return true; }
    const [m] = await db.select().from(messages).where(eq(messages.id, job.messageId));
    if (!m || fingerprint(m) !== job.fingerprint) {
      // Enqueue hooks normally handle this; recover version changes safely.
      const { enqueue } = await import("./repository");
      if (m) await enqueue(m.id);
      return true;
    }
    const prefs = await settings(m.userId);
    if (!prefs.enabled) {
      await finishJob(job, [], [], "paused", "analysis_disabled"); return true;
    }
    if (!await takeBudget(m.userId, "ingestion", 1, LIMITS.savesPerDay)) {
      await finishJob(job, [], [], "paused", "daily_ingestion_limit"); return true;
    }
    const sources: KnowledgeSource[] = [];
    const note = noteText(m.content);
    if (note) sources.push({
      id: "note", kind: "note", title: "Saved note", text: note.slice(0, LIMITS.sourceCharacters),
      observations: "", status: note.length > LIMITS.sourceCharacters ? "partial" : "ready",
      truncated: note.length > LIMITS.sourceCharacters, retrievedAt: new Date().toISOString(),
    });
    const urls = extractPreviewUrls(m.content);
    for (const url of urls.slice(0, LIMITS.linksPerSave)) sources.push(await ingestPage(url));
    if (urls.length > LIMITS.linksPerSave) sources.push({
      id: "over-limit", kind: "page", title: "Additional links not read", text: "", observations: "",
      status: "unsupported", reason: `${urls.length - LIMITS.linksPerSave} links exceeded the per-save limit; split this save into smaller saves.`, retrievedAt: new Date().toISOString(),
    });
    if (m.mediaUrl) {
      const photo: KnowledgeSource = { id: "photo", kind: "photo", title: "Saved photo",
        text: "", observations: "", status: "unsupported", retrievedAt: new Date().toISOString() };
      if (m.mediaType !== "image") photo.reason = "Audio and video understanding are not enabled.";
      else if (!prefs.photoEnabled) { photo.status = "paused"; photo.reason = "The save's owner has not opted in to photo analysis."; }
      else if (!providerAvailable()) { photo.status = "failed"; photo.reason = "Photo analysis provider is unavailable."; }
      else if (!await takeBudget(m.userId, "photo", 1, LIMITS.photosPerDay)) { photo.status = "paused"; photo.reason = "Daily photo-analysis limit reached."; }
      else {
        try {
          // Recheck consent immediately before transmitting image bytes.
          const current = await settings(m.userId);
          const [currentMessage] = await db.select().from(messages).where(eq(messages.id, m.id));
          if (!current.enabled || !current.photoEnabled || !currentMessage || fingerprint(currentMessage) !== job.fingerprint) throw new Error("Photo consent or save changed");
          const bytes = await imageData(m.mediaUrl);
          const consent = await settings(m.userId);
          const [beforeSend] = await db.select().from(messages).where(eq(messages.id, m.id));
          if (!consent.enabled || !consent.photoEnabled || !beforeSend || fingerprint(beforeSend) !== job.fingerprint) throw new Error("Photo consent or save changed");
          const analysis = await readPhoto(bytes);
          photo.text = analysis.visibleText; photo.observations = analysis.observations;
          photo.status = !photo.text && !photo.observations ? "unsupported" : analysis.uncertain ? "partial" : "ready";
          photo.reason = "Visual observations are AI interpretations. Only visible text and details were analyzed.";
        } catch {
          photo.status = "failed"; photo.reason = "Photo could not be retrieved or analyzed; no contents were inferred.";
        }
      }
      sources.push(photo);
    }
    const passages = sources.flatMap(s => splitPassages([
      s.text, s.observations ? `AI visual observations (not verified facts): ${s.observations}` : "",
    ].filter(Boolean).join("\n\n")).map(content => ({ sourceId: s.id, content, embedding: null as number[] | null })));
    let indexed = false;
    let errorCode: string | undefined;
    const currentPrefs = await settings(m.userId);
    if (!currentPrefs.photoEnabled) {
      for (const source of sources.filter(s => s.kind === "photo")) {
        source.text = ""; source.observations = ""; source.status = "paused";
      }
      for (let i = passages.length - 1; i >= 0; i--) if (passages[i].sourceId === "photo") passages.splice(i, 1);
    }
    if (passages.length && passages.length <= LIMITS.passagesPerSave && currentPrefs.enabled && providerAvailable()) {
      if (await takeBudget(m.userId, "passages", passages.length, LIMITS.passagesPerDay)) {
        try {
          for (let i = 0; i < passages.length; i += 32) {
            const [latest] = await db.select().from(messages).where(eq(messages.id, m.id));
            if (!latest || fingerprint(latest) !== job.fingerprint || !(await settings(m.userId)).enabled) throw new Error("Save or preference changed");
            const batch = await embed(passages.slice(i, i + 32).map(p => {
              const source = sources.find(s => s.id === p.sourceId)!;
              return `${source.title.slice(0, 300)}\nTags: ${m.tags.join(" ").slice(0, 300)}\n${p.content}`;
            }));
            batch.forEach((v, j) => { passages[i + j].embedding = v; });
          }
          indexed = true;
        } catch { errorCode = "embedding_unavailable"; }
      } else errorCode = "daily_embedding_limit";
    } else if (passages.length) errorCode = currentPrefs.enabled ? "embedding_unavailable" : "analysis_disabled";
    const finalPrefs = await settings(m.userId);
    if (!finalPrefs.enabled) { await finishJob(job, [], [], "paused", "analysis_disabled"); return true; }
    if (!finalPrefs.photoEnabled) {
      for (const source of sources.filter(s => s.kind === "photo")) {
        source.text = ""; source.observations = ""; source.status = "paused";
      }
      for (let i = passages.length - 1; i >= 0; i--) if (passages[i].sourceId === "photo") passages.splice(i, 1);
    }
    await finishJob(job, sources, passages.slice(0, LIMITS.passagesPerSave), aggregateState(sources, indexed), errorCode);
  } catch {
    await failJob(job);
  }
  return true;
}
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
export function startKnowledgeWorker() {
  if (running) return;
  running = true;
  const tick = async () => {
    let delay = 5000;
    try {
      const { admitLibraryScanBatch } = await import("./library-scan");
      try { if (await admitLibraryScanBatch()) delay = 250; }
      catch { console.warn("[Knowledge] Older-save scan admission unavailable; existing ingestion continues."); }
      if (await processOneJob()) delay = 250;
    }
    catch { console.warn("[Knowledge] Worker unavailable; check additive schema and database health."); delay = 60_000; }
    if (running) { timer = setTimeout(tick, delay); timer.unref(); }
  };
  void tick();
}
export function stopKnowledgeWorker() {
  running = false; if (timer) clearTimeout(timer);
}
