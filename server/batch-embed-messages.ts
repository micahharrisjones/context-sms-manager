// Batch processing script to generate embeddings for existing messages
// Run with: npx tsx server/batch-embed-messages.ts

import { storage } from "./storage";
import { embeddingService } from "./embedding-service";

async function batchEmbedMessages() {
  console.log("Starting batch embedding generation for existing messages...");
  
  try {
    // Get all messages without embeddings
    const messages = await storage.getAllMessagesWithoutEmbeddings(1000);
    console.log(`Found ${messages.length} messages without embeddings`);
    
    if (messages.length === 0) {
      console.log("All messages already have embeddings!");
      return;
    }
    
    // Process in batches of 10 for better performance
    const BATCH_SIZE = 10;
    let processed = 0;
    let errors = 0;
    
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(messages.length/BATCH_SIZE)}...`);
      
      // Generate embeddings for batch (filter out empty content)
      const texts = batch.map(m => m.content).filter(content => content && content.trim().length > 0);
      
      try {
        const embeddings = await embeddingService.generateEmbeddingsBatch(texts);
        
        // Save embeddings
        await Promise.all(
          batch.map(async (message, idx) => {
            try {
              await storage.saveMessageEmbedding(message.id, embeddings[idx]);
              processed++;
              console.log(`  ✓ Message ${message.id} embedded`);
            } catch (error) {
              errors++;
              console.error(`  ✗ Failed to save embedding for message ${message.id}:`, error instanceof Error ? error.message : String(error));
            }
          })
        );
      } catch (error) {
        errors += batch.length;
        console.error(`  ✗ Failed to generate embeddings for batch:`, error instanceof Error ? error.message : String(error));
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\nBatch processing complete!`);
    console.log(`Successfully embedded: ${processed} messages`);
    console.log(`Errors: ${errors} messages`);
    
  } catch (error) {
    console.error("Batch embedding failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
batchEmbedMessages();
