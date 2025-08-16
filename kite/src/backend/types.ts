import { z } from 'zod';

// GitHub API Types
export interface GitHubUser {
  login: string;
  id: number;
  name?: string;
  email?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: GitHubUser;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  merged?: boolean;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

// Tool Types
export interface ToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: {
    type: string;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, ToolParameter>;
      required?: string[];
    };
  };
}

export interface ToolCall {
  tool: string;
  parameters: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

// Message Types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamingChunk {
  content?: string;
  tool_calls?: Array<{
    index: number;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

// Token Store Types
export interface TokenData {
  access_token: string;
  created_at?: string;
}

// CLI Command Types
export interface LoginArgs {
  scope?: string;
  open?: boolean;
}

export interface CreatePrArgs {
  owner: string;
  repo: string;
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
  noMaintainerModify?: boolean;
  open?: boolean;
}

export interface MergePrArgs {
  owner: string;
  repo: string;
  pullNumber: number;
  commitTitle?: string;
  commitMessage?: string;
  sha?: string;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}

export interface CreateBranchArgs {
  repo: string;
  branch: string;
  fromBranch?: string;
}

export interface CheckoutBranchArgs {
  branch: string;
  fromBranch?: string;
}

export interface CreateIssueArgs {
  owner: string;
  repo: string;
  title: string;
  body?: string;
}

export interface GetIssueArgs {
  owner: string;
  repo: string;
  issueNumber: number;
}

export interface UpdateIssueArgs {
  owner: string;
  repo: string;
  issueNumber: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  assignee?: string;
  assignees?: string[];
  milestone?: number;
  labels?: string[];
}

export interface LockIssueArgs {
  owner: string;
  repo: string;
  issueNumber: number;
  lockReason?: 'off-topic' | 'too heated' | 'resolved' | 'spam';
}

export interface UnlockIssueArgs {
  owner: string;
  repo: string;
  issueNumber: number;
}

// Zod Schemas for validation
export const ToolCallSchema = z.object({
  tool: z.string(),
  parameters: z.record(z.any())
});

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string()
});

export const ToolResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
}).passthrough();

// Environment Variables
export interface EnvironmentVariables {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  CEREBRAS_API_KEY: string;
}

// Cerebras API Types
export interface CerebrasChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CerebrasToolCall {
  index: number;
  function: {
    name: string;
    arguments: string;
  };
}

export interface CerebrasStreamingChunk {
  choices: Array<{
    delta: {
      content?: string;
      tool_calls?: CerebrasToolCall[];
    };
  }>;
}

// Intelligent Commit Splitting Types
export interface FileChange {
  file_path: string;
  change_type: 'added' | 'modified' | 'deleted';
  before_content?: string;
  after_content?: string;
  diff_content: string;
  total_lines_added: number;
  total_lines_removed: number;
}

export interface CommitGroup {
  feature_name: string;
  description: string;
  files: FileChange[];
  commit_title: string;
  commit_message: string;
}

export interface SupermemoryMemory {
  id: string;
  status: string;
}

export interface SupermemorySearchResult {
  results: any[];
  summary?: string;
}

export interface SupermemoryClient {
  addMemory(content: string, metadata?: Record<string, any>, containerTags?: string[]): Promise<SupermemoryMemory>;
  searchMemories(query: string, limit?: number, filters?: Record<string, any>, includeSummary?: boolean): Promise<SupermemorySearchResult>;
  deleteMemory(memoryId: string): Promise<boolean>;
  deleteMemoriesBatch(memoryIds: string[]): Promise<number>;
}

export interface CerebrasLLM {
  generateCommitMessage(fileChanges: FileChange[], featureName: string, semanticSummary?: string): Promise<{ title: string; message: string }>;
}

export interface IntelligentCommitSplitter {
  runIntelligentSplitting(autoPush?: boolean): Promise<CommitGroup[]>;
}
