import { db } from "../db";
import { messages, messageEmbeddings } from "@shared/schema";
import { sql } from "drizzle-orm";
import { log } from "../vite";
import { embeddingService } from "../embedding-service";

/**
 * Script to generate embeddings for messages that don't have them
 * 
 * This script:
 * 1. Finds messages without embeddings
 * 2. Generates embeddings from message content
 * 3. Saves embeddings to the database
 * 
 * Usage: npx tsx server/scripts/generate-embeddings.ts [limit]
 */

async function generateEmbeddings(limit: number = 100) {
  log(`Starting embedding generation (limit: ${limit})...`);
  
  try {
    // Find messages without embeddings
    const messagesWithoutEmbeddings = await db
      .select({
        id: messages.id,
        content: messages.content,
        ogTitle: messages.ogTitle,
        ogDescription: messages.ogDescription
      })
      .from(messages)
      .leftJoin(messageEmbeddings, sql`${messages.id} = ${messageEmbeddings.messageId}`)
      .where(sql`${messageEmbeddings.messageId} IS NULL`)
      .limit(limit);
    
    log(`Found ${messagesWithoutEmbeddings.length} messages without embeddings`);
    
    if (messagesWithoutEmbeddings.length === 0) {
      log('All messages already have embeddings!');
      process.exit(0);
    }
    
    let generated = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const message of messagesWithoutEmbeddings) {
      try {
        // Skip empty messages
        if (!message.content || message.content.trim().length === 0) {
          log(`  Message ${message.id}: Skipping (empty content)`);
          skipped++;
          continue;
        }
        
        // Combine content with enriched OG data if available
        const textToEmbed = [
          message.content,
          message.ogTitle,
          message.ogDescription
        ].filter(Boolean).join(' ');
        
        log(`  Message ${message.id}: Generating embedding...`);
        
        // Generate embedding
        const embedding = await embeddingService.generateEmbedding(textToEmbed);
        
        if (!embedding || embedding.length === 0) {
          log(`  Message ${message.id}: Failed to generate embedding`);
          failed++;
          continue;
        }
        
        // Save embedding
        await db
          .insert(messageEmbeddings)
          .values({
            messageId: message.id,
            embedding: embedding
          });
        
        log(`  Message ${message.id}: ✓ Embedding saved (${embedding.length} dimensions)`);
        generated++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        log(`  Message ${message.id}: Error - ${error instanceof Error ? error.message : String(error)}`);
        failed++;
      }
    }
    
    log(`\nEmbedding generation complete!`);
    log(`  Generated: ${generated}`);
    log(`  Skipped (empty): ${skipped}`);
    log(`  Failed: ${failed}`);
    log(`  Total processed: ${messagesWithoutEmbeddings.length}`);
    
    process.exit(0);
  } catch (error) {
    log(`Fatal error during embedding generation: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Get limit from command line args, default to 100
const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 100;
generateEmbeddings(limit);
