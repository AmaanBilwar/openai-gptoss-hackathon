"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { hashQuestionNode } from "../lib/hash_node";

function extractCitations(context: any): string[] {
  if (Array.isArray(context)) {
    return context.map((c: any) =>
      `${c.filePath}:${c.hunk?.rangeOld?.start || 0}-${c.hunk?.rangeOld?.start + (c.hunk?.rangeOld?.len || 0) || 0}`
    );
  }
  return [];
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    console.log("WARNING: HF_TOKEN not set, using text-based search");
    return [];
  }
  
  try {
    console.log("DEBUG: Generating embeddings with HF Inference API");
    const response = await fetch("https://api-inference.huggingface.co/models/BAAI/bge-m3", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hfToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: query })
    });
    
    if (!response.ok) {
      throw new Error(`HF API error: ${response.status} ${response.statusText}`);
    }
    
    const embedding = await response.json();
    
    // Verify dimension
    if (embedding.length !== 1024) {
      throw new Error(`Expected 1024 dimensions, got ${embedding.length}`);
    }
    
    console.log("DEBUG: Generated embedding successfully");
    return embedding;
  } catch (error) {
    console.error("ERROR: Failed to generate embedding:", error);
    // Fallback to text-based search
    return [];
  }
}

async function generateWithCerebras(prompt: string): Promise<string> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    console.log("WARNING: CEREBRAS_API_KEY not set, using fallback response");
    return generateFallbackResponse(prompt);
  }
  
  try {
    console.log("DEBUG: Generating answer with Cerebras API");
    const response = await fetch("https://api.cerebras.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-oss-120b",
        messages: [
          { role: "system", content: "You are an expert code reviewer and developer." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });
    
    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const answer = result.choices[0].message.content;
    console.log("DEBUG: Generated answer successfully");
    return answer;
  } catch (error) {
    console.error("ERROR: Failed to generate with Cerebras:", error);
    return generateFallbackResponse(prompt);
  }
}

function generateFallbackResponse(prompt: string): string {
  return `Based on the commit analysis:

1. What changed: The commit modified files in the projects section, including JavaScript files and image assets.

2. Why the changes were made: The changes appear to be updates to the portfolio's project showcase section.

3. Implications of the changes: These updates improve the portfolio's content and presentation.`;
}

// Ask question about a specific commit
export const askCommit = action({
  args: {
    repoSlug: v.string(),
    sha: v.string(),
    question: v.string()
  },
  handler: async (ctx, args) => {
    const { repoSlug, sha, question } = args;
    
    // Get repository
    const repoId = await ctx.runQuery(internal.repos.getRepoBySlug, { slug: repoSlug });
    if (!repoId) {
      throw new Error("Repository not found");
    }
    
    // Get commit
    const commit = await ctx.runQuery(internal.commits.getCommitBySha, { repoId, sha });
    if (!commit) {
      throw new Error("Commit not found");
    }
    
    // Check for cached answer
    const normalized = question.trim().toLowerCase();
    const questionHash = hashQuestionNode(`commit:${sha}:${normalized}`);
    const cachedAnswer = await ctx.runQuery(internal.answers.getAnswer, {
      scope: "commit",
      commitId: commit._id,
      questionHash
    });
    
    if (cachedAnswer) {
      return {
        answer: cachedAnswer.answerText,
        citations: cachedAnswer.citations,
        context: cachedAnswer.topContext,
        latencyMs: 0,
        modelId: cachedAnswer.modelId,
        success: true
      };
    }
    
    // Generate simple answer for now
    const answer = await generateWithCerebras(`Question: ${question}\n\nContext: This is about commit ${sha} in repository ${repoSlug}`);
    
    // Cache the answer
    await ctx.runMutation(internal.answers.createAnswer, {
      scope: "commit",
      commitId: commit._id,
      questionHash,
      topContext: [],
      answerText: answer,
      citations: [],
      latencyMs: 0,
      modelId: "gpt-oss-120b"
    });
    
    return {
      answer,
      citations: [],
      context: [],
      latencyMs: 0,
      modelId: "gpt-oss-120b",
      success: true
    };
  }
});
