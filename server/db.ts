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

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Test the database connection
pool.connect()
  .then(() => log("Successfully connected to the database"))
  .catch(error => {
    log("Failed to connect to database:", error);
    throw error;
  });