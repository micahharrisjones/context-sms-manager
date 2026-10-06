import type { Message } from "./schema";

export type KnowledgeState = "not_indexed" | "queued" | "processing" | "ready" | "partial" | "blocked" | "unsupported" | "failed" | "paused";
export interface KnowledgeSource {
  id: string;
  kind: "note" | "page" | "photo" | "preview";
  title: string;
  url?: string;
  text: string;
  observations: string;
  status: KnowledgeState;
  reason?: string;
  retrievedAt: string;
  truncated?: boolean;
}
export interface KnowledgeDetail {
  messageId: number;
  status: KnowledgeState;
  sources: KnowledgeSource[];
  canRetry: boolean;
  errorCode?: string | null;
}
export interface KnowledgePreferences {
  enabled: boolean;
  photoEnabled: boolean;
  available: boolean;
  disclosure: string;
  limits: { savesPerDay: number; photosPerDay: number; searchesPerDay: number; linksPerSave: number; backfillBatch: number };
}
export interface KnowledgeCitation {
  id: string;
  messageId: number;
  sourceId: string;
  title: string;
  url?: string;
  excerpt: string;
  kind: KnowledgeSource["kind"];
  coverage: KnowledgeState;
}
export interface KnowledgeSearchResponse {
  messages: (Message & { knowledgeStatus?: KnowledgeState })[];
  query: string;
  aiSummary: string | null;
  answerStatus: "ready" | "unavailable" | "insufficient" | "disabled";
  citations: KnowledgeCitation[];
  searchMethod: "hybrid" | "keyword";
  filters: { boardId?: number; from?: string; to?: string; tags: string[] };
  warnings: string[];
  coverage: { total: number; ready: number; partial: number; pending: number; failed: number; unindexed: number };
}
