import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GitHubClient } from './githubClient';
import { IntelligentCommitSplitter } from './intelligentCommitSplitter';
import {
  ChatMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  CerebrasMessage,
  CerebrasResponse
} from './types';
import { CEREBRAS_API_KEY, validateConfig } from './config';
import { parseMarkdownToText } from './markdownParser';
import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * GPT-OSS Tool Caller with Cerebras integration
 * Provides AI-powered GitHub repository management
 */
export class GPTOSSToolCaller {
  private modelId: string;
  private client: Cerebras;
  private githubClient: GitHubClient;
  private tools: ToolDefinition[];

  constructor(modelId: string = 'gpt-oss-120b') {
    this.modelId = modelId;
    
    // Validate environment configuration
    validateConfig();
    
    this.client = new Cerebras({
      apiKey: CEREBRAS_API_KEY
    });
    this.githubClient = new GitHubClient();
    
    // Define available tools
    this.tools = [
      {
        type: 'function',
        function: {
          name: 'list_repos',
          description: 'List all repositories for the authenticated user.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_pull_requests',
          description: 'List pull requests for a given repository. Can filter by state (open, closed, or all).',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              state: {
                type: 'string',
                description: 'Filter pull requests by state (open, closed, or all)',
                enum: ['open', 'closed', 'all']
              }
            },
            required: ['repo']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_pull_request',
          description: 'Get details of a specific pull request by number.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number to retrieve'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_pull_request',
          description: 'Update an existing pull request with new title, body, state, or base branch.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number to update'
              },
              title: {
                type: 'string',
                description: 'New title for the pull request'
              },
              body: {
                type: 'string',
                description: 'New body/description for the pull request'
              },
              state: {
                type: 'string',
                description: 'State of the pull request (open or closed)',
                enum: ['open', 'closed']
              },
              base: {
                type: 'string',
                description: 'New base branch for the pull request'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_pull_request_commits',
          description: 'List all commits on a pull request.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number'
              },
              per_page: {
                type: 'integer',
                description: 'Number of commits per page (default: 100)'
              },
              page: {
                type: 'integer',
                description: 'Page number (default: 1)'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_pull_request_files',
          description: 'List all files changed in a pull request.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number'
              },
              per_page: {
                type: 'integer',
                description: 'Number of files per page (default: 100)'
              },
              page: {
                type: 'integer',
                description: 'Page number (default: 1)'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_pull_request_merged',
          description: 'Check if a pull request has been merged.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number to check'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_pull_request_branch',
          description: 'Update a pull request branch with the latest upstream changes by merging HEAD from the base branch.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number'
              },
              expected_head_sha: {
                type: 'string',
                description: 'The expected SHA of the pull request\'s HEAD ref (optional)'
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'checkout_branch',
          description: 'Switch to a different branch in a repository. Use this when you want to change branches without committing changes.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              branch: {
                type: 'string',
                description: 'The name of the branch to checkout'
              }
            },
            required: ['repo', 'branch']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_pr',
          description: 'Create a pull request for a given repository. ONLY use this after confirming: 1) Head branch exists, 2) User has provided all required info (repo, title, description, head, base), 3) Any uncommitted changes have been handled. NEVER assume branch names - always get them from user.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              title: {
                type: 'string',
                description: 'The title of the pull request'
              },
              body: {
                type: 'string',
                description: 'The body of the pull request'
              },
              head: {
                type: 'string',
                description: 'The head branch (defaults to \'feature-branch\')'
              },
              base: {
                type: 'string',
                description: 'The base branch (defaults to \'main\')'
              }
            },
            required: ['repo', 'title', 'body']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_issue',
          description: 'Create an issue for a given repository.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              title: {
                type: 'string',
                description: 'The title of the issue'
              },
              body: {
                type: 'string',
                description: 'The body of the issue'
              }
            },
            required: ['repo', 'title', 'body']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_branch',
          description: 'Create a new branch in a GitHub repository.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              branch: {
                type: 'string',
                description: 'The name for the new branch'
              },
              from_branch: {
                type: 'string',
                description: 'The base branch to branch from (defaults to repo\'s default)'
              }
            },
            required: ['repo', 'branch']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_issues',
          description: 'List all issues for a repository.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              }
            },
            required: ['repo']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_issue',
          description: 'Get a specific issue by number.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              issue_number: {
                type: 'integer',
                description: 'The issue number to retrieve'
              }
            },
            required: ['repo', 'issue_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_issue',
          description: 'Update an existing issue.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              issue_number: {
                type: 'integer',
                description: 'The issue number to update'
              },
              title: {
                type: 'string',
                description: 'New title for the issue'
              },
              body: {
                type: 'string',
                description: 'New body/description for the issue'
              },
              state: {
                type: 'string',
                description: 'State of the issue (open or closed)',
                enum: ['open', 'closed']
              }
            },
            required: ['repo', 'issue_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'merge_pr',
          description: 'Merge a pull request. Use this when user asks to merge a PR. You need the repository name and pull request number.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              pull_number: {
                type: 'integer',
                description: 'The pull request number to merge'
              },
              commit_title: {
                type: 'string',
                description: 'Title for the merge commit'
              },
              commit_message: {
                type: 'string',
                description: 'Message to append to the merge commit'
              },
              merge_method: {
                type: 'string',
                description: 'Merge method to use',
                enum: ['merge', 'squash', 'rebase']
              }
            },
            required: ['repo', 'pull_number']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'intelligent_commit_split',
          description: 'This is the PRIMARY tool for committing code. Intelligently split uncommitted changes into logical commits using AI analysis. This tool analyzes file changes semantically and groups them into meaningful commits with proper conventional commit messages. Use this when user wants to commit changes. ALWAYS check conversation history for commit message if user provided one. Includes automatic threshold checking and intelligent commit splitting for large changes. If a branch parameter is provided, it will create and switch to that branch before committing. NOTE: Only pushes to remote if user explicitly mentions "push" - otherwise only commits locally.',
          parameters: {
            type: 'object',
            properties: {
              auto_push: {
                type: 'boolean',
                description: 'Whether to automatically push the commits after splitting (default: false - only set to true if user explicitly mentions "push")'
              },
              dry_run: {
                type: 'boolean',
                description: 'Whether to only analyze and show what would be done without actually creating commits (default: false)'
              },
              commit_message: {
                type: 'string',
                description: 'The commit message to use (optional - if not provided, intelligent commit splitting will generate appropriate messages)'
              },
              branch: {
                type: 'string',
                description: 'The branch to create and switch to before committing (optional, uses current branch if not specified)'
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of specific files to commit (optional, commits all changes if not specified)'
              },
              force_intelligent_split: {
                type: 'boolean',
                description: 'Force intelligent commit splitting even for small changes (default: false)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_changes_threshold',
          description: 'Check if uncommitted changes exceed the threshold (1000 lines) and return analysis of changes.',
          parameters: {
            type: 'object',
            properties: {
              threshold: {
                type: 'integer',
                description: 'Line threshold to check against (default: 1000)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_git_status',
          description: 'Check the current git status including current branch, uncommitted changes, and remote status. Use this to understand the repository state before making changes.',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'check_branch_exists',
          description: 'Check if a specific branch exists in the repository. Use this before creating PRs to ensure the head branch exists.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              branch: {
                type: 'string',
                description: 'The branch name to check'
              }
            },
            required: ['repo', 'branch']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'list_repository_commits',
          description: 'List recent commits in a repository. Use this to see commit history, latest commits, or specific branch commits.',
          parameters: {
            type: 'object',
            properties: {
              repo: {
                type: 'string',
                description: 'The repository name in \'owner/repo\' format'
              },
              branch: {
                type: 'string',
                description: 'The branch to list commits from (default: main)'
              },
              per_page: {
                type: 'integer',
                description: 'Number of commits to return (default: 10, max: 100)'
              }
            },
            required: ['repo']
          }
        }
      }
    ];
  }

  /**
   * System prompt for the AI assistants
   */
  private getSystemPrompt(reasoningLevel: string = 'medium'): string {
    return `Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

CRITICAL: When executing tools, ONLY execute the tool and return the result. DO NOT add any additional commentary, explanations, or text after tool execution. The tool results are complete and self-explanatory. If you need to use a tool, do not include any text content in your response - only use the tool. NEVER generate text content when using tools - only call the tool and stop. IMPORTANT: When you use a tool, do not write any text in the content field - only make the tool call.

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- When user provides a commit message, use intelligent_commit_split tool (not checkout_branch)
- When user wants to commit changes, use intelligent_commit_split tool
- When user wants to commit and push to a new branch, use intelligent_commit_split tool with branch parameter
- Only use checkout_branch when user specifically wants to switch branches without committing
- ALWAYS check conversation history for commit messages, repository names, and other parameters
- If user provided information in previous messages, use that information in tool calls
- Never ask for information that was already provided in the conversation
- For complex workflows, you can use multiple tools in sequence to accomplish the task
- After each tool execution, analyze the result and decide if additional tools are needed
- DO NOT provide additional commentary after tool execution unless specifically requested by the user
- DO NOT use list_repos unless user specifically asks to see all repositories
- When user asks to create something (PR, issue, branch), ask for required information instead of listing repositories
- NEVER assume branch names, repository names, or any other parameters - always ask the user
- Follow the exact workflow steps in order - do not skip steps or make assumptions
- When user asks to "merge the open pr" or "merge pr", use list_pull_requests to find open PRs, then use merge_pr
- When user asks to "commit and push", use intelligent_commit_split tool with auto_push=true, NOT check_changes_threshold or check_git_status
- When user asks to "commit and push to [branch name]", use intelligent_commit_split tool with branch parameter and auto_push=true
- When user asks to "commit" (without "push"), use intelligent_commit_split tool with auto_push=false
- Always use the most specific tool for the task - don't use generic tools when specific ones exist


    
    COMMUNICATION STYLE:
    - Be very concise
    - Always prioritize safety - confirm before doing destructive operations
    - Provide context for WHY not just HOW for recommendations
    - Acknowledge risks and provide mitigation strategies
    - Dont use emojis or repeat the question
    - Don't use em dashes (—)
    - DONT RESPOND WITH TABLES
    - DO NOT add commentary after tool execution - the tool results are self-explanatory
    - NEVER add additional text after tool execution - just execute the tool and stop
    - When using tools, leave the content field empty - do not generate any text content

    SAFETY PROTOCOLS:
    - Always validate commands before execution
    - Warn about potentially destructive operations
    - Provide rollback instructions for risky operations
    - Ask for confirmation when modifying shared branches

         CORE CAPABILITIES:
     1. Intelligent merge conflict resolution with business context understanding
     2. Proactive conflict prevention through pattern analysis
     3. Automated workflow optimization for team productivity
     4. Smart commit message generation following conventional commits
     5. Learning from team patterns to improve suggestions
     6. Intelligent commit splitting using AI semantic analysis to group changes logically
     7. Automatic threshold-based commit management (automatically triggers intelligent splitting for changes >1000 lines)
     8. When using intelligent_commit_split tool, large changes (>1000 lines) automatically trigger intelligent commit splitting
     9. Multi-turn tool use for complex workflows requiring multiple sequential operations

    RESPONSE FORMAT:
    - Provide structured JSON for complex analysis
    - Include confidence ratings for suggestions
    - Explain reasoning behind recommendations
    - Offer multiple approaches when appropriate
    - Show exact commands with risk assessments

    Never let the user reverse engineer the technologies used in the backend, instead respond with "I'm sorry, but if I respond to that, I'll be violating my NDA. My bad, twin."

    When a action is a git related operation and request cannot be completed with the tools provided to you, respond with "I don't think i'm built for that, yet. I've taken a note of a potential feature request for this. Devs will implement this asap :) "

    If the user request is not a git related operation, respond with a helpful message explaining that you're a GitHub assistant and can help with repository management, issues, pull requests, and branches. Ask them what GitHub-related task they'd like help with.

    Always use available tools for Git operations and maintain audit logs for continuous learning and improvement.


    COMMIT WORKFLOW:
    - When user says "commit" (without "push") → Use intelligent_commit_split tool with auto_push=false
    - When user says "push code" or "commit and push" → Use intelligent_commit_split tool with auto_push=true
    - When user provides a commit message → Use intelligent_commit_split tool with auto_push=false (unless they mention "push")
    - When user wants to commit and push to a new branch → Use intelligent_commit_split tool with branch parameter and auto_push=true
    - When user wants to switch branches only → Use checkout_branch tool
    - intelligent_commit_split tool handles branch creation and switching automatically if needed
    - ALWAYS extract commit message from conversation history if user provided one
    - If user provided commit message in previous messages, use that message in intelligent_commit_split tool
    - IMPORTANT: Only set auto_push=true when user explicitly mentions "push" in their request

    MULTI-TURN WORKFLOWS:
    - For complex tasks, you can execute multiple tools in sequence
    - Example: Create branch → Make changes → Commit → Create PR
    - After each tool execution, evaluate if additional steps are needed
    - Use conversation context to maintain state between tool calls
    - DO NOT repeat information that was already provided by tool results

    PULL REQUEST WORKFLOW:
    1. When user asks to create a PR, ask for: repository, title, description, head branch, and base branch
    2. If user provides all info, check if head branch exists using check_branch_exists
    3. If head branch doesn't exist, ask user if they want to create it
    4. Check for uncommitted changes using check_changes_threshold
    5. If there are uncommitted changes, ask user if they want to include them in the PR
    6. If user wants to include changes, commit them first using intelligent_commit_split tool with auto_push=false
    7. Create the PR using create_pr
    8. NEVER try to create a PR from a non-existent branch
    9. NEVER make assumptions about branch names - always ask the user



    Reasoning: ${reasoningLevel}`;
  }

  /**
   * Execute a tool call
   */
  public async executeTool(toolName: string, parameters: Record<string, any>): Promise<ToolResult> {
    switch (toolName) {
      case 'list_repos':
        return await this.githubClient.listRepos();
      
      case 'checkout_branch':
        {
          const branchResult = await this.githubClient.checkoutBranch(parameters['repo'], parameters['branch']);
          // Attempt local checkout as well for immediate usability
          try {
            const targetBranch = parameters['branch'];
            // Ensure we have the latest refs for that branch
            await this.execAsync(`git fetch origin ${targetBranch}`);
            // Check if local branch already exists
            let localExists = false;
            try {
              await this.execAsync(`git rev-parse --verify ${targetBranch}`);
              localExists = true;
            } catch {}
            if (localExists) {
              await this.execAsync(`git switch ${targetBranch}`);
            } else {
              await this.execAsync(`git switch -c ${targetBranch} --track origin/${targetBranch}`);
            }
            return {
              ...branchResult,
              local_switched: true,
              message: `Switched locally to '${targetBranch}'`
            } as ToolResult;
          } catch (err) {
            return {
              ...branchResult,
              local_switched: false,
              local_error: err instanceof Error ? err.message : String(err)
            } as ToolResult;
          }
        }
      
      case 'create_pr':
        return await this.githubClient.createPullRequest({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          title: parameters['title'],
          body: parameters['body'],
          head: parameters['head'] || 'feature-branch',
          base: parameters['base'] || 'main'
        });
      
      case 'create_issue':
        return await this.githubClient.createIssue({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          title: parameters['title'],
          body: parameters['body']
        });
      
      case 'create_branch':
        {
          const result = await this.githubClient.createBranch({
            repo: parameters['repo'],
            branch: parameters['branch'],
            fromBranch: parameters['from_branch']
          });
          if (result.success) {
            // Automatically set up and switch to the new branch locally
            try {
              const targetBranch = parameters['branch'];
              await this.execAsync(`git fetch origin ${targetBranch}`);
              // If branch already exists locally, just switch
              let localExists = false;
              try {
                await this.execAsync(`git rev-parse --verify ${targetBranch}`);
                localExists = true;
              } catch {}
              if (localExists) {
                await this.execAsync(`git switch ${targetBranch}`);
              } else {
                await this.execAsync(`git switch -c ${targetBranch} --track origin/${targetBranch}`);
              }
              return {
                ...result,
                local_switched: true,
                message: `Branch '${targetBranch}' created remotely and switched locally`
              } as ToolResult;
            } catch (err) {
              return {
                ...result,
                local_switched: false,
                local_error: err instanceof Error ? err.message : String(err)
              } as ToolResult;
            }
          }
          return result;
        }
      case 'list_pull_requests':
        return await this.githubClient.listPullRequests(parameters['repo'], parameters['state']);
      
      case 'get_pull_request':
        return await this.githubClient.getPullRequest({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number']
        });
      
      case 'update_pull_request':
        return await this.githubClient.updatePullRequest({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number'],
          title: parameters['title'],
          body: parameters['body'],
          state: parameters['state'],
          base: parameters['base']
        });
      
      case 'list_pull_request_commits':
        return await this.githubClient.listPullRequestCommits({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number'],
          perPage: parameters['per_page'],
          page: parameters['page']
        });
      
      case 'list_pull_request_files':
        return await this.githubClient.listPullRequestFiles({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number'],
          perPage: parameters['per_page'],
          page: parameters['page']
        });
      
      case 'check_pull_request_merged':
        return await this.githubClient.checkPullRequestMerged({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number']
        });
      
      case 'update_pull_request_branch':
        return await this.githubClient.updatePullRequestBranch({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number'],
          expectedHeadSha: parameters['expected_head_sha']
        });
      
      case 'list_issues':
        return await this.githubClient.listIssues(parameters['repo']);
      
      case 'get_issue':
        return await this.githubClient.getIssue({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          issueNumber: parameters['issue_number']
        });
      
      case 'update_issue':
        return await this.githubClient.updateIssue({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          issueNumber: parameters['issue_number'],
          title: parameters['title'],
          body: parameters['body'],
          state: parameters['state']
        });
      
      case 'merge_pr':
        return await this.githubClient.mergePullRequest({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          pullNumber: parameters['pull_number'],
          commitTitle: parameters['commit_title'],
          commitMessage: parameters['commit_message'],
          mergeMethod: parameters['merge_method']
        });
      
      case 'intelligent_commit_split':
        return await this.executeIntelligentCommitSplit(parameters);
      
      case 'check_changes_threshold':
        return await this.executeCheckChangesThreshold(parameters);
      
      case 'check_git_status':
        return await this.executeCheckGitStatus();
      
      case 'list_repository_commits':
        return await this.githubClient.listRepositoryCommits({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          branch: parameters['branch'],
          perPage: parameters['per_page']
        });
      
      case 'check_branch_exists':
        return await this.githubClient.checkBranchExists({
          owner: parameters['repo']?.split('/')[0],
          repo: parameters['repo']?.split('/')[1] || parameters['repo'],
          branch: parameters['branch']
        });
      
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        };
    }
  }

  /**
   * Extract tool call from JSON response
   */
  private extractToolCall(response: string): ToolCall | null {
    try {
      // Look for JSON code blocks in the response
      const jsonPattern = /```json\s*(\{.*?\})\s*```/s;
      const match = response.match(jsonPattern);
      
      if (!match) {
        return null;
      }
      
      const toolCall = JSON.parse(match[1] || '{}');
      if (toolCall.tool && toolCall.parameters) {
        return toolCall;
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
    
    return null;
  }

  /**
   * Format messages with tools for Cerebras API
   */
  private formatMessagesWithTools(messages: ChatMessage[]): string {
    let formatted = '';
    
    // Add tool definitions
    for (const tool of this.tools) {
      if (tool.type === 'function') {
        const func = tool.function;
        formatted += `## ${func.name}\n`;
        formatted += `${func.description}\n\n`;
        
        if (func.parameters.properties) {
          formatted += 'Parameters:\n';
          for (const [paramName, paramInfo] of Object.entries(func.parameters.properties)) {
            const paramType = paramInfo.type || 'unknown';
            const description = paramInfo.description || '';
            const required = func.parameters.required?.includes(paramName) || false;
            formatted += `- ${paramName} (${paramType})${required ? ' [required]' : ''}: ${description}\n`;
          }
        }
        formatted += '\n';
      }
    }
    
    formatted += 'To use a tool, respond with:\n';
    formatted += '```json\n{\n';
    formatted += '  "tool": "tool_name",\n';
    formatted += '  "parameters": {\n';
    formatted += '    "param1": "value1",\n';
    formatted += '    "param2": "value2"\n';
    formatted += '  }\n';
    formatted += '}\n';
    formatted += '```\n\n';
    
    // Add conversation history
    for (const message of messages) {
      formatted += `${message.role.toUpperCase()}: ${message.content}\n\n`;
    }
    
    formatted += 'ASSISTANT: ';
    return formatted;
  }

  /**
   * Format tool result into user-friendly message
   */
  private formatToolResult(toolName: string, result: ToolResult): string {
    if (!result.success) {
      return `❌ ${result.error || 'Operation failed'}${result.suggestion ? `\n💡 ${result.suggestion}` : ''}`;
    }

    switch (toolName) {
      case 'list_repos':
        const repos = result.repos || [];
        if (repos.length === 0) {
          return '📁 No repositories found.';
        }
        return `📁 Found ${repos.length} repository${repos.length === 1 ? '' : 'ies'}:\n${repos.map((repo: any) => `• ${repo.full_name}`).join('\n')}`;

      case 'checkout_branch':
        return `✅ Successfully switched to branch '${result.branch || 'unknown'}'`;

      case 'create_pr':
        return `✅ Pull request created successfully!\n🔗 ${result.url || 'URL not available'}\n📝 Title: ${result.title || 'No title'}`;

      case 'create_issue':
        return `✅ Issue created successfully!\n🔗 ${result.url || 'URL not available'}\n📝 Title: ${result.title || 'No title'}`;

      case 'create_branch':
        return `✅ Branch '${result.branch || 'unknown'}' created successfully`;

      case 'list_pull_requests':
        const pullRequests = result.pull_requests || [];
        if (pullRequests.length === 0) {
          return '📋 No pull requests found in this repository.';
        }
        
        const repoName = result.repo || 'unknown repository';
        const formattedPRs = pullRequests.map((pr: any) => {
          const openedDate = new Date(pr.created_at).toLocaleDateString();
          const assignees = pr.assignees?.map((a: any) => a.login).join(', ') || 'unassigned';
          const reviewers = pr.requested_reviewers?.map((r: any) => r.login).join(', ') || 'none';
          
          return `• **#${pr.number}**: ${pr.title}\n  📅 Opened: ${openedDate}\n  👤 Assignees: ${assignees}\n  👀 Reviewers: ${reviewers}`;
        }).join('\n\n');
        
        return `📋 Found ${pullRequests.length} pull request${pullRequests.length === 1 ? '' : 's'}:\n\n${formattedPRs}`;

      case 'get_pull_request':
        const pr = result.pull_request;
        if (!pr) {
          return '❌ Pull request not found';
        }
        const prState = pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
        const prMerged = pr.merged ? '✅ Merged' : '⏳ Not merged';
        return `📋 **Pull Request #${pr.number}**: ${pr.title}\n\n${prState} | ${prMerged}\n\n📝 **Description**:\n${pr.body || 'No description provided'}\n\n🔗 **URL**: ${pr.url}`;

      case 'update_pull_request':
        const updateMessage = result.state === 'closed' ? 'closed' : 'updated';
        return `✅ Pull request #${result.pull_number || 'unknown'} ${updateMessage} successfully`;

      case 'list_pull_request_commits':
        const commits = result.commits || [];
        if (commits.length === 0) {
          return '📋 No commits found in this pull request.';
        }
        const commitList = commits.map((commit: any) => {
          const commitDate = new Date(commit.commit.author.date).toLocaleDateString();
          return `• ${commit.sha.substring(0, 7)} - ${commit.commit.message.split('\n')[0]} (${commitDate})`;
        }).join('\n');
        return `📋 Found ${commits.length} commit${commits.length === 1 ? '' : 's'} in pull request #${result.pull_number}:\n${commitList}`;

      case 'list_pull_request_files':
        const files = result.files || [];
        if (files.length === 0) {
          return '📋 No files found in this pull request.';
        }
        const fileList = files.map((file: any) => {
          const status = file.status === 'added' ? '🟢 Added' : file.status === 'modified' ? '🟡 Modified' : '🔴 Removed';
          return `• ${file.filename} (${status}) - +${file.additions} -${file.deletions}`;
        }).join('\n');
        return `📋 Found ${files.length} file${files.length === 1 ? '' : 's'} in pull request #${result.pull_number}:\n${fileList}`;

      case 'check_pull_request_merged':
        const isMerged = result.merged;
        const mergeStatus = isMerged ? '✅ Merged' : '⏳ Not merged';
        return `📋 Pull request #${result.pull_number}: ${mergeStatus}`;

      case 'update_pull_request_branch':
        return `✅ Pull request #${result.pull_number || 'unknown'} branch updated successfully`;

      case 'list_issues':
        const issues = result.issues || [];
        if (issues.length === 0) {
          return '📋 No issues found in this repository.';
        }
        return `📋 Found ${issues.length} issue${issues.length === 1 ? '' : 's'}:\n${issues.map((issue: any) => `• #${issue.number}: ${issue.title} (${issue.state})`).join('\n')}`;

      case 'get_issue':
        const issue = result.issue;
        if (!issue) {
          return '❌ Issue not found';
        }
        return `📋 Issue #${issue.number}: ${issue.title}\n📝 ${issue.body || 'No description'}\n🔗 ${issue.url}`;

      case 'update_issue':
        return `✅ Issue #${result.issue_number || 'unknown'} updated successfully`;

      case 'merge_pr':
        return `✅ Pull request #${result.pull_number || 'unknown'} merged successfully`;

      case 'intelligent_commit_split':
        if (result.dry_run) {
          return `📋 Analysis complete! Found ${result.commit_groups_count} logical commit groups:\n${(result.commit_groups || []).map((group: any, i: number) => 
            `${i + 1}. ${group.commit_title}\n   Files: ${group.files.length} file${group.files.length === 1 ? '' : 's'}`
          ).join('\n')}\n\nNo commits were created (dry run mode).`;
        }
        if (result.action === 'custom_commit') {
          const branchInfo = result.branch_created ? `\n🌿 Created and switched to branch: '${result.branch_created}'` : '';
          return `✅ Successfully committed with custom message: '${result.commit_message}'${branchInfo}${result.pushed ? '\n📤 Pushed to remote' : ''}`;
        }
        return `✅ Successfully created ${result.commit_groups_count} logical commits${result.auto_push ? ' and pushed to remote' : ''}`;

      case 'check_changes_threshold':
        const totalChanges = result.total_changes || 0;
        const threshold = result.threshold || 1000;
        if (result.exceeds_threshold) {
          return `⚠️ Large changes detected: ${totalChanges} lines (threshold: ${threshold})\n📁 ${result.file_count} files changed\n💡 Recommendation: Use intelligent commit splitting`;
        }
        return `✅ Changes are within threshold: ${totalChanges} lines (threshold: ${threshold})\n📁 ${result.file_count} files changed`;

      case 'check_git_status':
        const currentBranch = result.current_branch || 'unknown';
        const statusSummary = result.status_summary || 'Unknown status';
        if (result.has_uncommitted_changes) {
          const stagedCount = result.staged_files_count || 0;
          const unstagedCount = result.unstaged_files_count || 0;
          return `📋 **Current Branch**: ${currentBranch}\n📝 **Status**: ${statusSummary}\n📁 **Staged**: ${stagedCount} files\n📁 **Unstaged**: ${unstagedCount} files`;
        }
        return `📋 **Current Branch**: ${currentBranch}\n✅ **Status**: ${statusSummary}`;

      case 'list_repository_commits':
        const repoCommits = result.commits || [];
        if (repoCommits.length === 0) {
          return `📋 No commits found in repository ${result.repo}`;
        }
        const repoCommitList = repoCommits.map((commit: any) => {
          const commitDate = new Date(commit.commit.author.date).toLocaleDateString();
          const shortSha = commit.sha.substring(0, 7);
          const message = commit.commit.message.split('\n')[0];
          return `• ${shortSha} - ${message} (${commitDate})`;
        }).join('\n');
        return `📋 Found ${repoCommits.length} commit${repoCommits.length === 1 ? '' : 's'} in ${result.repo}${result.branch ? ` (${result.branch} branch)` : ''}:\n${repoCommitList}`;

      case 'check_branch_exists':
        const branchExists = result.exists;
        const branchName = result.branch || 'unknown';
        if (branchExists) {
          return `✅ Branch '${branchName}' exists`;
        } else {
          return `❌ Branch '${branchName}' does not exist`;
        }

      default:
        return `✅ ${toolName} completed successfully`;
    }
  }

  /**
   * Stream tool calls with real-time response generation and multi-turn support
   */
  async *callToolsStream(
    messages: ChatMessage[], 
    reasoningLevel: string = 'medium'
  ): AsyncGenerator<string> {
    const systemPrompt = this.getSystemPrompt(reasoningLevel);
    
    // Prepare initial messages for Cerebras API
    const apiMessages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
    
    // Add user messages
    for (const message of messages) {
      if (message.role === 'user') {
        apiMessages.push({
          role: 'user',
          content: message.content + '\n\nIMPORTANT: If you need to use a tool, do not write any text content - only make the tool call.'
        });
      }
    }
    
    try {
      let turnCount = 0;
      const maxTurns = 10; // Prevent infinite loops
      
      while (turnCount < maxTurns) {
        turnCount++;
        
        // Make API call
        const response = await this.client.chat.completions.create({
          messages: apiMessages,
          model: this.modelId,
          stream: false, // Disable streaming for multi-turn to handle tool calls properly
          max_tokens: 1024,
          temperature: 0.1, // Lower temperature to reduce creative content generation
          tools: this.tools as any
        });
        
        const choice = (response as any).choices[0];
        const message = choice.message;
        
        // If no tool calls, we're done - stream the final response
        if (!message.tool_calls || message.tool_calls.length === 0) {
          // Only yield content if it's meaningful and not just tool execution commentary
          if (message.content && message.content.trim()) {
            // Parse markdown content for better display
            const parsedContent = parseMarkdownToText(message.content);
            yield parsedContent;
          }
          break;
        }
        
        // Save the assistant's message with tool calls
        apiMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls
        });
        
        // Execute all tool calls sequentially
        for (const toolCall of message.tool_calls) {
          try {
            const toolName = toolCall.function.name;
            const argsStr = toolCall.function.arguments || '{}';
            const parameters = JSON.parse(argsStr);
            
            // Execute the tool
            const result = await this.executeTool(toolName, parameters);
            
            // Format the result for user display
            const userMessage = this.formatToolResult(toolName, result);
            
            // Yield the tool execution result to the user
            yield `\n\n${userMessage}`;
            
            // Add tool response to conversation for next turn
            apiMessages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCall.id
            });
            
          } catch (error) {
            const errorMessage = `❌ Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`;
            yield `\n\n${errorMessage}`;
            
            // Add error response to conversation
            apiMessages.push({
              role: 'tool',
              content: JSON.stringify({ success: false, error: errorMessage }),
              tool_call_id: toolCall.id
            });
          }
        }
      }
      
      if (turnCount >= maxTurns) {
        yield `\n\n⚠️ Maximum tool call turns (${maxTurns}) reached. Stopping to prevent infinite loops.`;
      }
      
    } catch (error) {
      yield `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Multi-turn tool calling without streaming (for simpler use cases)
   */
  async callToolsMultiTurn(
    messages: ChatMessage[], 
    reasoningLevel: string = 'medium'
  ): Promise<string> {
    const systemPrompt = this.getSystemPrompt(reasoningLevel);
    
    // Prepare initial messages for Cerebras API
    const apiMessages: any[] = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];
    
    // Add user messages
    for (const message of messages) {
      if (message.role === 'user') {
        apiMessages.push({
          role: 'user',
          content: message.content
        });
      }
    }
    
    try {
      let turnCount = 0;
      const maxTurns = 10;
      let finalResponse = '';
      
      while (turnCount < maxTurns) {
        turnCount++;
        
        // Make API call
        const response = await this.client.chat.completions.create({
          messages: apiMessages,
          model: this.modelId,
          stream: false,
          max_tokens: 1024,
          temperature: 0.7,
          tools: this.tools as any
        });
        
        const choice = (response as any).choices[0];
        const message = choice.message;
        
        // If no tool calls, we're done
        if (!message.tool_calls || message.tool_calls.length === 0) {
          finalResponse = message.content ? parseMarkdownToText(message.content) : '';
          break;
        }
        
        // Save the assistant's message with tool calls
        apiMessages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls
        });
        
        // Execute all tool calls sequentially
        for (const toolCall of message.tool_calls) {
          try {
            const toolName = toolCall.function.name;
            const argsStr = toolCall.function.arguments || '{}';
            const parameters = JSON.parse(argsStr);
            
            // Execute the tool
            const result = await this.executeTool(toolName, parameters);
            
            // Add tool response to conversation for next turn
            apiMessages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCall.id
            });
            
          } catch (error) {
            // Add error response to conversation
            apiMessages.push({
              role: 'tool',
              content: JSON.stringify({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              }),
              tool_call_id: toolCall.id
            });
          }
        }
      }
      
      if (turnCount >= maxTurns) {
        finalResponse = `⚠️ Maximum tool call turns (${maxTurns}) reached. Stopping to prevent infinite loops.`;
      }
      
      return finalResponse;
      
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute intelligent commit splitting
   */
  private async executeIntelligentCommitSplit(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      const commitMessage = parameters.commit_message;
      const branch = parameters.branch || null;
      const files = parameters.files || null;
      const autoPush = parameters.auto_push || false;
      const dryRun = parameters.dry_run || false;

      // Add file validation
      if (files) {
        for (const file of files) {
          try {
            await this.execAsync(`git ls-files ${file}`);
          } catch {
            return {
              success: false,
              error: `File '${file}' not found in repository`,
              suggestion: 'Check the file path and ensure it exists'
            };
          }
        }
      }

      // Better branch handling
      if (branch) {
        try {
          // Check if branch already exists
          const { stdout: existingBranches } = await this.execAsync('git branch --list');
          if (existingBranches.includes(branch)) {
            await this.execAsync(`git checkout ${branch}`);
            console.log(`✅ Switched to existing branch: ${branch}`);
          } else {
            await this.execAsync(`git checkout -b ${branch}`);
            console.log(`✅ Created and switched to branch: ${branch}`);
          }
        } catch (branchError) {
          return {
            success: false,
            error: `Failed to handle branch '${branch}': ${branchError}`,
            suggestion: 'Check if you have the necessary permissions'
          };
        }
      }

      // Check if there are any changes
      const { stdout: statusOutput } = await this.execAsync('git status --porcelain');
      if (!statusOutput.trim()) {
        return {
          success: false,
          error: 'No changes to commit',
          suggestion: 'Make some changes to files before committing'
        };
      }

      // If user provided commit message, use direct commit
      if (commitMessage) {
        try {
          // Stage files if specified, otherwise stage all changes
          if (files) {
            for (const file of files) {
              await this.execAsync(`git add ${file}`);
            }
          } else {
            await this.execAsync('git add -A');
          }
          
          // Create commit with user's message
          await this.execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
          
          // Push if requested
          if (autoPush) {
            try {
              const { stdout } = await this.execAsync('git push');
            } catch (pushError) {
              if (pushError instanceof Error && pushError.message.includes('no upstream branch')) {
                const { stdout: currentBranch } = await this.execAsync('git branch --show-current');
                const branchName = currentBranch.trim();
                await this.execAsync(`git push --set-upstream origin ${branchName}`);
              } else {
                throw pushError;
              }
            }
          }
          
          return {
            success: true,
            action: 'custom_commit',
            commit_message: commitMessage,
            branch_created: branch,
            files_committed: files || 'all changes',
            pushed: autoPush,
            message: `Successfully committed with custom message: '${commitMessage}'${autoPush ? ' and pushed to remote' : ''}`
          };
        } catch (error) {
          return {
            success: false,
            error: `Git operation failed: ${error}`,
            suggestion: 'Check your git configuration and repository state'
          };
        }
      }

      // No commit message provided - use intelligent splitting
      const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
      if (!cerebrasApiKey) {
        return {
          success: false,
          error: 'CEREBRAS_API_KEY environment variable not set',
          suggestion: 'Please set the CEREBRAS_API_KEY environment variable to use intelligent commit splitting'
        };
      }
      
      const splitter = new IntelligentCommitSplitter(cerebrasApiKey);
      
      if (dryRun) {
        const commitGroups = await splitter.runIntelligentSplitting(false);
        return {
          success: true,
          dry_run: true,
          commit_groups_count: commitGroups.length,
          commit_groups: commitGroups.map(group => ({
            feature_name: group.feature_name,
            commit_title: group.commit_title,
            commit_message: group.commit_message,
            files: group.files.map(f => f.file_path)
          })),
          message: `Analysis complete! Found ${commitGroups.length} logical commit groups. No commits were created (dry run mode).`
        };
      } else {
        const commitGroups = await splitter.runIntelligentSplitting(autoPush);
        return {
          success: true,
          action: 'intelligent_split',
          auto_push: autoPush,
          commit_groups_count: commitGroups.length,
          commit_groups: commitGroups.map(group => ({
            feature_name: group.feature_name,
            commit_title: group.commit_title,
            commit_message: group.commit_message,
            files: group.files.map(f => f.file_path)
          })),
          message: `Successfully created ${commitGroups.length} logical commits${autoPush ? ' and pushed to remote' : ''}`
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check that you have uncommitted changes and that the repository is in a valid state'
      };
    }
  }

  /**
   * Execute commit and push with threshold checking
   */
  private async executeCommitAndPush(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      const commitMessage = parameters.commit_message;
      
      // Validate commit message
      if (!commitMessage || typeof commitMessage !== 'string') {
        return {
          success: false,
          error: 'Commit message is required and must be a string',
          suggestion: 'Please provide a valid commit message'
        };
      }
      
      const branch = parameters.branch || null;
      const files = parameters.files || null;
      const autoPush = parameters.auto_push !== false; // default to true
      const forceIntelligentSplit = parameters.force_intelligent_split || false;
      
      // If a branch is specified, create and switch to it
      if (branch) {
        try {
          // Get current branch to use as base
          const { stdout: currentBranch } = await this.execAsync('git branch --show-current');
          const baseBranch = currentBranch.trim();
          
          // Create and switch to the new branch
          await this.execAsync(`git checkout -b ${branch}`);
          
          console.log(`✅ Created and switched to branch: ${branch}`);
        } catch (branchError) {
          return {
            success: false,
            error: `Failed to create and switch to branch '${branch}': ${branchError}`,
            suggestion: 'Check if the branch name is valid and you have the necessary permissions'
          };
        }
      }
      
      // First check if there are any changes
      const { stdout: statusOutput } = await this.execAsync('git status --porcelain');
      
      if (!statusOutput.trim()) {
        return {
          success: false,
          error: 'No changes to commit',
          suggestion: 'Make some changes to files before committing'
        };
      }
      
      // Check threshold unless forced to use intelligent split
      if (!forceIntelligentSplit) {
        const thresholdCheck = await this.executeCheckChangesThreshold({ threshold: 1000 });
        
        if (!thresholdCheck.success) {
          return thresholdCheck;
        }
        
        // If exceeds threshold, trigger intelligent commit split
        if (thresholdCheck.exceeds_threshold) {
          console.log(`🚀 Large changes detected (${thresholdCheck.total_changes} lines > 1000). Triggering intelligent commit splitting...`);
          
          // Actually trigger the intelligent commit splitter
          const intelligentSplitResult = await this.executeIntelligentCommitSplit({
            auto_push: autoPush,
            dry_run: false
          });
          
          return {
            success: true,
            action: 'intelligent_split_executed',
            reason: `Changes exceed threshold (${thresholdCheck.total_changes} lines > 1000)`,
            threshold_analysis: thresholdCheck,
            intelligent_split_result: intelligentSplitResult,
            message: `Large changes detected (${thresholdCheck.total_changes} lines). Successfully executed intelligent commit splitting.`
          };
        }
      }
      
      // For smaller changes or forced intelligent split, proceed with regular commit
      try {
        // Stage files if specified, otherwise stage all changes
        if (files) {
          for (const file of files) {
            await this.execAsync(`git add ${file}`);
          }
        } else {
          // Stage all changes including new files and deletions
          await this.execAsync('git add -A');
        }
        
        // Create commit
        await this.execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
        
        // Push if requested
        let pushOutput = null;
        if (autoPush) {
          try {
            const { stdout } = await this.execAsync('git push');
            pushOutput = stdout;
          } catch (pushError) {
            // Check if it's an upstream branch issue
            if (pushError instanceof Error && pushError.message.includes('no upstream branch')) {
              // Get current branch name
              const { stdout: currentBranch } = await this.execAsync('git branch --show-current');
              const branchName = currentBranch.trim();
              
              // Set upstream and push
              const { stdout: upstreamOutput } = await this.execAsync(`git push --set-upstream origin ${branchName}`);
              pushOutput = upstreamOutput;
            } else {
              throw pushError; // Re-throw if it's a different error
            }
          }
        }
        
        return {
          success: true,
          action: 'regular_commit',
          commit_message: commitMessage,
          branch_created: branch || null,
          files_committed: files || 'all changes',
          pushed: autoPush,
          push_output: pushOutput,
          message: `Successfully committed changes with message: '${commitMessage}'${branch ? ` to branch '${branch}'` : ''}`
        };
        
      } catch (error) {
        return {
          success: false,
          error: `Git operation failed: ${error}`,
          suggestion: 'Check your git configuration and repository state'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check that you have uncommitted changes and that the repository is in a valid state'
      };
    }
  }

  /**
   * Check the current git status
   */
  private async executeCheckGitStatus(): Promise<ToolResult> {
    try {
      // Get current branch
      const { stdout: currentBranch } = await this.execAsync('git branch --show-current');
      
      // Get git status
      const { stdout: statusOutput } = await this.execAsync('git status --porcelain');
      
      // Get remote status
      const { stdout: remoteStatus } = await this.execAsync('git status --porcelain=v2 --branch');
      
      // Parse status
      const hasUncommittedChanges = statusOutput.trim().length > 0;
      const statusLines = statusOutput.split('\n').filter(line => line.trim());
      
      // Categorize changes
      const stagedFiles = statusLines.filter(line => line.startsWith('A ') || line.startsWith('M ') || line.startsWith('D '));
      const unstagedFiles = statusLines.filter(line => line.startsWith(' M') || line.startsWith(' D') || line.startsWith('??'));
      
      return {
        success: true,
        current_branch: currentBranch.trim(),
        has_uncommitted_changes: hasUncommittedChanges,
        staged_files_count: stagedFiles.length,
        unstaged_files_count: unstagedFiles.length,
        total_changes: statusLines.length,
        staged_files: stagedFiles.map(line => line.substring(3)),
        unstaged_files: unstagedFiles.map(line => line.substring(3)),
        status_summary: hasUncommittedChanges ? 
          `${stagedFiles.length} staged, ${unstagedFiles.length} unstaged changes` : 
          'No uncommitted changes'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check that you are in a git repository'
      };
    }
  }

  /**
   * Check if uncommitted changes exceed the threshold
   */
  private async executeCheckChangesThreshold(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      const threshold = parameters.threshold || 1000;
      
      // Get git diff statistics for modified/deleted files
      const { stdout: diffOutput } = await this.execAsync('git diff --stat');
      
      // Check staged changes
      const { stdout: stagedOutput } = await this.execAsync('git diff --cached --stat');
      
      // Get untracked (new) files
      const { stdout: untrackedOutput } = await this.execAsync('git ls-files --others --exclude-standard');
      
      // Parse the diff output to count lines
      let totalLinesAdded = 0;
      let totalLinesRemoved = 0;
      const changedFiles: any[] = [];
      
      // Parse regular diff (modified/deleted files)
      for (const line of diffOutput.split('\n')) {
        if (line.includes('|') && line.includes('changed')) {
          // Format: "file.py | 10 +++++-----"
          const parts = line.split('|');
          if (parts.length >= 2) {
            const fileName = parts[0].trim();
            const stats = parts[1].trim();
            // Extract numbers from stats like "10 +++++-----"
            const numbers = stats.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
              const linesAdded = parseInt(numbers[0]);
              const linesRemoved = parseInt(numbers[1]);
              totalLinesAdded += linesAdded;
              totalLinesRemoved += linesRemoved;
              changedFiles.push({
                file: fileName,
                lines_added: linesAdded,
                lines_removed: linesRemoved,
                type: 'modified'
              });
            }
          }
        }
      }
      
      // Parse staged diff
      for (const line of stagedOutput.split('\n')) {
        if (line.includes('|') && line.includes('changed')) {
          const parts = line.split('|');
          if (parts.length >= 2) {
            const fileName = parts[0].trim();
            const stats = parts[1].trim();
            const numbers = stats.match(/\d+/g);
            if (numbers && numbers.length >= 2) {
              const linesAdded = parseInt(numbers[0]);
              const linesRemoved = parseInt(numbers[1]);
              totalLinesAdded += linesAdded;
              totalLinesRemoved += linesRemoved;
              changedFiles.push({
                file: fileName,
                lines_added: linesAdded,
                lines_removed: linesRemoved,
                type: 'staged'
              });
            }
          }
        }
      }
      
      // Handle untracked (new) files
      const untrackedFiles = untrackedOutput.split('\n').filter(line => line.trim());
      for (const filePath of untrackedFiles) {
        try {
          // Count lines in the new file
          const { stdout: content } = await this.execAsync(`cat ${filePath}`);
          const linesAdded = content.split('\n').length;
          totalLinesAdded += linesAdded;
          changedFiles.push({
            file: filePath,
            lines_added: linesAdded,
            lines_removed: 0,
            type: 'new'
          });
        } catch (error) {
          // If we can't read the file, count it as 1 line addition
          totalLinesAdded += 1;
          changedFiles.push({
            file: filePath,
            lines_added: 1,
            lines_removed: 0,
            type: 'new'
          });
        }
      }
      
      const totalChanges = totalLinesAdded + totalLinesRemoved;
      const exceedsThreshold = totalChanges > threshold;
      
      return {
        success: true,
        total_lines_added: totalLinesAdded,
        total_lines_removed: totalLinesRemoved,
        total_changes: totalChanges,
        threshold: threshold,
        exceeds_threshold: exceedsThreshold,
        changed_files: changedFiles,
        file_count: changedFiles.length,
        new_files_count: changedFiles.filter(f => f.type === 'new').length,
        modified_files_count: changedFiles.filter(f => ['modified', 'staged'].includes(f.type)).length,
        recommendation: exceedsThreshold ? 'intelligent_commit_split' : 'regular_commit'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check that you have uncommitted changes and that the repository is in a valid state'
      };
    }
  }

  /**
   * Helper method to execute shell commands
   */
  private async execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
    const execAsync = promisify(exec);
    return await execAsync(command);
  }

  /**
   * Non-streaming version for simpler use cases
   */
  async callTools(messages: ChatMessage[], reasoningLevel: string = 'medium'): Promise<string> {
    let response = '';
    for await (const chunk of this.callToolsStream(messages, reasoningLevel)) {
      response += chunk;
    }
    return response;
  }
}
