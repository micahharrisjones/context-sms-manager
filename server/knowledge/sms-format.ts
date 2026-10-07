import type { Message } from "@shared/schema";
import { isGenericPreview, storedPreviewMatches } from "@shared/preview-urls";
import { fingerprint } from "./core";

export interface SmsSavedLink {
  messageId: number;
  fingerprint: string;
  title: string;
  url: string;
}
function cleanTitle(value: string) {
  return value.replace(/https?:\/\/\S+/gi, "").replace(/[\r\n\t\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 100);
}
export function savedLink(m: Message, pages: { title: string; url: string }[], urls: string[]): SmsSavedLink | null {
  const page = pages.find(page => urls.includes(page.url));
  const url = page?.url || urls[0];
  if (!url) return null;
  let title = page && !isGenericPreview(url, page.title) ? cleanTitle(page.title) : "";
  if (!title && storedPreviewMatches(m.ogSourceUrl, url, m.content) && !isGenericPreview(url, m.ogTitle)) {
    title = cleanTitle(m.ogTitle || "");
  }
  if (!title) {
    const note = m.content.replace(/https?:\/\/\S+/gi, "").replace(/#[\p{L}\p{N}_-]+/gu, "");
    title = cleanTitle(note);
  }
  if (!title) {
    const parsed = new URL(url);
    title = cleanTitle(`${parsed.hostname}${parsed.pathname !== "/" ? ` — ${parsed.pathname.split("/").filter(Boolean).at(-1)!.replace(/[-_]/g, " ")}` : ""}`);
  }
  return { messageId: m.id, fingerprint: fingerprint(m), title: title || "Saved link", url };
}

export function formatKnowledgeSms(result: {
  links: SmsSavedLink[]; count: number; exact: boolean; incomplete: number; keywordOnly: boolean;
}): string[] {
  const { links, count, exact, incomplete, keywordOnly } = result;
  if (!links.length) return [
    `I couldn't find matching saved links.${keywordOnly ? " AI search is unavailable or off; I searched saved text instead." : ""}${incomplete ? " Some saves have not been fully read yet." : ""} Photos and notes without an original URL aren't included in this link list.`,
  ];
  const quantity = exact ? `${count}` : `at least ${count}`;
  const latest = count > links.length || !exact ? ` I'll give you the ${links.length} latest ones:` : ` Here ${links.length === 1 ? "it is" : "they are"}:`;
  const blocks = [`You saved ${quantity} matching ${count === 1 && exact ? "link" : "links"}.${latest}`];
  links.forEach((link, i) => {
    // Never shorten or truncate the original URL. Twilio limits each API body to
    // 1,600 characters; exceptionally long URLs get an explicit explanation.
    blocks.push(`${i + 1}. ${link.title}\n${link.url.length <= 1400 ? link.url : "The original URL is too long to send intact by SMS. Open this save in Aside."}`);
  });
  if (keywordOnly || incomplete) blocks.push([
    keywordOnly ? "AI search is unavailable or off; these are saved-text matches." : "",
    incomplete ? "Some saves have not been fully read yet; this isn't a count of everything you may have saved on this topic." : "",
  ].filter(Boolean).join(" "));
  const parts: string[] = [];
  for (const block of blocks) {
    const last = parts.at(-1);
    if (last && last.length + block.length + 2 <= 1600) parts[parts.length - 1] = `${last}\n\n${block}`;
    else parts.push(block);
  }
  return parts;
}
