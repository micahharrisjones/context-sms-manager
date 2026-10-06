import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../shared/schema";
vi.mock("../../client/src/components/messages/DeleteMessageModal", () => ({ DeleteMessageModal: () => null }));
vi.mock("../../client/src/components/messages/EditMessageModal", () => ({ EditMessageModal: () => null }));
vi.mock("../../client/src/components/messages/ImageModal", () => ({ ImageModal: () => null }));
vi.mock("../../client/src/components/messages/CommentsSection", () => ({ CommentsSection: () => null }));
import { MessageCard } from "../../client/src/components/messages/MessageCard";

function render(message: Partial<Message>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fixture = {
    id: 1, userId: 1, content: "", tags: ["movies"], timestamp: new Date("2026-09-16T12:00:00Z"),
    ...message,
  } as Message;
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(Router, { hook: () => ["/", () => undefined] as [string, (to: string) => void] },
        React.createElement(MessageCard, { message: fixture }))));
  } finally { client.clear(); }
}

describe("actual message-card rendering", () => {
  it("renders a legacy IMDb poster immediately, even without a source field or TMDB response", () => {
    const url = "https://www.imdb.com/title/tt0133093/";
    const html = render({ content: url, ogTitle: "The Matrix", ogImage: "https://example.com/matrix.jpg", ogSourceUrl: null });
    expect(html).toContain('src="https://example.com/matrix.jpg"');
    expect(html).toContain("The Matrix");
    expect(html.split(`href="${url}"`).length - 1).toBe(1);
  });
  it("does not show a stored poster on a different IMDb link", () => {
    const html = render({ content: "https://www.imdb.com/title/tt0944947/", ogTitle: "The Matrix", ogImage: "https://example.com/matrix.jpg", ogSourceUrl: "https://www.imdb.com/title/tt0133093/" });
    expect(html).not.toContain("matrix.jpg");
  });
  it("shows only one Instagram link when metadata is unavailable", () => {
    const url = "https://www.instagram.com/p/DcmCeLDGvLm/";
    const html = render({ content: url, tags: ["politics"] });
    expect(html.split(`href="${url}"`).length - 1).toBe(1);
  });
});
