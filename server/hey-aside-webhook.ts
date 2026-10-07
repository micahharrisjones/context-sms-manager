import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export function heyAsideQuery(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const prefix = /^\s*hey\s+aside\b[\s,:;.!?—–-]*/i;
  return prefix.test(body) ? body.replace(prefix, "").trim() : null;
}

export function validTwilioSignature(url: string, body: Record<string, unknown>, signature: string, token: string): boolean {
  if (!token || !signature || Object.values(body).some(value => typeof value !== "string")) return false;
  const data = url + Object.keys(body).sort().map(key => key + body[key]).join("");
  const expected = Buffer.from(createHmac("sha1", token).update(data, "utf8").digest("base64"));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

interface CommandResponse {
  intent: string; response: string; smsParts?: string[]; searchPerformed?: boolean;
}
interface Dependencies {
  token: () => string;
  user: (phone: string) => Promise<{ id: number } | undefined>;
  query: (text: string, userId: number) => Promise<CommandResponse>;
  send: (phone: string, text: string) => Promise<boolean>;
  track: (name: string, phone: string, properties: Record<string, string | number | boolean>) => Promise<unknown>;
  log: (message: string) => void;
  defer?: (work: () => Promise<void>) => void;
}

export function createHeyAsideWebhook(deps: Dependencies) {
  const seen = new Set<string>();
  const recent = new Map<number, number[]>();
  const defer = deps.defer || (work => { setImmediate(() => { void work(); }); });
  return async (req: Request, res: Response) => {
    const query = heyAsideQuery(req.body?.Body);
    if (query === null) return res.status(400).json({ error: "Not an Aside command." });
    const token = deps.token();
    if (!token) return res.status(503).json({ error: "SMS verification is not configured." });
    const protocol = (req.get("x-forwarded-proto") || req.protocol).split(",")[0].trim();
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    const url = `${protocol}://${host}${req.originalUrl}`;
    if (!validTwilioSignature(url, req.body, req.get("x-twilio-signature") || "", token)) {
      return res.status(403).json({ error: "Invalid SMS signature." });
    }
    const { From: phone, MessageSid: sid } = req.body;
    if (typeof phone !== "string" || !/^\+[1-9]\d{7,14}$/.test(phone) ||
      typeof sid !== "string" || !/^(SM|MM)[a-f0-9]{32}$/i.test(sid)) {
      return res.status(400).json({ error: "Invalid SMS sender or message identifier." });
    }
    if (seen.has(sid)) return res.type("text/xml").send("<Response/>");
    try {
      const user = await deps.user(phone);
      // A second request may have arrived while the account lookup was pending.
      if (seen.has(sid)) return res.type("text/xml").send("<Response/>");
      seen.add(sid);
      if (seen.size > 1000) seen.delete(seen.values().next().value!);
      const attempts = user ? (recent.get(user.id) || []).filter(time => time > Date.now() - 60_000) : [];
      const throttled = attempts.length >= 10;
      if (user && !throttled) {
        attempts.push(Date.now()); recent.set(user.id, attempts);
        if (recent.size > 1000) recent.delete(recent.keys().next().value!);
      }
      // Acknowledge first: model calls must not make Twilio retry its webhook.
      res.type("text/xml").send("<Response/>");
      defer(async () => {
        try {
          if (!user) {
            await deps.send(phone, "Welcome to Aside. Save a link or note first to start your library, then text Hey Aside followed by your question.");
            return;
          }
          if (throttled) { await deps.send(phone, "Please wait a minute before asking another question."); return; }
          if (!query) {
            await deps.send(phone, "Ask me about your saves. Try: Hey Aside, what was that recipe I saved with pasta?");
            return;
          }
          if (query.length > 800) { await deps.send(phone, "Please keep your question under 800 characters."); return; }
          const response = await deps.query(query, user.id);
          const intent = ["search", "summarize", "recommend", "analyze", "help", "login", "unknown"].includes(response.intent)
            ? response.intent : "unknown";
          await deps.track("Hey_Aside_Query_Submitted", phone, { queryLength: query.length, questionType: intent, intent })
            .catch(() => deps.log("[SMS] Question analytics unavailable."));
          const parts = response.smsParts || [response.response];
          let delivered = true;
          for (const part of parts.slice(0, 8)) {
            if (!await deps.send(phone, part)) { delivered = false; break; }
          }
          if (delivered) {
            await deps.track("Hey_Aside_Response_Sent", phone, { intent, questionType: intent,
              searchPerformed: response.searchPerformed || false, partCount: parts.length })
              .catch(() => deps.log("[SMS] Response analytics unavailable."));
          } else deps.log("[SMS] Answer delivery failed.");
        } catch {
          deps.log("[SMS] Command could not be completed.");
          await deps.send(phone, "Sorry, I couldn't search your saves right now. Please try again.")
            .catch(() => deps.log("[SMS] Error notice delivery failed."));
        }
      });
    } catch {
      deps.log("[SMS] Account lookup unavailable.");
      if (!res.headersSent) res.status(503).json({ error: "Please retry later." });
    }
  };
}
