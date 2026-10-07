import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IStorage } from "../storage";

const fixture = vi.hoisted(() => ({
  enabled: true, budget: true, fail: false, intent: "search", query: "pasta",
  completion: vi.fn(), knowledge: vi.fn(), log: vi.fn(),
}));
vi.mock("openai", () => ({ default: class {
  chat = { completions: { create: fixture.completion } };
} }));
vi.mock("../vite", () => ({ log: fixture.log }));
vi.mock("../embedding-service", () => ({ embeddingService: {} }));
vi.mock("../knowledge/provider", () => ({ providerAvailable: () => true }));
vi.mock("../knowledge/repository", () => ({
  settings: async () => ({ enabled: fixture.enabled }),
  takeBudget: async () => fixture.budget,
}));
vi.mock("../knowledge/sms-query", async original => ({
  ...await original<typeof import("../knowledge/sms-query")>(),
  queryKnowledgeSms: fixture.knowledge,
}));
vi.mock("../knowledge/search", () => ({ searchLinkedKnowledge: vi.fn() }));
vi.mock("../short-link-service", () => ({ shortLinkService: { createShortLink: async () => "synthetic" } }));
vi.mock("../magic-link-service", () => ({ MagicLinkService: { createMagicLink: async () => ({ url: "https://app.example/synthetic" }) } }));
import { asideAIService } from "../aside-ai-service";

const storage = {
  getUserById: async () => ({ firstName: "Fixture" }),
  getMessages: async () => [], getTags: async () => [], getSharedBoards: async () => [],
} as unknown as IStorage;
describe("SMS intent routing to saved knowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.enabled = true; fixture.budget = true; fixture.fail = false; fixture.intent = "search"; fixture.query = "pasta";
    fixture.completion.mockImplementation(async () => {
      if (fixture.fail) throw new Error("synthetic provider outage");
      return { choices: [{ message: { content: JSON.stringify({ intent: fixture.intent, query: fixture.query }) } }] };
    });
    fixture.knowledge.mockImplementation(async (_q, _id, intent = "search") => ({
      intent, response: "1. Creamy Baked Pasta\nhttps://recipes.example/original", smsParts: ["synthetic reply"], searchPerformed: true,
    }));
  });
  it.each(["search", "summarize", "recommend"])("routes %s to source retrieval rather than the old message index", async intent => {
    fixture.intent = intent;
    const response = await asideAIService.processQuery("what was that recipe I saved with pasta?", 7, storage);
    expect(fixture.knowledge).toHaveBeenCalledWith("pasta", 7, ...(intent === "search" ? [] : [intent]));
    expect(response.response).toContain("https://recipes.example/original");
    expect(JSON.stringify(fixture.log.mock.calls)).not.toContain("pasta");
  });
  it.each(["disabled", "quota", "outage", "unknown"])("keeps recall usable when classification is %s", async state => {
    if (state === "disabled") fixture.enabled = false;
    if (state === "quota") fixture.budget = false;
    if (state === "outage") fixture.fail = true;
    if (state === "unknown") fixture.intent = "unknown";
    await asideAIService.processQuery("find pasta", 7, storage);
    expect(fixture.knowledge).toHaveBeenCalledWith("find pasta", 7);
    if (state === "disabled" || state === "quota") expect(fixture.completion).not.toHaveBeenCalled();
  });
  it("routes a topic-specific recipe count to retrieval instead of global statistics", async () => {
    fixture.intent = "analyze";
    await asideAIService.processQuery("how many pasta recipes have I saved?", 7, storage);
    expect(fixture.knowledge).toHaveBeenCalledWith("pasta", 7);
  });
  it("retains deterministic help and login commands without calling knowledge search", async () => {
    fixture.enabled = false;
    const help = await asideAIService.processQuery("how do I create a board?", 7, storage);
    expect(help.intent).toBe("help"); expect(help.response).toMatch(/board|hashtag/i);
    const login = await asideAIService.processQuery("send me a login link", 7, storage);
    expect(login.intent).toBe("login"); expect(login.response).toContain("https://app.example/synthetic");
    expect(fixture.knowledge).not.toHaveBeenCalled(); expect(fixture.completion).not.toHaveBeenCalled();
  });
});
