"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

interface HunkSummaryInput {
  path: string;
  header: string;
  hunk: string;
  commitMessage: string;
}

/**
 * Generate summaries for hunks using the HunkSummarizer
 */
export const generateHunkSummaries = action({
  args: {
    hunks: v.array(v.object({})),
    commitMessage: v.string(),
  },
  handler: async (ctx, args): Promise<{
    summaries: Array<{
      summary: string;
      labels: string[];
    }>;
  }> => {
    try {
      console.log(`🔄 Generating summaries for ${args.hunks.length} hunks`);

      // Import the HunkSummarizer dynamically since it's a Node.js module
      const { HunkSummarizer } = await import("../../src/backend/summarize/hunkWhy");
      
      // Get API key from environment
      const apiKey = process.env.CEREBRAS_API_KEY;
      if (!apiKey) {
        throw new Error("CEREBRAS_API_KEY not configured");
      }

      const summarizer = new HunkSummarizer(apiKey);

      // Prepare hunk inputs for summarization
      const hunkInputs: HunkSummaryInput[] = args.hunks.map((hunk: any) => ({
        path: hunk.path || '',
        header: hunk.header || '',
        hunk: hunk.hunk || '',
        commitMessage: args.commitMessage
      }));

      // Generate summaries in batch
      const result = await summarizer.summarizeHunksBatch({ hunks: hunkInputs });

      console.log(`✅ Generated summaries for ${result.summaries.length} hunks`);

      return {
        summaries: result.summaries.map(summary => ({
          summary: summary.summary,
          labels: summary.labels || []
        }))
      };

    } catch (error) {
      console.error('❌ Failed to generate hunk summaries:', error);
      
      // Return fallback summaries if generation fails
      const fallbackSummaries = args.hunks.map((hunk: any) => ({
        summary: `Code changes in ${hunk.path || 'unknown file'}`,
        labels: ['code-change']
      }));

      return {
        summaries: fallbackSummaries
      };
    }
  },
});
