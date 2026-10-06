import { db } from "../db";
import { messages } from "@shared/schema";
import { isNull, or, sql } from "drizzle-orm";
import { log } from "../vite";
import { UrlEnrichmentService } from "../url-enrichment-service";
import { openGraphService } from "../og-service";
import { embeddingService } from "../embedding-service";
import { storage } from "../storage";

// Create an instance of the URL enrichment service
const urlEnrichmentService = new UrlEnrichmentService(openGraphService);

/**
 * Backfill script to enrich existing messages with URLs
 * 
 * This script:
 * 1. Finds messages that have URLs but no OG enrichment data
 * 2. Extracts URLs and enriches them with metadata
 * 3. Updates the message with OG data
 * 4. Regenerates embeddings with enriched content for better search
 * 
 * Usage: tsx server/scripts/backfill-enrichment.ts [limit]
 */

async function backfillEnrichment(limit: number = 100) {
  log(`Starting enrichment backfill (limit: ${limit})...`);
  
  try {
    // Find messages without enrichment that might have URLs
    const messagesToEnrich = await db
      .select()
      .from(messages)
      .where(
        or(
          isNull(messages.enrichmentStatus),
          sql`${messages.enrichmentStatus} = 'failed'`
        )
      )
      .limit(limit);
    
    log(`Found ${messagesToEnrich.length} messages to process`);
    
    let enriched = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const message of messagesToEnrich) {
      try {
        // Extract URLs from message content
        const urls = urlEnrichmentService.extractUrls(message.content);
        
        if (urls.length === 0) {
          log(`  Message ${message.id}: No URLs found, skipping`);
          skipped++;
          continue;
        }
        
        log(`  Message ${message.id}: Found ${urls.length} URL(s), enriching...`);
        
        // Mark as pending
        await storage.updateMessageEnrichmentStatus(message.id, "pending", message.content);
        
        // Enrich the first URL
        const enrichmentData = await urlEnrichmentService.enrichUrl(urls[0]);
        
        if (enrichmentData && (enrichmentData.title || enrichmentData.description)) {
          // Update message with enrichment data
          const saved = await storage.updateMessageEnrichment(message.id, {
              ogTitle: enrichmentData.title || null,
              ogDescription: enrichmentData.description || null,
              ogImage: enrichmentData.image || null,
              ogSiteName: enrichmentData.siteName || null,
              ogSourceUrl: urls[0],
              ogIsBlocked: enrichmentData.isBlocked,
              ogIsFallback: enrichmentData.isFallback,
              enrichmentStatus: 'completed',
            }, message.content);
          if (!saved) { skipped++; continue; }
          
          // Regenerate embedding with enriched content
          const enrichedContent = [
            message.content,
            enrichmentData.title,
            enrichmentData.description
          ].filter(Boolean).join(' ');
          
          const embedding = await embeddingService.generateEmbedding(enrichedContent);
          
          await storage.saveMessageEmbedding(message.id, embedding, message.content);
          
          log(`  Message ${message.id}: ✓ Enriched with "${enrichmentData.title}"`);
          enriched++;
        } else {
          await storage.updateMessageEnrichmentStatus(message.id, "failed", message.content);
          
          log(`  Message ${message.id}: No enrichment data found`);
          failed++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        log(`  Message ${message.id}: Error - ${error instanceof Error ? error.message : String(error)}`);
        failed++;
        
        await storage.updateMessageEnrichmentStatus(message.id, "failed", message.content)
          .catch(() => {});
      }
    }
    
    log(`\nBackfill complete!`);
    log(`  Enriched: ${enriched}`);
    log(`  Skipped (no URLs): ${skipped}`);
    log(`  Failed: ${failed}`);
    log(`  Total processed: ${messagesToEnrich.length}`);
    
    process.exit(0);
  } catch (error) {
    log(`Fatal error during backfill: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Get limit from command line args, default to 100
const limit = process.argv[2] ? parseInt(process.argv[2], 10) : 100;
backfillEnrichment(limit);
