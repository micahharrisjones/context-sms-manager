import { formatKnowledgeSms } from "./sms-format";
import { searchLinkedKnowledge } from "./search";

export async function queryKnowledgeSms(query: string, userId: number, intent: "search" | "summarize" | "recommend" = "search") {
  const result = await searchLinkedKnowledge(userId, query, AbortSignal.timeout(60_000));
  const smsParts = formatKnowledgeSms(result);
  return { intent, response: smsParts.join("\n\n"), smsParts, searchPerformed: true };
}

export function fallbackSmsIntent(query: string): "search" | "help" | "login" | "analyze" {
  if (/\b(login|log in|sign in)\s*(link)?\b/i.test(query) && !/\b(saved|find|about|article)\b/i.test(query) ||
    /(?:send|where|what).*(?:dashboard|login) link/i.test(query)) return "login";
  if (/^(how (?:do|can) i|how does aside|help\b)/i.test(query.trim())) return "help";
  if (/^(how many|list (?:all )?my|what).*boards?\b/i.test(query.trim())) return "analyze";
  return "search";
}

export function isGlobalSmsStatsQuery(query: string): boolean {
  return /\bboards?\b/i.test(query) ||
    /^(?:how many|count)\s+(?:total\s+)?(?:saved\s+)?(?:items|messages|saves|links)(?:\s+(?:do i have|have i saved|did i save|in (?:my )?(?:library|account)))?\??$/i.test(query.trim());
}
