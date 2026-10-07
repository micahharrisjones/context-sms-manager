/**
 * Standalone browser-test server. Never imported by server/index.ts or routes.ts.
 * No database, production auth, enrichment, analytics or provider clients.
 */
import express from "express";
import session from "express-session";
import { createServer as createHttpServer } from "node:http";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";
import theme from "@replit/vite-plugin-shadcn-theme-json";
import path from "node:path";
import { WebSocketServer } from "ws";
import type { Message } from "../../../shared/schema";

if (process.env.NODE_ENV !== "test" || process.env.PREVIEW_BROWSER_FIXTURES !== "1") {
  throw new Error("Preview fixture server requires NODE_ENV=test and explicit fixture opt-in");
}

declare module "express-session" {
  interface SessionData {
    previewMessages?: Message[];
  }
}

const app = express();
app.use(express.json());
app.use(session({
  name: "preview-fixture",
  secret: "isolated-browser-test-session-not-a-production-secret",
  store: new session.MemoryStore(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: false },
}));

app.get("/__fixtures/ready", (_req, res) => res.json({ ready: true }));
app.post("/__fixtures/session", (req, res, next) => {
  // Fresh session and per-session fixture state for every browser test.
  req.session.regenerate(error => {
    if (error) return next(error);
    req.session.userId = 900001;
    req.session.previewMessages = req.body.messages;
    req.session.save(error => error ? next(error) : res.sendStatus(204));
  });
});
app.get("/api/auth/session", (req, res) =>
  res.json({ authenticated: !!req.session.userId, userId: req.session.userId }));
app.use("/api", (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Fixture session required" });
  next();
});
app.get("/api/profile", (_req, res) => res.json({
  id: 900001, phoneNumber: "fixture-only", firstName: "Preview", lastName: "Tester",
  displayName: "Preview Tester", avatarUrl: null,
}));
app.get("/api/knowledge/library-scan", (_req, res) => res.json({
  status: "dismissed", total: 0, processed: 0, indexed: 0, partial: 0, notIndexed: 0, reasons: [],
  available: true, photoEnabled: false, analysisEnabled: true,
}));
app.get("/api/tags", (_req, res) => res.json([{ tag: "previews", count: 1 }]));
app.get("/api/shared-boards", (_req, res) => res.json([
  { id: 900002, name: "previews", role: "owner", createdBy: 900001 },
]));
app.get(["/api/messages", "/api/messages/tag/previews", "/api/shared-boards/previews/messages"],
  (req, res) => res.json(req.session.previewMessages || []));
app.get("/api/shared-boards/previews/messages/:id/comments", (_req, res) => res.json([]));
app.patch("/api/messages/:id", (req, res) => {
  const message = req.session.previewMessages?.find(message => message.id === Number(req.params.id));
  if (!message) return res.sendStatus(404);
  Object.assign(message, {
    content: req.body.content, tags: req.body.tags,
    ogTitle: null, ogDescription: null, ogImage: null, ogSourceUrl: null,
    ogSiteName: null, ogIsBlocked: null, ogIsFallback: null,
  });
  res.json(message);
});
app.get("/api/admin/stats", (_req, res) => res.sendStatus(403));
app.get("/api/admin/feedback/unread-count", (_req, res) => res.json({ count: 0 }));
// A forgotten browser stub fails explicitly; there is no live upstream fallback.
app.use("/api", (_req, res) => res.status(501).json({ error: "Missing browser fixture response" }));

const server = createHttpServer(app);
const sockets = new WebSocketServer({ server, path: "/ws/messages" });
sockets.on("connection", socket => socket.on("message", () => {}));
const vite = await createViteServer({
  configFile: false,
  root: path.resolve("client"),
  plugins: [react(), theme()],
  resolve: { alias: {
    "@": path.resolve("client/src"),
    "@shared": path.resolve("shared"),
  } },
  server: { middlewareMode: true, hmr: false },
  appType: "spa",
});
app.use(vite.middlewares);
server.listen(5017, "127.0.0.1", () => console.log("Preview fixture server ready"));
async function stop() {
  sockets.close();
  await vite.close();
  server.close(() => process.exit(0));
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
