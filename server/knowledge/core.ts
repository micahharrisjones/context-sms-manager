import { createHash } from "node:crypto";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { Message } from "@shared/schema";
import type { KnowledgeSource, KnowledgeState } from "@shared/knowledge";
import { extractPreviewUrls } from "@shared/preview-urls";

const stopWords = new Set("a an and are as at be by can do did find for from has have how i in is it me my of on or saved search show that the these this to what when where which who with last month".split(" "));
export function keywordQuery(q: string): string {
  const all = q.toLowerCase().match(/[\p{L}\p{N}_]{2,40}/gu) || [];
  const meaningful = all.filter(t => !stopWords.has(t));
  return [...new Set(meaningful.length ? meaningful : all)].slice(0, 24).map(t => `${t}:*`).join(" | ");
}

export const LIMITS = {
  savesPerDay: 50, photosPerDay: 5, searchesPerDay: 100,
  linksPerSave: 8, backfillBatch: 20, passagesPerDay: 1000,
  sourceCharacters: 8400, passagesPerSave: 80,
};
export function fingerprint(m: Pick<Message, "content" | "tags" | "mediaUrl" | "mediaType">): string {
  return createHash("sha256").update(JSON.stringify([m.content, [...m.tags].sort(), m.mediaUrl, m.mediaType])).digest("hex");
}
export function sourceId(url: string): string {
  return `page:${createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
}
export function splitPassages(text: string, size = 1400, overlap = 200): string[] {
  if (size <= overlap || overlap < 0) throw new Error("Invalid passage bounds");
  const parts: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + size / 2) end = boundary;
    }
    const part = text.slice(start, end).trim();
    if (part) parts.push(part);
    if (end === text.length) break;
    start = end - overlap;
  }
  return parts;
}
export function noteText(content: string): string {
  return content.replace(/https?:\/\/\S+/gi, "").replace(/#[\p{L}\p{N}_-]+/gu, "").trim();
}
export function extractPage(html: string, url: string): KnowledgeSource {
  const { document } = parseHTML(html);
  Object.defineProperty(document, "documentURI", { value: url });
  const title = document.querySelector("title")?.textContent?.trim().slice(0, 300) || new URL(url).hostname;
  document.querySelectorAll("script,style,noscript,nav,footer,header,aside,form,svg,iframe").forEach(n => n.remove());
  const hasContentRegion = Boolean(document.querySelector("article,main,[role='main']"));
  const initial = document.body?.textContent?.trim() || "";
  const challenge = /^(log ?in|sign ?in|access denied|just a moment|page not found|welcome to reddit)\b/i.test(title) ||
    /checking your browser|verify (?:that )?you are human|enable javascript and cookies|unusual traffic from your/i.test(initial.slice(0, 1200));
  let text = "";
  if (!challenge) {
    const article = new Readability(document as unknown as Document, { charThreshold: 120 }).parse();
    text = (article?.textContent || "").replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
  }
  const blocked = challenge || text.length < (hasContentRegion ? 40 : 120);
  const truncated = text.length > LIMITS.sourceCharacters;
  const teaser = /subscribe to (?:continue reading|read (?:the full|this) (?:article|story))|(?:this article is|for) subscribers only|sign in to continue reading|unlock this article/i.test(text);
  return {
    id: sourceId(url), kind: "page", title, url, retrievedAt: new Date().toISOString(),
    text: blocked ? "" : text.slice(0, LIMITS.sourceCharacters), observations: "",
    status: challenge ? "blocked" : blocked ? "unsupported" : truncated || teaser ? "partial" : "ready",
    truncated,
    reason: challenge ? "The page requires access or blocked automated reading." : blocked ? "No readable page text was found. A rendered-page scraper may be needed." : teaser ? "Only publicly accessible text or a subscription teaser was retrieved." : truncated ? "Source text exceeded the ingestion limit; coverage is partial." : undefined,
  };
}
export function aggregateState(sources: KnowledgeSource[], indexed: boolean): KnowledgeState {
  const useful = sources.some(s => s.text.trim() || s.observations.trim());
  if (!useful) {
    if (sources.some(s => s.status === "paused")) return "paused";
    if (sources.some(s => s.status === "failed")) return "failed";
    if (sources.some(s => s.status === "blocked")) return "blocked";
    return "unsupported";
  }
  return indexed && sources.every(s => s.status === "ready") ? "ready" : "partial";
}
export function normalizeQuote(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
// Deliberately small, deterministic interpretation: never model-generated SQL.
export function parseFilters(q: string, from?: string, to?: string, now = new Date(), timeZone = "UTC") {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const year = Number(local.find(p => p.type === "year")?.value);
  const month = Number(local.find(p => p.type === "month")?.value) - 1;
  const tags = [...new Set([...q.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map(m => m[1]))].slice(0, 8);
  if (!from && !to && /\blast month\b/i.test(q)) {
    from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
    to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  if (from && to && from > to) throw new Error("Start date must not follow end date");
  return { from, to, tags };
}
