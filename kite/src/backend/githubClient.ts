import { Octokit } from '@octokit/rest';
import { TokenStore } from './tokenStore';
import {
  GitHubUser,
  GitHubRepo,
  GitHubIssue,
  GitHubPullRequest,
  GitHubBranch,
  ToolResult,
  CreatePrArgs,
  MergePrArgs,
  CreateBranchArgs,
  CreateIssueArgs,
  GetIssueArgs,
  UpdateIssueArgs,
  LockIssueArgs,
  UnlockIssueArgs
} from './types';

/**
 * GitHub API client with type-safe methods
 */
export class GitHubClient {
  private octokit: Octokit | null = null;
  private tokenStore: TokenStore;

  constructor() {
    this.tokenStore = new TokenStore();
  }

  /**
   * Initialize the GitHub client with authentication
   */
  private async ensureAuthenticated(): Promise<Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    const token = await this.tokenStore.load();
    if (!token) {
      throw new Error('Not authenticated. Please run login first.');
    }

    this.octokit = new Octokit({
      auth: token,
      userAgent: 'kite-github-client'
    });

    return this.octokit;
  }

  /**
   * Get the authenticated user
   */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    const octokit = await this.ensureAuthenticated();
    const { data } = await octokit.users.getAuthenticated();
    return data as GitHubUser;
  }

  /**
   * List repositories for the authenticated user
   */
  async listRepos(): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });

      return {
        success: true,
        count: repos.length,
        repos: repos,
        result: repos
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(args: CreatePrArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      // Normalize repo (allow just repo name by inferring authenticated owner)
      let { owner, repo } = args;
      if (!owner) {
        const user = await this.getAuthenticatedUser();
        owner = user.login;
      }

      const { data: pr } = await octokit.pulls.create({
        owner,
        repo,
        title: args.title,
        head: args.head,
        base: args.base,
        body: args.body,
        draft: args.draft,
        maintainer_can_modify: !args.noMaintainerModify
      });

      return {
        success: true,
        pr_number: pr.number,
        repo: `${owner}/${repo}`,
        title: args.title,
        body: args.body,
        head: args.head,
        base: args.base,
        url: pr.html_url,
        result: pr
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: args.repo,
        title: args.title,
        body: args.body
      };
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(args: MergePrArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      const { data: result } = await octokit.pulls.merge({
        owner: args.owner,
        repo: args.repo,
        pull_number: args.pullNumber,
        commit_title: args.commitTitle,
        commit_message: args.commitMessage,
        sha: args.sha,
        merge_method: args.mergeMethod
      });

      return {
        success: true,
        repo: `${args.owner}/${args.repo}`,
        pull_number: args.pullNumber,
        commit_title: args.commitTitle,
        commit_message: args.commitMessage,
        merge_method: args.mergeMethod,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        pull_number: args.pullNumber
      };
    }
  }

  /**
   * Create a new branch
   */
  async createBranch(args: CreateBranchArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      // Normalize repo (allow just repo name by inferring authenticated owner)
      let { repo } = args;
      let owner: string;
      
      if (repo.includes('/')) {
        [owner, repo] = repo.split('/', 2);
      } else {
        const user = await this.getAuthenticatedUser();
        owner = user.login;
      }

      // If no base branch is specified, find the repo's default branch
      let fromBranch = args.fromBranch;
      if (!fromBranch) {
        const { data: repoData } = await octokit.repos.get({ owner, repo });
        fromBranch = repoData.default_branch;
      }

      // Get the SHA of the base branch
      const { data: branchData } = await octokit.repos.getBranch({
        owner,
        repo,
        branch: fromBranch
      });

      // Create the new branch
      const { data: newBranch } = await octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${args.branch}`,
        sha: branchData.commit.sha
      });

      return {
        success: true,
        repo: `${owner}/${repo}`,
        branch: args.branch,
        from_branch: fromBranch,
        url: `https://github.com/${owner}/${repo}/tree/${args.branch}`,
        result: newBranch
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: args.repo,
        branch: args.branch
      };
    }
  }

  /**
   * Checkout a branch (get branch info)
   */
  async checkoutBranch(repo: string, branch: string): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      // Normalize repo (allow just repo name by inferring authenticated owner)
      let owner: string;
      let repoName: string;
      
      if (repo.includes('/')) {
        [owner, repoName] = repo.split('/', 2);
      } else {
        const user = await this.getAuthenticatedUser();
        owner = user.login;
        repoName = repo;
      }

      const { data: branchData } = await octokit.repos.getBranch({
        owner,
        repo: repoName,
        branch
      });

      return {
        success: true,
        repo: `${owner}/${repoName}`,
        branch: branch,
        branch_data: branchData,
        url: `https://github.com/${owner}/${repoName}/tree/${branch}`,
        result: branchData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: repo,
        branch: branch
      };
    }
  }

  /**
   * List issues for a repository
   */
  async listIssues(repo: string): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      // Normalize repo (allow just repo name by inferring authenticated owner)
      let owner: string;
      let repoName: string;
      
      if (repo.includes('/')) {
        [owner, repoName] = repo.split('/', 2);
      } else {
        const user = await this.getAuthenticatedUser();
        owner = user.login;
        repoName = repo;
      }

      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo: repoName,
        state: 'all',
        per_page: 100
      });

      return {
        success: true,
        repo: `${owner}/${repoName}`,
        issue_count: issues.length,
        issues: issues,
        result: issues
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: repo
      };
    }
  }

  /**
   * Create an issue
   */
  async createIssue(args: CreateIssueArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      const { data: issue } = await octokit.issues.create({
        owner: args.owner,
        repo: args.repo,
        title: args.title,
        body: args.body
      });

      return {
        success: true,
        issue_number: issue.number,
        repo: `${args.owner}/${args.repo}`,
        title: args.title,
        body: args.body,
        url: issue.html_url,
        result: issue
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        title: args.title,
        body: args.body
      };
    }
  }

  /**
   * Get a specific issue
   */
  async getIssue(args: GetIssueArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      const { data: issue } = await octokit.issues.get({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issueNumber
      });

      return {
        success: true,
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber,
        title: issue.title,
        state: issue.state,
        url: issue.html_url,
        result: issue
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber
      };
    }
  }

  /**
   * Update an issue
   */
  async updateIssue(args: UpdateIssueArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      const updateData: any = {};
      if (args.title !== undefined) updateData.title = args.title;
      if (args.body !== undefined) updateData.body = args.body;
      if (args.state !== undefined) updateData.state = args.state;
      if (args.assignee !== undefined) updateData.assignee = args.assignee;
      if (args.assignees !== undefined) updateData.assignees = args.assignees;
      if (args.milestone !== undefined) updateData.milestone = args.milestone;
      if (args.labels !== undefined) updateData.labels = args.labels;

      const { data: issue } = await octokit.issues.update({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issueNumber,
        ...updateData
      });

      return {
        success: true,
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber,
        title: args.title,
        body: args.body,
        state: args.state,
        url: issue.html_url,
        result: issue
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber
      };
    }
  }

  /**
   * Lock an issue
   */
  async lockIssue(args: LockIssueArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      await octokit.issues.lock({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issueNumber,
        lock_reason: args.lockReason
      });

      return {
        success: true,
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber,
        message: `Issue #${args.issueNumber} locked successfully!`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber
      };
    }
  }

  /**
   * Unlock an issue
   */
  async unlockIssue(args: UnlockIssueArgs): Promise<ToolResult> {
    try {
      const octokit = await this.ensureAuthenticated();
      
      await octokit.issues.unlock({
        owner: args.owner,
        repo: args.repo,
        issue_number: args.issueNumber
      });

      return {
        success: true,
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber,
        message: `Issue #${args.issueNumber} unlocked successfully!`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        repo: `${args.owner}/${args.repo}`,
        issue_number: args.issueNumber
      };
    }
  }
}
