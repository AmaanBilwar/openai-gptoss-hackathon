import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GitHubClient } from './githubClient';
import {
  ChatMessage,
  ToolDefinition,
  ToolCall,
  ToolResult,
  CerebrasChatMessage,
} from './types';
import { CEREBRAS_API_KEY, validateConfig } from './config';

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
          description: 'Checkout a branch for a given repository.',
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
      }
    ];
  }

  /**
   * System prompt for the AI assistant
   */
  private getSystemPrompt(reasoningLevel: string = 'medium'): string {
    return `Your name is Kite and you're an expert GitHub repository management assistant powered by GPT-OSS. You have access to tools for managing repositories, branches, issues, and pull requests.

Instructions:
- Always use the most appropriate tool for the user's request
- Be precise with repository names and parameters
- Provide helpful explanations when tools are executed
    
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

    RESPONSE FORMAT:
    - Provide structured JSON for complex analysis
    - Include confidence ratings for suggestions
    - Explain reasoning behind recommendations
    - Offer multiple approaches when appropriate
    - Show exact commands with risk assessments

    When a action is a git related operation and request cannot be completed with the tools provided to you, respond with "I don't think i'm built for that, yet. I've taken a note of a potential feature request for this. Devs will implement this asap :) "

    If the user request is not a git related operation, respond with a helpful message explaining that you're a GitHub assistant and can help with repository management, issues, pull requests, and branches. Ask them what GitHub-related task they'd like help with.

    Always use available tools for Git operations and maintain audit logs for continuous learning and improvement.

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
