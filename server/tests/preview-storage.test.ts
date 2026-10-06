import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { users, messages, sharedBoards, boardMemberships, messageEmbeddings } from "../../shared/schema";
vi.mock("../vite", () => ({ log: vi.fn() }));
import { db, pool } from "../db";
import { storage } from "../storage";

const tag = `preview-${randomUUID()}`;
let userIds: number[] = [];
let boardIds: number[] = [];
let ownMessageId: number;
let otherMessageId: number;

beforeAll(async () => {
  const createdUsers = await db.insert(users).values([0, 1, 2].map((index) => ({
    phoneNumber: `test-${randomUUID().slice(0, 12)}-${index}`,
  }))).returning();
  userIds = createdUsers.map(user => user.id);
  const boards = await db.insert(sharedBoards).values([
    { name: tag, createdBy: userIds[0] }, { name: tag, createdBy: userIds[2] },
  ]).returning();
  boardIds = boards.map(board => board.id);
  await db.insert(boardMemberships).values([
    { boardId: boardIds[0], userId: userIds[0], role: "owner" },
    { boardId: boardIds[0], userId: userIds[1] },
    { boardId: boardIds[1], userId: userIds[2], role: "owner" },
  ]);
  const createdMessages = await db.insert(messages).values([
    { content: "https://example.org/old", senderId: "fixture", userId: userIds[0], tags: [tag],
      ogTitle: "Old title", ogDescription: "Old description", ogImage: "https://example.org/image.png",
      ogSourceUrl: "https://example.org/old", enrichmentStatus: "completed" },
    { content: "Other board confidential fixture", senderId: "fixture", userId: userIds[2], tags: [tag] },
  ]).returning();
  ownMessageId = createdMessages[0].id;
  otherMessageId = createdMessages[1].id;
});

afterAll(async () => {
  if (userIds.length) {
    const fixtures = await db.select({ id: messages.id }).from(messages).where(inArray(messages.userId, userIds));
    if (fixtures.length) await db.delete(messageEmbeddings).where(inArray(messageEmbeddings.messageId, fixtures.map(row => row.id)));
    await db.delete(messages).where(inArray(messages.userId, userIds));
    await db.delete(boardMemberships).where(inArray(boardMemberships.userId, userIds));
    if (boardIds.length) await db.delete(sharedBoards).where(inArray(sharedBoards.id, boardIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
  await pool.end();
});

describe("shared-board isolation", () => {
  it("does not include messages from another board with the same name", async () => {
    const result = await storage.getSharedMessages(userIds[1], tag);
    expect(result.map(message => message.id)).toContain(ownMessageId);
    expect(result.map(message => message.id)).not.toContain(otherMessageId);
    expect(result.find(message => message.id === ownMessageId)?.ogSourceUrl).toBe("https://example.org/old");
  });
  it("scopes notification recipients and SMS recipients to the sender's board", async () => {
    expect(await storage.getUsersForSharedBoardNotification([tag], userIds[0])).toEqual(expect.arrayContaining([userIds[0], userIds[1]]));
    expect(await storage.getUsersForSharedBoardNotification([tag], userIds[0])).not.toContain(userIds[2]);
    const phones = await storage.getBoardMembersPhoneNumbers(tag, userIds[0]);
    const [other] = await db.select().from(users).where(eq(users.id, userIds[2]));
    expect(phones).not.toContain(other.phoneNumber);
    expect(phones.length).toBe(1);
  });
  it("fails closed when one user belongs to two same-named boards", async () => {
    await db.insert(boardMemberships).values({ boardId: boardIds[1], userId: userIds[1] });
    try {
      await expect(storage.getSharedMessages(userIds[1], tag)).rejects.toThrow("Ambiguous");
    } finally {
      await db.delete(boardMemberships).where(eq(boardMemberships.boardId, boardIds[1]));
      await db.insert(boardMemberships).values({ boardId: boardIds[1], userId: userIds[2], role: "owner" });
    }
  });
});

describe("edited previews and stale background results", () => {
  const preview = {
    ogSourceUrl: "https://example.org/old", ogTitle: "Late old title",
    ogDescription: "Old description", ogImage: null, ogSiteName: "Example", enrichmentStatus: "completed",
  };
  it("clears the preview immediately when changing links", async () => {
    const updated = await storage.updateMessage(ownMessageId, "https://example.org/new", [tag]);
    expect(updated).toMatchObject({
      ogTitle: null, ogDescription: null, ogImage: null, ogSourceUrl: null,
      ogIsFallback: null, ogIsBlocked: null, enrichmentStatus: "pending", enrichedAt: null,
    });
  });
  it("rejects completion and failure status from the previous content", async () => {
    expect(await storage.updateMessageEnrichment(ownMessageId, preview, "https://example.org/old")).toBe(false);
    await storage.updateMessageEnrichmentStatus(ownMessageId, "failed", "https://example.org/old");
    expect(await storage.getMessageById(ownMessageId)).toMatchObject({ ogTitle: null, enrichmentStatus: "pending" });
  });
  it("accepts metadata only for the current content", async () => {
    expect(await storage.updateMessageEnrichment(ownMessageId, {
      ...preview, ogSourceUrl: "https://example.org/new", ogTitle: "New title",
    }, "https://example.org/new")).toBe(true);
    expect(await storage.getMessageById(ownMessageId)).toMatchObject({ ogTitle: "New title", ogSourceUrl: "https://example.org/new" });
  });
  it("removes old search metadata when all links are deleted", async () => {
    await storage.updateMessage(ownMessageId, "No link anymore", [tag]);
    expect(await storage.getMessageById(ownMessageId)).toMatchObject({ ogTitle: null, ogSourceUrl: null, enrichmentStatus: null });
    // Old background embeddings cannot reappear after the edit.
    await storage.saveMessageEmbedding(ownMessageId, [0.1], "https://example.org/new");
    expect(await storage.getMessageEmbedding(ownMessageId)).toBeNull();
  });
});
