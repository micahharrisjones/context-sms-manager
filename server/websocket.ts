import { WebSocket, WebSocketServer } from "ws";
import { type Server } from "http";
import { log } from "./vite";

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/messages"
    });
    this.clients = new Set();

    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      log("WebSocket client connected");

      ws.on("close", () => {
        this.clients.delete(ws);
        log("WebSocket client disconnected");
      });
    });
  }

  broadcastNewMessage() {
    const message = JSON.stringify({ type: "NEW_MESSAGE" });
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}