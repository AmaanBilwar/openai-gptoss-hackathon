"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// Generate embeddings for hunks in a commit
export const embedHunks = action({
  args: {
    commitId: v.id("commits"),
  },
  handler: async (ctx, args) => {
    const { commitId } = args;

    // Get commit details
    const commit = await ctx.runQuery(internal.commits.getCommitById, { commitId });
    if (!commit) {
      throw new Error(`Commit ${commitId} not found`);
    }

    // Get all hunks for this commit
    const hunks = await ctx.runQuery(internal.hunks.getHunksByCommit, { commitId });
    
    // Get hunk summaries
    const summaries = await ctx.runQuery(internal.summaries_hunk.getSummariesByHunks, {
      hunkIds: hunks.map(h => h._id)
    });

    // Generate embeddings for each hunk
    for (const hunk of hunks) {
      try {
        const summary = summaries.find(s => s.hunkId === hunk._id);
        const embedding = await generateHunkEmbedding(hunk, summary, commit);
        
        await ctx.runMutation(internal.embeddings_hunk.createHunkEmbedding, {
          repoId: commit.repoId,
          commitId,
          filePath: hunk.filePath,
          hunkId: hunk._id,
          embedding,
        });
      } catch (error) {
        console.error(`Failed to embed hunk ${hunk._id}:`, error);
      }
    }
  },
});

// Generate embedding for a single hunk
async function generateHunkEmbedding(hunk: any, summary: any, commit: any) {
  // Build text for embedding
  const text = buildEmbeddingText(hunk, summary, commit);
  
  // Use TEI server for embeddings - hardcoded for testing
  const teiUrl = "http://localhost:8080";
  
  const response = await fetch(`${teiUrl}/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "BAAI/bge-m3",
      inputs: [text],
    }),
  });

  if (!response.ok) {
    throw new Error(`TEI API error: ${response.status}`);
  }

  const data = await response.json();
  const embedding = data.data[0].embedding;
  
  // Verify dimension
  if (embedding.length !== 1024) {
    throw new Error(`Expected 1024 dimensions, got ${embedding.length}`);
  }

  return embedding;
}

// Build text for embedding
function buildEmbeddingText(hunk: any, summary: any, commit: any) {
  const parts = [
    `Commit: ${commit.message}`,
    `File: ${hunk.filePath}`,
    `Patch: ${hunk.patchHeader}`,
  ];

  if (summary?.whySummary) {
    parts.push(`Summary: ${summary.whySummary}`);
  }

  if (hunk.beforeSnippet) {
    parts.push(`Before: ${hunk.beforeSnippet.substring(0, 500)}`);
  }

  if (hunk.afterSnippet) {
    parts.push(`After: ${hunk.afterSnippet.substring(0, 500)}`);
  }

  return parts.join("\n\n");
}
