"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// Ingest data from push event
export const ingestOnPush = action({
  args: {
    pushEvent: v.any(),
  },
  handler: async (ctx, args) => {
    const { pushEvent } = args;
    const { repository, commits, ref } = pushEvent;
    
    if (!repository || !commits || !ref) {
      console.error('Invalid push event structure');
      return;
    }

    const [owner, repo] = repository.full_name.split('/');
    const repoSlug = repository.full_name;

    // Get or create repository record
    let repoId = await ctx.runQuery(internal.repos.getRepoBySlug, { slug: repoSlug });
    if (!repoId) {
      repoId = await ctx.runMutation(internal.repos.createRepo, {
        slug: repoSlug,
        defaultBranch: repository.default_branch,
      });
    }

    // Process each commit
    for (const commit of commits) {
      try {
        await ctx.runAction(internal.ingest.processCommit, {
          owner,
          repo,
          sha: commit.id,
          repoId,
        });
      } catch (error) {
        console.error(`Failed to process commit ${commit.id}:`, error);
      }
    }
  },
});

// Process individual commit
export const processCommit = action({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
    repoId: v.id("repos"),
  },
  handler: async (ctx, args) => {
    const { owner, repo, sha, repoId } = args;

    // Check if commit already exists
    const existingCommit = await ctx.runQuery(internal.commits.getCommitBySha, {
      repoId,
      sha,
    });

    if (existingCommit) {
      console.log(`Commit ${sha} already exists, skipping`);
      return;
    }

    // Fetch commit data from GitHub using existing backend client
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    // Use the existing GitHub client pattern from your backend
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github+json,application/vnd.github.patch',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const commitData = await response.json();
    
    // Get patch data
    const patchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.patch',
        },
      }
    );

    const patch = await patchResponse.text();

    // Create commit record
    const commitId = await ctx.runMutation(internal.commits.createCommit, {
      repoId,
      sha,
      author: commitData.commit.author.name,
      committer: commitData.commit.committer.name,
      message: commitData.commit.message,
      timestamp: new Date(commitData.commit.author.date).getTime(),
      filesChanged: commitData.files?.length || 0,
      linesAdded: commitData.stats?.additions || 0,
      linesDeleted: commitData.stats?.deletions || 0,
      status: 'pending',
    });

    // Process files and hunks
    if (commitData.files) {
      for (const file of commitData.files) {
        await ctx.runAction(internal.ingest.processFile, {
          commitId,
          file,
          patch,
        });
      }
    }

    // Mark commit as ready for processing
    await ctx.runMutation(internal.commits.updateCommitStatus, {
      commitId,
      status: 'ready',
      ingestedAt: Date.now(),
    });

    // Trigger summarization and embedding
    await ctx.runAction(internal.summarize.summarizeHunks, { commitId });
    await ctx.runAction(internal.embed.embedHunks, { commitId });
  },
});

// Process file from commit
export const processFile = action({
  args: {
    commitId: v.id("commits"),
    file: v.any(),
    patch: v.string(),
  },
  handler: async (ctx, args) => {
    const { commitId, file, patch } = args;

    // Create file record
    const fileId = await ctx.runMutation(internal.files.createFile, {
      commitId,
      path: file.filename,
      status: file.status,
      stats: file.stats ? {
        additions: file.stats.additions,
        deletions: file.stats.deletions,
        changes: file.stats.changes,
      } : undefined,
      oldPath: file.previous_filename,
    });

    // Parse hunks from patch
    const hunks = parseHunksFromPatch(patch, file.filename);
    
    for (const hunk of hunks) {
      await ctx.runMutation(internal.hunks.createHunk, {
        fileId,
        hunkNo: hunk.hunkNo,
        rangeOld: hunk.rangeOld,
        rangeNew: hunk.rangeNew,
        patchHeader: hunk.patchHeader,
        beforeSnippet: hunk.beforeSnippet.substring(0, 1000), // Limit size
        afterSnippet: hunk.afterSnippet.substring(0, 1000), // Limit size
      });
    }
  },
});

// Parse hunks from patch for a specific file
function parseHunksFromPatch(patch: string, filePath: string): Array<{
  hunkNo: number;
  rangeOld: { start: number; len: number };
  rangeNew: { start: number; len: number };
  patchHeader: string;
  beforeSnippet: string;
  afterSnippet: string;
}> {
  const hunks: Array<{
    hunkNo: number;
    rangeOld: { start: number; len: number };
    rangeNew: { start: number; len: number };
    patchHeader: string;
    beforeSnippet: string;
    afterSnippet: string;
  }> = [];

  const lines = patch.split('\n');
  let currentHunk: any = null;
  let hunkNo = 0;
  let inTargetFile = false;

  for (const line of lines) {
    // Check if we're in the target file
    if (line.startsWith('diff --git')) {
      const filePathInPatch = line.split(' ')[2].substring(2); // Remove "a/" prefix
      inTargetFile = filePathInPatch === filePath;
      continue;
    }

    if (!inTargetFile) continue;

    // Hunk header
    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      
      const match = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        const [, oldStart, oldLen, newStart, newLen] = match;
        currentHunk = {
          hunkNo: hunkNo++,
          rangeOld: {
            start: parseInt(oldStart),
            len: oldLen ? parseInt(oldLen) : 1,
          },
          rangeNew: {
            start: parseInt(newStart),
            len: newLen ? parseInt(newLen) : 1,
          },
          patchHeader: line,
          beforeSnippet: '',
          afterSnippet: '',
        };
      }
      continue;
    }

    // Content lines
    if (currentHunk) {
      if (line.startsWith(' ')) {
        currentHunk.beforeSnippet += line.substring(1) + '\n';
        currentHunk.afterSnippet += line.substring(1) + '\n';
      } else if (line.startsWith('-')) {
        currentHunk.beforeSnippet += line.substring(1) + '\n';
      } else if (line.startsWith('+')) {
        currentHunk.afterSnippet += line.substring(1) + '\n';
      }
    }
  }

  // Add the last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

// Ingest data from PR event
export const ingestOnPR = action({
  args: {
    prEvent: v.any(),
  },
  handler: async (ctx, args) => {
    const { prEvent } = args;
    const { repository, pull_request, action } = prEvent;
    
    if (!repository || !pull_request) {
      console.error('Invalid PR event structure');
      return;
    }

    const [owner, repo] = repository.full_name.split('/');
    const repoSlug = repository.full_name;

    // Get or create repository record
    let repoId = await ctx.runQuery(internal.repos.getRepoBySlug, { slug: repoSlug });
    if (!repoId) {
      repoId = await ctx.runMutation(internal.repos.createRepo, {
        slug: repoSlug,
        defaultBranch: repository.default_branch,
      });
    }

    // Create or update PR record
    const prId = await ctx.runMutation(internal.prs.upsertPR, {
      repoId,
      number: pull_request.number,
      title: pull_request.title,
      body: pull_request.body || '',
      state: pull_request.state,
      labels: pull_request.labels.map((l: any) => l.name),
      mergeable: pull_request.mergeable,
      createdAt: new Date(pull_request.created_at).getTime(),
      updatedAt: new Date(pull_request.updated_at).getTime(),
    });

    // Fetch PR files and comments using existing backend pattern
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN not configured');
    }

    // Get PR files
    const filesResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_request.number}/files`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );

    if (filesResponse.ok) {
      const files = await filesResponse.json();
      for (const file of files) {
        await ctx.runMutation(internal.pr_files.createPRFile, {
          prId,
          path: file.filename,
          status: file.status,
          patchHeader: file.patch,
          stats: {
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
          },
        });
      }
    }

    // Get PR comments
    const commentsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${pull_request.number}/comments`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github+json',
        },
      }
    );

    if (commentsResponse.ok) {
      const comments = await commentsResponse.json();
      for (const comment of comments) {
        await ctx.runMutation(internal.pr_comments.createPRComment, {
          prId,
          author: comment.user.login,
          body: comment.body,
          createdAt: new Date(comment.created_at).getTime(),
          type: 'issue',
        });
      }
    }
  },
});

// Ingest PR review
export const ingestOnPRReview = action({
  args: {
    reviewEvent: v.any(),
  },
  handler: async (ctx, args) => {
    const { reviewEvent } = args;
    const { repository, pull_request, review } = reviewEvent;
    
    if (!repository || !pull_request || !review) {
      console.error('Invalid PR review event structure');
      return;
    }

    const repoSlug = repository.full_name;
    const repoId = await ctx.runQuery(internal.repos.getRepoBySlug, { slug: repoSlug });
    if (!repoId) return;

    const prId = await ctx.runQuery(internal.prs.getPRByNumber, {
      repoId,
      number: pull_request.number,
    });
    if (!prId) return;

    // Create review comment
    await ctx.runMutation(internal.pr_comments.createPRComment, {
      prId,
      author: review.user.login,
      body: review.body || '',
      createdAt: new Date(review.submitted_at).getTime(),
      type: 'review',
    });
  },
});

// Ingest comment
export const ingestOnComment = action({
  args: {
    commentEvent: v.any(),
  },
  handler: async (ctx, args) => {
    const { commentEvent } = args;
    const { repository, issue, comment } = commentEvent;
    
    if (!repository || !issue || !comment) {
      console.error('Invalid comment event structure');
      return;
    }

    // Only process PR comments (not issue comments)
    if (!issue.pull_request) return;

    const repoSlug = repository.full_name;
    const repoId = await ctx.runQuery(internal.repos.getRepoBySlug, { slug: repoSlug });
    if (!repoId) return;

    const prId = await ctx.runQuery(internal.prs.getPRByNumber, {
      repoId,
      number: issue.number,
    });
    if (!prId) return;

    // Create comment
    await ctx.runMutation(internal.pr_comments.createPRComment, {
      prId,
      author: comment.user.login,
      body: comment.body,
      createdAt: new Date(comment.created_at).getTime(),
      type: 'issue',
    });
  },
});
