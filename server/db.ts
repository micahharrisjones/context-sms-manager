import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

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
  max: 1,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});

export const db = drizzle({ client: pool, schema });

// Test the database connection and set up reconnection handling
async function validateConnection() {
  try {
    await pool.connect();
    log("Successfully connected to the database");
  } catch (error) {
    log("Failed to connect to database:", error);
    // Wait 5 seconds before retrying
    setTimeout(validateConnection, 5000);
  }
}

validateConnection();

// Handle pool errors
pool.on('error', (err) => {
  log("Unexpected database error:", err);
  validateConnection();
});