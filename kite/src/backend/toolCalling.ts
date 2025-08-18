import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GitHubClient } from './githubClient';
import { IntelligentCommitSplitter } from './intelligentCommitSplitter';
import {
  ChatMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  CerebrasChatMessage,
} from './types';
import { CEREBRAS_API_KEY, validateConfig } from './config';
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
          description: 'Create a pull request for a given repository.',
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
          description: 'Merge a pull request.',
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
          description: 'Intelligently split uncommitted changes into logical commits using AI analysis. This tool analyzes file changes semantically and groups them into meaningful commits with proper conventional commit messages.',
          parameters: {
            type: 'object',
            properties: {
              auto_push: {
                type: 'boolean',
                description: 'Whether to automatically push the commits after splitting (default: false)'
              },
              dry_run: {
                type: 'boolean',
                description: 'Whether to only analyze and show what would be done without actually creating commits (default: false)'
              }
            },
            required: []
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'commit_and_push',
          description: 'Commit and push changes to GitHub. This is the PRIMARY tool for committing and pushing code. Use this when user provides a commit message or wants to push changes. ALWAYS check conversation history for commit message if user provided one. Includes automatic threshold checking and intelligent commit splitting for large changes.',
          parameters: {
            type: 'object',
            properties: {
              commit_message: {
                type: 'string',
                description: 'The commit message to use (required for regular commits)'
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of specific files to commit (optional, commits all changes if not specified)'
              },
              auto_push: {
                type: 'boolean',
                description: 'Whether to automatically push to remote after commit (default: true)'
              },
              force_intelligent_split: {
                type: 'boolean',
                description: 'Force intelligent commit splitting even for small changes (default: false)'
              }
            },
            required: ['commit_message']
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
      }
    ];
  }

  /**
   * System prompt for the AI assistants
   */
  private getSystemPrompt(reasoningLevel: string = 'medium'): string {
    return `Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- Provide helpful explanations when tools are executed
- When user provides a commit message, use commit_and_push tool (not checkout_branch)
- When user wants to push changes, use commit_and_push tool
- Only use checkout_branch when user specifically wants to switch branches without committing
- ALWAYS check conversation history for commit messages, repository names, and other parameters
- If user provided information in previous messages, use that information in tool calls
- Never ask for information that was already provided in the conversation
    
    COMMUNICATION STYLE:
    - Be very concise
    - Always prioritize safety - confirm before doing destructive operations
    - Provide context for WHY not just HOW for recommendations
    - Acknowledge risks and provide mitigation strategies
    - Dont use emojis or repeat the question
    - Don't use em dashes (—)
    - DONT RESPOND WITH TABLES

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
     8. When using commit_and_push tool, large changes (>1000 lines) automatically trigger intelligent commit splitting

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
    - When user says "push code" or "commit and push" → Use commit_and_push tool
    - When user provides a commit message → Use commit_and_push tool
    - When user wants to switch branches only → Use checkout_branch tool
    - commit_and_push tool handles branch switching automatically if needed
    - ALWAYS extract commit message from conversation history if user provided one
    - If user provided commit message in previous messages, use that message in commit_and_push tool

    Reasoning: ${reasoningLevel}`;
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolName: string, parameters: Record<string, any>): Promise<ToolResult> {
    switch (toolName) {
      case 'list_repos':
        return await this.githubClient.listRepos();
      
      case 'checkout_branch':
        return await this.githubClient.checkoutBranch(parameters['repo'], parameters['branch']);
      
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
        return await this.githubClient.createBranch({
          repo: parameters['repo'],
          branch: parameters['branch'],
          fromBranch: parameters['from_branch']
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
      
      case 'commit_and_push':
        return await this.executeCommitAndPush(parameters);
      
      case 'check_changes_threshold':
        return await this.executeCheckChangesThreshold(parameters);
      
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
   * Stream tool calls with real-time response generation
   */
  async *callToolsStream(
    messages: ChatMessage[], 
    reasoningLevel: string = 'medium'
  ): AsyncGenerator<string> {
    const systemPrompt = this.getSystemPrompt(reasoningLevel);
    const formattedPrompt = systemPrompt + this.formatMessagesWithTools(messages);
    
    // Prepare messages for Cerebras API
    const apiMessages = [
      {
        role: 'system' as const,
        content: formattedPrompt
      }
    ];
    
    // Add user messages
    for (const message of messages) {
      if (message.role === 'user') {
        apiMessages.push({
          role: 'user' as any,
          content: message.content
        });
      }
    }
    
    try {
      // Streaming response
      const stream = await this.client.chat.completions.create({
        messages: apiMessages,
        model: this.modelId,
        stream: true,
        max_tokens: 512,
        temperature: 0.7,
        tools: this.tools as any
      });
      
      let fullResponse = '';
      const toolCallsBuffer: Map<number, { name?: string; arguments: string }> = new Map();
      
      for await (const chunk of stream as any) {
        const delta = (chunk.choices?.[0] as any)?.delta;
        
        // Stream any assistant text
        if (delta?.content) {
          fullResponse += delta.content;
          yield delta.content;
        }
        
        // Capture streamed tool calls
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls as any[]) {
            const idx = tc.index || 0;
            const entry = toolCallsBuffer.get(idx) || { name: undefined, arguments: '' };
            
            if (tc.function?.name) {
              entry.name = tc.function.name;
            }
            
            if (tc.function?.arguments) {
              entry.arguments += tc.function.arguments;
            }
            
            toolCallsBuffer.set(idx, entry);
          }
        }
      }
      
      // After streaming is complete, check for tool calls
      if (toolCallsBuffer.size > 0) {
        // Prefer native tool calls captured from the stream
        for (const [idx, entry] of toolCallsBuffer) {
          const toolName = entry.name;
          const argsStr = entry.arguments || '{}';
          
          try {
            const parameters = JSON.parse(argsStr);
            if (toolName) {
              const result = await this.executeTool(toolName, parameters);
              yield `\n\nTool executed: ${toolName}\nResult: ${JSON.stringify(result, null, 2)}`;
            }
          } catch (error) {
            yield `\n\nError parsing tool call arguments: ${error}`;
          }
        }
      } else {
        // Fallback: parse a JSON code block from text content
        const toolCall = this.extractToolCall(fullResponse);
        if (toolCall) {
          const result = await this.executeTool(toolCall.tool, toolCall.parameters);
          yield `\n\nTool executed: ${toolCall.tool}\nResult: ${JSON.stringify(result, null, 2)}`;
        }
      }
      
    } catch (error) {
      yield `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute intelligent commit splitting
   */
  private async executeIntelligentCommitSplit(parameters: Record<string, any>): Promise<ToolResult> {
    try {
      const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
      const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
      
      if (!supermemoryApiKey) {
        return {
          success: false,
          error: 'SUPERMEMORY_API_KEY environment variable not set',
          suggestion: 'Please set the SUPERMEMORY_API_KEY environment variable to use intelligent commit splitting'
        };
      }
      
      if (!cerebrasApiKey) {
        return {
          success: false,
          error: 'CEREBRAS_API_KEY environment variable not set',
          suggestion: 'Please set the CEREBRAS_API_KEY environment variable to use intelligent commit splitting'
        };
      }
      
      // Initialize the intelligent commit splitter
      const splitter = new IntelligentCommitSplitter(supermemoryApiKey, cerebrasApiKey);
      
      const autoPush = parameters.auto_push || false;
      const dryRun = parameters.dry_run || false;
      
      // Run the analysis
      if (dryRun) {
        // For dry run, we'll just analyze without executing
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
        // Execute the actual commit splitting
        const commitGroups = await splitter.runIntelligentSplitting(autoPush);
        return {
          success: true,
          dry_run: false,
          auto_push: autoPush,
          commit_groups_count: commitGroups.length,
          commit_groups: commitGroups.map(group => ({
            feature_name: group.feature_name,
            commit_title: group.commit_title,
            commit_message: group.commit_message,
            files: group.files.map(f => f.file_path)
          })),
          message: `Successfully created ${commitGroups.length} logical commits${autoPush ? ' and pushed to remote' : ''}.`
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
      
      const files = parameters.files || null;
      const autoPush = parameters.auto_push !== false; // default to true
      const forceIntelligentSplit = parameters.force_intelligent_split || false;
      
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
          const { stdout } = await this.execAsync('git push');
          pushOutput = stdout;
        }
        
        return {
          success: true,
          action: 'regular_commit',
          commit_message: commitMessage,
          files_committed: files || 'all changes',
          pushed: autoPush,
          push_output: pushOutput,
          message: `Successfully committed changes with message: '${commitMessage}'`
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
