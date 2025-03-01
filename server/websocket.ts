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

      // Send a ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      ws.on("close", () => {
        this.clients.delete(ws);
        clearInterval(pingInterval);
        log("WebSocket client disconnected");
      });

      ws.on("error", (error) => {
        log(`WebSocket error: ${error.message}`);
        this.clients.delete(ws);
        clearInterval(pingInterval);
      });

      // Handle pong responses
      ws.on("pong", () => {
        // Connection is alive
      });
    });

    this.wss.on("error", (error) => {
      log(`WebSocket server error: ${error.message}`);
    });
  }

  broadcastNewMessage() {
    const message = JSON.stringify({ type: "NEW_MESSAGE" });
    let disconnectedClients = new Set<WebSocket>();

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          log(`Error broadcasting to client: ${error.message}`);
          disconnectedClients.add(client);
        }
      } else {
        disconnectedClients.add(client);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach(client => {
      this.clients.delete(client);
      log("Removed disconnected client from clients set");
    });
  }
}