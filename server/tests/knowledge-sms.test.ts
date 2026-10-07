import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import type { Message } from "@shared/schema";
import { formatKnowledgeSms, savedLink } from "../knowledge/sms-format";
import { createHeyAsideWebhook, heyAsideQuery, validTwilioSignature } from "../hey-aside-webhook";

const token = "synthetic-test-token";
const phone = "+12025550123";
function signature(url: string, body: Record<string, string>) {
  return createHmac("sha1", token).update(url + Object.keys(body).sort().map(key => key + body[key]).join("")).digest("base64");
}
function command(body = "Hey Aside, what was that recipe I saved with pasta?", suffix = "1") {
  return { Body: body, From: phone, MessageSid: `SM${suffix.padStart(32, "0")}`, AccountSid: `AC${"0".repeat(32)}` };
}
function setup(overrides: Record<string, any> = {}) {
  const jobs: (() => Promise<void>)[] = [];
  const deps = {
    token: () => token,
    user: vi.fn(async () => ({ id: 123 })),
    query: vi.fn(async () => ({ intent: "search", response: "1. Creamy Pasta\nhttps://recipes.example/pasta?ref=sms", searchPerformed: true })),
    send: vi.fn(async () => true),
    track: vi.fn(async () => undefined),
    log: vi.fn(),
    defer: (work: () => Promise<void>) => { jobs.push(work); },
    ...overrides,
  };
  const handler = createHeyAsideWebhook(deps);
  const app = express(); app.use(express.json());
  app.post("/api/webhook/twilio", handler);
  function post(body: Record<string, string>, path = "/api/webhook/twilio", valid = true) {
    return request(app).post(path).set("x-forwarded-proto", "https").set("x-forwarded-host", "sms.example")
      .set("x-twilio-signature", valid ? signature(`https://sms.example${path}`, body) : "forged").send(body);
  }
  return { deps, post, jobs };
}

describe("Hey Aside commands and original-link SMS replies", () => {
  it("accepts case, commas and separators without accepting unrelated saves", () => {
    expect(heyAsideQuery(" Hey Aside, pasta?")).toBe("pasta?");
    expect(heyAsideQuery("HEY ASIDE — pasta")).toBe("pasta");
    expect(heyAsideQuery("Hey Aside")).toBe("");
    expect(heyAsideQuery("I saved Hey Aside")).toBeNull();
    expect(heyAsideQuery("Hey Asidepasta")).toBeNull();
    expect(heyAsideQuery(undefined)).toBeNull();
  });
  it("verifies all fields, URL and signature without accepting tampered senders", () => {
    const body = command();
    const url = "https://sms.example/api/webhook/twilio";
    expect(validTwilioSignature(url, body, signature(url, body), token)).toBe(true);
    expect(validTwilioSignature(url, { ...body, From: "+12025550124" }, signature(url, body), token)).toBe(false);
    expect(validTwilioSignature(url + "?x=1", body, signature(url, body), token)).toBe(false);
    expect(validTwilioSignature(url, body, "forged", token)).toBe(false);
    expect(validTwilioSignature(url, { ...body, NumMedia: 1 }, signature(url, body), token)).toBe(false);
  });
  it("acks before searching, maps the sender's account, and suppresses duplicate delivery", async () => {
    const { post, deps, jobs } = setup(); const body = command();
    expect((await post(body)).status).toBe(200);
    expect(deps.query).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
    expect((await post(body)).status).toBe(200); expect(jobs).toHaveLength(1);
    await jobs[0]();
    expect(deps.user).toHaveBeenCalledWith(phone);
    expect(deps.query).toHaveBeenCalledWith("what was that recipe I saved with pasta?", 123);
    expect(deps.send).toHaveBeenCalledWith(phone, expect.stringContaining("https://recipes.example/pasta?ref=sms"));
    const analytics = JSON.stringify(deps.track.mock.calls.map(call => call[2]));
    expect(analytics).not.toContain("pasta"); expect(analytics).not.toContain("https:"); expect(analytics).not.toContain("query\"");
    expect(deps.log).not.toHaveBeenCalled();
  });
  it("rejects unsigned commands or missing configuration before looking up a library", async () => {
    const fixture = setup();
    expect((await fixture.post(command(), undefined, false)).status).toBe(403);
    expect(fixture.deps.user).not.toHaveBeenCalled(); expect(fixture.jobs).toHaveLength(0);
    const missing = setup({ token: () => "" });
    expect((await missing.post(command())).status).toBe(503);
    expect(missing.deps.user).not.toHaveBeenCalled();
  });
  it("does not search for empty, oversized or new-user commands", async () => {
    for (const body of ["Hey Aside", `Hey Aside, ${"a".repeat(801)}`]) {
      const { post, jobs, deps } = setup();
      await post(command(body)); await jobs[0]();
      expect(deps.query).not.toHaveBeenCalled(); expect(deps.send).toHaveBeenCalledTimes(1);
    }
    const newcomer = setup({ user: vi.fn(async () => undefined) });
    await newcomer.post(command()); await newcomer.jobs[0]();
    expect(newcomer.deps.query).not.toHaveBeenCalled();
    expect(newcomer.deps.send).toHaveBeenCalledWith(phone, expect.stringContaining("Save a link or note first"));
  });
  it("does not let analytics outages prevent replies or count failed sends as sent", async () => {
    const analyticsDown = setup({ track: vi.fn(async () => { throw new Error("synthetic"); }) });
    await analyticsDown.post(command()); await analyticsDown.jobs[0]();
    expect(analyticsDown.deps.send).toHaveBeenCalledTimes(1);
    const failed = setup({ send: vi.fn(async () => false) });
    await failed.post(command()); await failed.jobs[0]();
    expect(failed.deps.track.mock.calls.map(call => call[0])).not.toContain("Hey_Aside_Response_Sent");
  });
  it("enforces a per-user burst limit and sends split replies in order", async () => {
    const fixture = setup({ query: vi.fn(async () => ({ intent: "search", response: "unused", smsParts: ["first", "second"] })) });
    for (let i = 1; i <= 11; i++) await fixture.post(command("Hey Aside, pasta", String(i)));
    for (const job of fixture.jobs) await job();
    expect(fixture.deps.query).toHaveBeenCalledTimes(10);
    expect(fixture.deps.send.mock.calls.slice(0, 2).map(call => call[1])).toEqual(["first", "second"]);
    expect(fixture.deps.send).toHaveBeenLastCalledWith(phone, expect.stringContaining("wait a minute"));
  });
  it("pairs each title with its matching saved URL rather than another link's preview", () => {
    const first = "https://recipes.example/first?ref=sms", second = "https://recipes.example/second?ref=original";
    const m = { id: 1, content: `${first} ${second}`, tags: [], mediaUrl: null, mediaType: null,
      ogTitle: "First recipe", ogSourceUrl: first } as Message;
    expect(savedLink(m, [{ title: "Creamy Baked Pasta", url: second }], [first, second])).toMatchObject({ title: "Creamy Baked Pasta", url: second });
    expect(savedLink(m, [{ title: "Unrelated title", url: "https://other.example/" }], [first, second])).not.toMatchObject({ title: "Unrelated title" });
    expect(savedLink({ ...m, ogTitle: "Wrong preview", ogSourceUrl: second }, [], [first, second])?.title).not.toBe("Wrong preview");
  });
  it("formats exact/lower-bound counts and fewer than five without inventing entries", () => {
    const links = Array.from({ length: 5 }, (_, i) => ({ messageId: i, fingerprint: "fixture", title: `Pasta ${i}`, url: `https://recipes.example/${i}?ref=sms` }));
    const result = { links, count: 27, exact: true, incomplete: 0, keywordOnly: false };
    const text = formatKnowledgeSms(result).join("\n\n");
    expect(text).toContain("27 matching links"); expect(text).toContain("5 latest ones");
    links.forEach(link => expect(text).toContain(`${link.title}\n${link.url}`));
    expect(formatKnowledgeSms({ ...result, exact: false }).join()).toContain("at least 27");
    expect(formatKnowledgeSms({ ...result, count: 1, links: links.slice(0, 1) }).join()).toContain("1 matching link");
    expect(formatKnowledgeSms({ ...result, count: 0, links: [], incomplete: 1, keywordOnly: true }).join()).toContain("not been fully read");
  });
  it("splits long replies without breaking original URLs or silently truncating them", () => {
    const links = Array.from({ length: 5 }, (_, i) => ({ messageId: i, fingerprint: "fixture", title: `Pasta ${i}`,
      url: `https://recipes.example/${i}?original=${"a".repeat(1000)}` }));
    const parts = formatKnowledgeSms({ links, count: 5, exact: true, incomplete: 0, keywordOnly: false });
    expect(parts.length).toBeGreaterThan(1); expect(parts.every(part => part.length <= 1600)).toBe(true);
    links.forEach(link => expect(parts.some(part => part.includes(link.url))).toBe(true));
    expect(formatKnowledgeSms({ links: [{ ...links[0], url: links[0].url + "x".repeat(600) }], count: 1,
      exact: true, incomplete: 0, keywordOnly: false }).join()).toContain("too long to send intact");
  });
});
