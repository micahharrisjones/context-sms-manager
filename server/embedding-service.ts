import OpenAI from "openai";
import { log } from "./vite";

// This service uses OpenAI's text-embedding-3-small model to generate vector embeddings
// for semantic search capabilities. Reference: blueprint:javascript_openai
export class EmbeddingService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate a vector embedding for a given text
   * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
   * Cost: ~$0.02 per 1M tokens (~$1 per million messages at 50 tokens each)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      log(`Generating embedding for text: "${text.substring(0, 50)}..."`);
      
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float"
      });

      const embedding = response.data[0].embedding;
      log(`Generated embedding with ${embedding.length} dimensions`);
      
      return embedding;
    } catch (error) {
      log(`Error generating embedding: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in a batch
   * More efficient for bulk operations
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      log(`Generating embeddings for batch of ${texts.length} texts`);
      
      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: texts,
        encoding_format: "float"
      });

      const embeddings = response.data.map(item => item.embedding);
      log(`Generated ${embeddings.length} embeddings`);
      
      return embeddings;
    } catch (error) {
      log(`Error generating batch embeddings: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : String(error)}`);
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
