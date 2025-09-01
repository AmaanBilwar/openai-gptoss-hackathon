import { EmbeddingClient } from '../embeddingClient';
import { config } from '../config';
import { api } from '../../../convex/_generated/api';

/**
 * Interface for hunk row data from Convex
 */
export interface HunkRow {
  _id: string;
  repoId: number;
  sha: string;
  path: string;
  hunkIndex: number;
  header: string;
  hunk: string;
  summary?: string;
  labels?: string[];
}

/**
 * Interface for commit row data from Convex
 */
export interface CommitRow {
  _id: string;
  repoId: number;
  sha: string;
  message: string;
  authorLogin?: string;
  authoredDateIso?: string;
}

/**
 * Interface for embedding result
 */
export interface EmbeddingResult {
  vectors: number[][];
  dim: number;
}

/**
 * Interface for hunk embedding data
 */
export interface HunkEmbeddingData {
  hunkId: string;
  text: string;
  embedding: number[];
  dim: number;
}

/**
 * Main embeddings service for RAG functionality
 */
export class EmbeddingsService {
  private client: EmbeddingClient;

  constructor(baseUrl?: string) {
    const embeddingUrl = baseUrl || process.env.EMBEDDINGS_BASE_URL || 'http://localhost:8081';
    this.client = new EmbeddingClient(embeddingUrl);
  }

  /**
   * Build embedding text for a hunk using the specified format
   */
  buildHunkEmbeddingText(hunkRow: HunkRow, commitRow: CommitRow): string {
    const { path, header, summary, hunk } = hunkRow;
    const { message } = commitRow;

    // Extract first line of commit message
    const commitMessageLine1 = message.split('\n')[0].trim();

    if (summary) {
      // Use the specified format with summary
      return `${path}\n${header}\n{WHY: ${summary}}\n{MSG: ${commitMessageLine1}}`;
    } else {
      // Fallback: header + path + first 200 chars of hunk
      const hunkPreview = hunk.substring(0, 200).trim();
      return `${path}\n${header}\n{hunk: ${hunkPreview}}\n{MSG: ${commitMessageLine1}}`;
    }
  }

  /**
   * Generate embeddings for a batch of texts
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty');
    }

    try {
      const vectors = await this.client.embedTexts(texts);
      
      // All vectors should have the same dimension
      const dim = vectors[0]?.length || 0;
      
      // Validate that all vectors have the same dimension
      for (let i = 0; i < vectors.length; i++) {
        if (vectors[i].length !== dim) {
          throw new Error(`Inconsistent embedding dimensions: expected ${dim}, got ${vectors[i].length} at index ${i}`);
        }
      }

      return {
        vectors,
        dim
      };
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upsert hunk embeddings to Convex
   */
  async upsertHunkEmbeddings(
    convexClient: any,
    repoId: number,
    sha: string,
    path: string,
    hunkIds: string[],
    hunkRows: HunkRow[],
    commitRow: CommitRow
  ): Promise<{
    success: number;
    failed: number;
    embeddings: HunkEmbeddingData[];
  }> {
    if (hunkIds.length === 0) {
      return { success: 0, failed: 0, embeddings: [] };
    }

    try {
      // Build embedding texts for all hunks
      const texts: string[] = [];
      const hunkIdToIndex: Map<string, number> = new Map();

      for (let i = 0; i < hunkIds.length; i++) {
        const hunkId = hunkIds[i];
        const hunkRow = hunkRows.find(row => row._id === hunkId);
        
        if (hunkRow) {
          const text = this.buildHunkEmbeddingText(hunkRow, commitRow);
          texts.push(text);
          hunkIdToIndex.set(hunkId, i);
        }
      }

      if (texts.length === 0) {
        return { success: 0, failed: 0, embeddings: [] };
      }

      // Generate embeddings
      console.log(`🔄 Generating embeddings for ${texts.length} hunks...`);
      const embeddingResult = await this.embedBatch(texts);

      // Prepare embedding data for Convex
      const embeddings: HunkEmbeddingData[] = [];
      const convexUpdates = [];

      for (let i = 0; i < hunkIds.length; i++) {
        const hunkId = hunkIds[i];
        const textIndex = hunkIdToIndex.get(hunkId);
        
        if (textIndex !== undefined && embeddingResult.vectors[textIndex]) {
          const embedding = embeddingResult.vectors[textIndex];
          const text = texts[textIndex];
          
          embeddings.push({
            hunkId,
            text,
            embedding,
            dim: embeddingResult.dim
          });

          // Prepare Convex update
          convexUpdates.push({
            repoId,
            scope: 'commit_hunk' as const,
            sha,
            path,
            hunkId,
            embedding,
            dim: embeddingResult.dim,
            text: text.substring(0, 500) // Truncate for preview
          });
        }
      }

      // Upsert to Convex
      if (convexUpdates.length > 0) {
        console.log(`🔄 Upserting ${convexUpdates.length} embeddings to Convex...`);
        await convexClient.mutation(api.embeddings.upsertHunkEmbeddingsBatch, {
          embeddings: convexUpdates
        });
      }

      return {
        success: embeddings.length,
        failed: hunkIds.length - embeddings.length,
        embeddings
      };

    } catch (error) {
      console.error('❌ Failed to upsert hunk embeddings:', error);
      throw error;
    }
  }

  /**
   * Check if the embedding service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.checkHealth();
      return true;
    } catch (error) {
      console.error('❌ Embedding service health check failed:', error);
      return false;
    }
  }

  /**
   * Wait for the embedding service to be ready
   */
  async waitForService(timeout: number = 30000): Promise<void> {
    try {
      await this.client.waitForService(timeout);
    } catch (error) {
      throw new Error(`Embedding service not ready after ${timeout}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test the embedding service
   */
  async testService(): Promise<{ success: boolean; latency: number; dimension: number }> {
    try {
      return await this.client.testService();
    } catch (error) {
      throw new Error(`Embedding service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Convenience function to create an embeddings service instance
 */
export function createEmbeddingsService(baseUrl?: string): EmbeddingsService {
  return new EmbeddingsService(baseUrl);
}

/**
 * Convenience function for building hunk embedding text
 */
export function buildHunkEmbeddingText(hunkRow: HunkRow, commitRow: CommitRow): string {
  const service = new EmbeddingsService();
  return service.buildHunkEmbeddingText(hunkRow, commitRow);
}

/**
 * Convenience function for batch embedding
 */
export async function embedBatch(texts: string[], baseUrl?: string): Promise<EmbeddingResult> {
  const service = new EmbeddingsService(baseUrl);
  return await service.embedBatch(texts);
}
