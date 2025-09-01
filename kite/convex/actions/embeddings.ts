"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Generate embeddings for hunks
 */
export const generateHunkEmbeddings = action({
  args: {
    repoId: v.number(),
    sha: v.string(),
    hunks: v.array(v.any()),
    summaries: v.array(v.any()),
    commitMessage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    embeddings: Array<{
      hunkId: string;
      vector: number[];
      dim: number;
      text: string;
    }>;
  }> => {
    try {
      console.log(`🔄 Generating embeddings for ${args.hunks.length} hunks`);

      // For now, we'll skip embedding generation in the cloud
      // and handle it locally. This is a temporary solution.
      console.log(`📤 Skipping embedding generation for ${args.hunks.length} hunks (will be handled locally)`);
      
      return {
        embeddings: []
      };

    } catch (error) {
      console.error('❌ Failed to generate hunk embeddings:', error);
      
      // Return empty embeddings if generation fails
      return {
        embeddings: []
      };
    }
  },
});

/**
 * Generate embeddings for PR-level content (comments, files, etc.)
 */
export const generatePREmbeddings = action({
  args: {
    repoId: v.number(),
    prNumber: v.number(),
    prData: v.any(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    embeddings: Array<{
      prId: string;
      vector: number[];
      dim: number;
      text: string;
    }>;
  }> => {
    try {
      console.log(`🔄 Generating PR-level embeddings for PR #${args.prNumber}`);

      const embeddingBaseUrl =
        process.env.EMBEDDING_SERVICE_URL || "http://localhost:8081";

      const prData = args.prData as any;
      const embeddings = [];

      // Generate embedding for PR title and body
      if (prData.title || prData.body) {
        const prText = `PR #${args.prNumber}\nTitle: ${
          prData.title || ""
        }\nBody: ${prData.body || ""}`;

        try {
          const response = await fetch(`${embeddingBaseUrl}/embed`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inputs: [prText] }),
          });

          if (!response.ok) {
            throw new Error(
              `PR Embedding request failed: ${response.statusText}`
            );
          }
          const result = await response.json();

          if (result.vectors && result.vectors.length > 0) {
            const vector = result.vectors[0];
            embeddings.push({
              prId: `pr-${args.prNumber}`,
              vector: vector,
              dim: result.dim || vector.length,
              text: prText
            });
          }
        } catch (error) {
          console.error(`❌ Failed to generate PR embedding:`, error);
        }
      }

      console.log(`✅ Generated ${embeddings.length} PR-level embeddings`);

      return {
        embeddings
      };

    } catch (error) {
      console.error('❌ Failed to generate PR embeddings:', error);
      
      // Return empty embeddings if generation fails
      return {
        embeddings: []
      };
    }
  },
});
