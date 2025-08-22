"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// Summarize hunks for a commit
export const summarizeHunks = action({
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
    
    const summaries = [];
    const bullets = [];

    // Process each hunk
    for (const hunk of hunks) {
      try {
        const summary = await generateHunkSummary(hunk, commit);
        summaries.push(summary);
        
        // Add to commit bullets
        bullets.push(summary.whySummary);
      } catch (error) {
        console.error(`Failed to summarize hunk ${hunk._id}:`, error);
      }
    }

    // Store hunk summaries
    for (const summary of summaries) {
      await ctx.runMutation(internal.summaries_hunk.createHunkSummary, {
        hunkId: summary.hunkId,
        whySummary: summary.whySummary,
        riskTags: summary.riskTags,
        modelId: "gpt-oss-120b",
        createdAt: Date.now(),
      });
    }

    // Store commit summary
    if (bullets.length > 0) {
      await ctx.runMutation(internal.summaries_commit.createCommitSummary, {
        commitId,
        bullets: bullets.slice(0, 6), // Limit to 6 bullets
        modelId: "gpt-oss-120b",
        createdAt: Date.now(),
      });
    }
  },
});

// Generate summary for a single hunk
async function generateHunkSummary(hunk: any, commit: any) {
  const prompt = `Analyze this code change and provide a brief summary.

Commit Message: ${commit.message}
File: ${hunk.filePath}
Patch Header: ${hunk.patchHeader}

Before:
${hunk.beforeSnippet}

After:
${hunk.afterSnippet}

Please provide:
1. A 1-3 sentence summary explaining what changed and why
2. Risk tags (e.g., "security", "performance", "bug-fix", "refactor", "feature")

Format as JSON:
{
  "whySummary": "Brief explanation of what changed and why",
  "riskTags": ["tag1", "tag2"]
}`;

  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasApiKey) {
    throw new Error('CEREBRAS_API_KEY not configured');
  }

  const response = await fetch("https://api.cerebras.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cerebrasApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: "You are a code review assistant. Analyze code changes and provide concise summaries with risk assessment.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    throw new Error(`Cerebras API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const result = JSON.parse(content);
    return {
      hunkId: hunk._id,
      whySummary: result.whySummary,
      riskTags: result.riskTags || [],
    };
  } catch (error) {
    // Fallback if JSON parsing fails
    return {
      hunkId: hunk._id,
      whySummary: content.substring(0, 200),
      riskTags: ["unknown"],
    };
  }
}
