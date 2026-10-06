import { log } from "./vite";
import { embed } from "./knowledge/provider";

// This service uses OpenAI's text-embedding-3-small model to generate vector embeddings
// for semantic search capabilities. Reference: blueprint:javascript_openai
export class EmbeddingService {

  /**
   * Generate a vector embedding for a given text
   * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
   * Cost: ~$0.02 per 1M tokens (~$1 per million messages at 50 tokens each)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const [embedding] = await embed([text.slice(0, 6000)]);
      log(`Generated embedding with ${embedding.length} dimensions`);
      
      return embedding;
    } catch (error) {
      log("Embedding provider request failed");
      throw new Error("Embedding provider request failed");
    }
  }

  /**
   * Generate embeddings for multiple texts in a batch
   * More efficient for bulk operations
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      log(`Generating embeddings for batch of ${texts.length} texts`);
      
      const embeddings: number[][] = [];
      for (let i = 0; i < texts.length; i += 32) embeddings.push(...await embed(texts.slice(i, i + 32).map(t => t.slice(0, 6000))));
      log(`Generated ${embeddings.length} embeddings`);
      
      return embeddings;
    } catch (error) {
      log("Batch embedding provider request failed");
      throw new Error("Batch embedding provider request failed");
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Returns a value between -1 and 1 (higher = more similar)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same dimensions");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }
}

export const embeddingService = new EmbeddingService();
