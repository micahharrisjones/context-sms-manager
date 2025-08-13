import { WebSocket, WebSocketServer } from "ws";
import { type Server } from "http";
import { log } from "./vite";

interface ClientConnection {
  socket: WebSocket;
  userId?: number;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientConnection>;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/messages"
    });
    this.clients = new Map();

    this.wss.on("connection", (ws, request) => {
      const clientConnection: ClientConnection = { socket: ws };
      this.clients.set(ws, clientConnection);
      log("WebSocket client connected");

      // Send a ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 30000);

      // Handle incoming messages to set user ID
      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "IDENTIFY" && data.userId) {
            clientConnection.userId = data.userId;
            log(`WebSocket client identified as user ${data.userId}`);
          }
        } catch (error) {
          log(`Error parsing WebSocket message: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        clearInterval(pingInterval);
        log("WebSocket client disconnected");
      });

      ws.on("error", (error) => {
        log(`WebSocket error: ${error instanceof Error ? error.message : String(error)}`);
        this.clients.delete(ws);
        clearInterval(pingInterval);
      });

      // Handle pong responses
      ws.on("pong", () => {
        // Connection is alive
      });
    });

    this.wss.on("error", (error) => {
      log(`WebSocket server error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  broadcastNewMessageToUser(userId: number) {
    const message = JSON.stringify({ type: "NEW_MESSAGE" });
    let disconnectedClients = new Set<WebSocket>();
    let successfulBroadcasts = 0;
    let targetClients = 0;

    log(`Broadcasting to user ${userId}`);

    this.clients.forEach((clientConnection, ws) => {
      if (clientConnection.userId === userId) {
        targetClients++;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(message);
            successfulBroadcasts++;
            log(`Successfully sent WebSocket message to user ${userId}`);
          } catch (error) {
            log(`Error broadcasting to user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
            disconnectedClients.add(ws);
          }
        } else {
          log(`Client for user ${userId} in non-open state: ${ws.readyState}`);
          disconnectedClients.add(ws);
        }
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach(ws => {
      this.clients.delete(ws);
      log("Removed disconnected client from clients set");
    });

    log(`Broadcast complete for user ${userId}. ${targetClients} target clients, ${successfulBroadcasts} successful, ${disconnectedClients.size} clients removed`);
  }

  broadcastNewMessageToUsers(userIds: number[]) {
    if (userIds.length === 0) return;
    
    const message = JSON.stringify({ type: "NEW_MESSAGE" });
    let disconnectedClients = new Set<WebSocket>();
    let successfulBroadcasts = 0;
    let targetClients = 0;

    log(`Broadcasting to ${userIds.length} users: [${userIds.join(', ')}]`);

    this.clients.forEach((clientConnection, ws) => {
      if (clientConnection.userId && userIds.includes(clientConnection.userId)) {
        targetClients++;
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(message);
            successfulBroadcasts++;
            log(`Successfully sent WebSocket message to user ${clientConnection.userId}`);
          } catch (error) {
            log(`Error broadcasting to user ${clientConnection.userId}: ${error instanceof Error ? error.message : String(error)}`);
            disconnectedClients.add(ws);
          }
        } else {
          log(`Client for user ${clientConnection.userId} in non-open state: ${ws.readyState}`);
          disconnectedClients.add(ws);
        }
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach(ws => {
      this.clients.delete(ws);
      log("Removed disconnected client from clients set");
    });

    log(`Broadcast complete for users [${userIds.join(', ')}]. ${targetClients} target clients, ${successfulBroadcasts} successful, ${disconnectedClients.size} clients removed`);
  }

  // Keep the old method for backward compatibility but make it deprecated
  broadcastNewMessage() {
    log("Warning: Using deprecated broadcastNewMessage method. Use broadcastNewMessageToUser instead.");
    const message = JSON.stringify({ type: "NEW_MESSAGE" });
    let disconnectedClients = new Set<WebSocket>();
    let successfulBroadcasts = 0;

    log(`Broadcasting to all ${this.clients.size} connected clients`);

    this.clients.forEach((clientConnection, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          successfulBroadcasts++;
          log("Successfully sent WebSocket message to client");
        } catch (error) {
          log(`Error broadcasting to client: ${error instanceof Error ? error.message : String(error)}`);
          disconnectedClients.add(ws);
        }
      } else {
        log(`Client in non-open state: ${ws.readyState}`);
        disconnectedClients.add(ws);
      }
    });

    // Clean up disconnected clients
    disconnectedClients.forEach(ws => {
      this.clients.delete(ws);
      log("Removed disconnected client from clients set");
    });

    log(`Broadcast complete. ${successfulBroadcasts} successful, ${disconnectedClients.size} clients removed`);
  }
}