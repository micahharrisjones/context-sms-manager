import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

log("Connecting to database with URL:", process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

// Configure the pool with better defaults for serverless environment
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 1, // Limit to single connection for serverless
});

export const db = drizzle({ client: pool, schema });

// Initial connection test
pool.connect()
  .then(() => {
    log("Successfully connected to the database");
  })
  .catch((error) => {
    log("Failed to connect to database:", error);
  });

// Handle pool errors
pool.on('error', (err) => {
  log("Unexpected database error:", err);
});

// Cleanup on process exit
process.on('beforeExit', async () => {
  await pool.end();
});