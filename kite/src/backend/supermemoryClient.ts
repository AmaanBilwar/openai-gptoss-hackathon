import { SupermemoryMemory, SupermemorySearchResult } from './types';

/**
 * Client for interacting with Supermemory AI Memory API
 * This is a wrapper around the supermemory SDK for TypeScript
 */
export class SupermemoryClient {
  private client: any; // Will be the supermemory SDK client
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    // Note: We'll initialize the client when the supermemory package is available
    // For now, we'll use a placeholder that can be updated when the package is installed
    this.client = null;
  }

  /**
   * Initialize the supermemory client
   * This method should be called after the supermemory package is available
   */
  private async initializeClient(): Promise<void> {
    if (this.client) return;

    try {
      // Dynamic import to handle cases where the package might not be installed
      const { Supermemory } = await import('supermemory');
      this.client = new Supermemory({ apiKey: this.apiKey });
    } catch (error) {
      throw new Error(`Failed to initialize Supermemory client: ${error}`);
    }
  }

  /**
   * Add a memory to Supermemory
   */
  async addMemory(
    content: string, 
    metadata: Record<string, any> = {}, 
    containerTags: string[] = []
  ): Promise<SupermemoryMemory> {
    await this.initializeClient();

    try {
      const response = await this.client.memories.add({
        content,
        metadata,
        container_tags: containerTags
      });

      return {
        id: response.id,
        status: response.status
      };
    } catch (error) {
      console.error('Error adding memory to Supermemory:', error);
      throw new Error(`Failed to add memory: ${error}`);
    }
  }

  /**
   * Search memories in Supermemory
   */
  async searchMemories(
    query: string, 
    limit: number = 10, 
    filters: Record<string, any> = {}, 
    includeSummary: boolean = true
  ): Promise<SupermemorySearchResult> {
    await this.initializeClient();

    try {
      // Simplify the search to avoid filter issues
      const searchBody: any = {
        q: query,
        limit
      };
      
      // Only add filters if they're not empty
      if (Object.keys(filters).length > 0) {
        searchBody.filters = filters;
      }
      
      // Only add include_summary if it's true
      if (includeSummary) {
        searchBody.include_summary = true;
      }

      const response = await this.client.search.execute(searchBody);

      return {
        results: response.results || [],
        summary: response.summary
      };
    } catch (error) {
      console.error('Error searching memories in Supermemory:', error);
      throw new Error(`Failed to search memories: ${error}`);
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    await this.initializeClient();

    try {
      await this.client.memories.delete(memoryId);
      return true;
    } catch (error) {
      console.error(`Error deleting memory ${memoryId} from Supermemory:`, error);
      return false;
    }
  }

  /**
   * Delete multiple memories by their IDs
   */
  async deleteMemoriesBatch(memoryIds: string[]): Promise<number> {
    console.log(`🗑️  Cleaning up ${memoryIds.length} memories from Supermemory...`);

    if (!memoryIds.length) {
      console.log('⚠️  No memory IDs to delete');
      return 0;
    }

    let deletedCount = 0;
    for (const memoryId of memoryIds) {
      console.log(`   🗑️  Deleting memory: ${memoryId}`);
      if (await this.deleteMemory(memoryId)) {
        deletedCount++;
        console.log(`   ✅ Deleted: ${memoryId}`);
      } else {
        console.log(`   ❌ Failed to delete: ${memoryId}`);
      }
    }

    console.log(`✅ Successfully deleted ${deletedCount}/${memoryIds.length} memories`);
    return deletedCount;
  }
}
