"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Fetch commit data from GitHub
 */
export const fetchCommit = action({
  args: {
    repoId: v.number(),
    sha: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Get repository info
      const repo = await ctx.runQuery(internal.repositories.getRepositoryById, {
        repoId: args.repoId,
      });

      if (!repo) {
        throw new Error(`Repository ${args.repoId} not found`);
      }

      // Get GitHub token
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error("GitHub token not configured");
      }

      // Fetch commit from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${repo.fullName}/commits/${args.sha}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const commitData = await response.json();

      // Store commit in database
      await ctx.runMutation(internal.commits.upsertCommit, {
        owner: repo.owner,
        repo: repo.name,
        sha: args.sha,
        message: commitData.commit.message,
        authorLogin: commitData.author?.login,
        authorEmail: commitData.commit.author.email,
        authoredDateIso: commitData.commit.author.date,
        committerLogin: commitData.committer?.login,
        committerEmail: commitData.commit.committer.email,
        committedDateIso: commitData.commit.committer.date,
        parentShas: commitData.parents.map((p: any) => p.sha),
        treeSha: commitData.commit.tree.sha,
        stats: commitData.stats,
      });

      console.log(`📥 Fetched commit ${args.sha.substring(0, 8)} from GitHub`);
      return commitData;

    } catch (error) {
      console.error(`❌ Failed to fetch commit ${args.sha}:`, error);
      throw error;
    }
  },
});

/**
 * Fetch pull request data from GitHub
 */
export const fetchPullRequest = action({
  args: {
    repoId: v.number(),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Get repository info
      const repo = await ctx.runQuery(internal.repositories.getRepositoryById, {
        repoId: args.repoId,
      });

      if (!repo) {
        throw new Error(`Repository ${args.repoId} not found`);
      }

      // Get GitHub token
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error("GitHub token not configured");
      }

      // Fetch PR from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${repo.fullName}/pulls/${args.number}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const prData = await response.json();

      // Store PR in database
      await ctx.runMutation(internal.prs.upsertPullRequest, {
        owner: repo.owner,
        repo: repo.name,
        number: args.number,
        state: prData.state,
        title: prData.title,
        body: prData.body,
        authorLogin: prData.user?.login,
        headRef: prData.head.ref,
        headSha: prData.head.sha,
        baseRef: prData.base.ref,
        baseSha: prData.base.sha,
        draft: prData.draft,
        mergeable: prData.mergeable,
        mergeableState: prData.mergeable_state,
        createdAtIso: prData.created_at,
        updatedAtIso: prData.updated_at,
        closedAtIso: prData.closed_at,
        mergedAtIso: prData.merged_at,
      });

      console.log(`📥 Fetched PR #${args.number} from GitHub`);
      return prData;

    } catch (error) {
      console.error(`❌ Failed to fetch PR #${args.number}:`, error);
      throw error;
    }
  },
});

/**
 * Parse commit diff and split into hunks
 */
export const parseCommitDiff = action({
  args: {
    repoId: v.number(),
    sha: v.string(),
    commitData: v.any(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    error?: string;
    files: any[];
    hunks: any[];
  }> => {
    try {
      console.log(`🔄 Parsing commit diff for ${args.sha.substring(0, 8)}`);

      // Get repository info
      const repo = await ctx.runQuery(internal.repositories.getRepositoryById, {
        repoId: args.repoId,
      });

      if (!repo) {
        throw new Error(`Repository ${args.repoId} not found`);
      }

      // Get GitHub token
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error("GitHub token not configured");
      }

      // Fetch commit diff from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${repo.fullName}/commits/${args.sha}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3.diff",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const diff = await response.text();

      // Import the parse function dynamically
      const { parseCommitDiffToFilesAndHunks } = await import("../../src/backend/parse");
      
      // Parse the diff into files and hunks
      const parseResult = parseCommitDiffToFilesAndHunks(diff);

      // Convert to the format expected by the embedding pipeline
      const hunks = [];
      for (const file of parseResult.files) {
        for (const hunk of file.hunks) {
          hunks.push({
            path: file.path,
            header: hunk.header,
            hunk: hunk.hunk,
            hunkIndex: hunk.hunkIndex,
            hunkId: `hunk-${file.path}-${hunk.hunkIndex}`
          });
        }
      }

      console.log(`✅ Parsed commit diff: ${parseResult.files.length} files, ${hunks.length} hunks`);

      return {
        success: true,
        files: parseResult.files,
        hunks: hunks
      };

    } catch (error) {
      console.error(`❌ Failed to parse commit diff for ${args.sha}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        files: [],
        hunks: []
      };
    }
  },
});

/**
 * Get all commits in a pull request
 */
export const getPRCommits = action({
  args: {
    repoId: v.number(),
    prNumber: v.number(),
  },
  handler: async (ctx, args): Promise<Array<{ sha: string; [key: string]: any }>> => {
    try {
      console.log(`🔄 Fetching commits for PR #${args.prNumber}`);

      // Get repository info
      const repo = await ctx.runQuery(internal.repositories.getRepositoryById, {
        repoId: args.repoId,
      });

      if (!repo) {
        throw new Error(`Repository ${args.repoId} not found`);
      }

      // Get GitHub token
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        throw new Error("GitHub token not configured");
      }

      // Fetch PR commits from GitHub API
      const response = await fetch(
        `https://api.github.com/repos/${repo.fullName}/pulls/${args.prNumber}/commits`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const commits = await response.json();

      console.log(`✅ Fetched ${commits.length} commits for PR #${args.prNumber}`);

      return commits;

    } catch (error) {
      console.error(`❌ Failed to fetch commits for PR #${args.prNumber}:`, error);
      return [];
    }
  },
});
