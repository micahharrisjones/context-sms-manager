import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from "./vite";

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false; // Disable pipelining for more stable connections

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
  connectionTimeoutMillis: 10000, // Increased timeout
  idleTimeoutMillis: 1000, // Reduced idle timeout for serverless
  maxRetries: 5, // Added retries
  retryDelay: 1000 // 1 second between retries
});

export const db = drizzle({ client: pool, schema });

// Test the database connection and set up reconnection handling
async function validateConnection(retryCount = 0) {
  try {
    const client = await pool.connect();
    log("Successfully connected to the database");
    client.release();
  } catch (error) {
    const nextRetry = Math.min(retryCount + 1, 5);
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff up to 10s

    log(`Database connection attempt ${nextRetry} failed:`, error);
    log(`Retrying in ${delay}ms...`);

    setTimeout(() => validateConnection(nextRetry), delay);
  }
}

// Initial connection attempt
validateConnection();

// Handle pool errors
pool.on('error', (err) => {
  log("Unexpected database error:", err);
  // Attempt to re-establish connection
  validateConnection();
});

// Cleanup on process exit
process.on('beforeExit', async () => {
  try {
    await pool.end();
    log("Database pool closed successfully");
  } catch (error) {
    log("Error closing database pool:", error);
  }
});