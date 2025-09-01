import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { FileChange } from './types';

/**
 * Client for interacting with Cerebras LLM for commit message generation
 */
export class CerebrasLLM {
  private client: Cerebras;

  constructor(apiKey: string) {
    this.client = new Cerebras({ apiKey });
  }

  /**
   * Intelligently summarize diff content to reduce token usage
   */
  private summarizeDiffContent(diffContent: string, filePath: string): string {
    const lines = diffContent.split('\n');
    const important: string[] = [];
    const maxLines = 20; // Limit to 20 most important lines
    
    // Extract file extension for context
    const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
    
    // Track statistics
    let addedLines = 0;
    let removedLines = 0;
    let addedFunctions: string[] = [];
    let removedFunctions: string[] = [];
    let modifiedFunctions: string[] = [];
    
    for (const line of lines) {
      // Count additions/deletions
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines++;
        // Extract function/method names
        if (this.isFunctionLine(line, fileExt)) {
          addedFunctions.push(this.extractFunctionName(line));
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines++;
        if (this.isFunctionLine(line, fileExt)) {
          removedFunctions.push(this.extractFunctionName(line));
        }
      }
      
      // Keep important lines only
      if (this.isImportantLine(line, fileExt)) {
        important.push(line);
        if (important.length >= maxLines) break;
      }
    }
    
    // Build summarized context
    let summary = `Summary: +${addedLines} -${removedLines} lines\n`;
    
    if (addedFunctions.length > 0) {
      summary += `Added functions: ${addedFunctions.slice(0, 3).join(', ')}${addedFunctions.length > 3 ? '...' : ''}\n`;
    }
    if (removedFunctions.length > 0) {
      summary += `Removed functions: ${removedFunctions.slice(0, 3).join(', ')}${removedFunctions.length > 3 ? '...' : ''}\n`;
    }
    
    // Add key changes
    if (important.length > 0) {
      summary += `Key changes:\n${important.slice(0, 15).join('\n')}`;
      if (important.length > 15) {
        summary += '\n... (truncated)';
      }
    }
    
    return summary;
  }
  
  /**
   * Check if a line contains function/method definition
   */
  private isFunctionLine(line: string, fileExt: string): boolean {
    const cleanLine = line.replace(/^[+-]\s*/, '').trim();
    
    switch (fileExt) {
      case 'ts':
      case 'js':
      case 'tsx':
      case 'jsx':
        return /^(export\s+)?(async\s+)?function\s+\w+|^\s*\w+\s*[:=]\s*(async\s+)?\(|^class\s+\w+|^\s*\w+\s*\([^)]*\)\s*[{:]/.test(cleanLine);
      case 'py':
        return /^def\s+\w+|^class\s+\w+/.test(cleanLine);
      case 'java':
      case 'cpp':
      case 'c':
        return /^(public|private|protected)?\s*(static\s+)?[\w<>]+\s+\w+\s*\(/.test(cleanLine);
      default:
        return /function|def\s+|class\s+|\w+\s*\(/.test(cleanLine);
    }
  }
  
  /**
   * Extract function name from a line
   */
  private extractFunctionName(line: string): string {
    const cleanLine = line.replace(/^[+-]\s*/, '').trim();
    
    // JavaScript/TypeScript patterns
    const jsMatch = cleanLine.match(/(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?\(|class\s+(\w+)|(\w+)\s*\([^)]*\)\s*[{:])/);
    if (jsMatch) {
      return jsMatch[1] || jsMatch[2] || jsMatch[3] || jsMatch[4] || 'unknown';
    }
    
    // Python patterns
    const pyMatch = cleanLine.match(/(?:def\s+(\w+)|class\s+(\w+))/);
    if (pyMatch) {
      return pyMatch[1] || pyMatch[2] || 'unknown';
    }
    
    return 'function';
  }
  
  /**
   * Check if a line is important enough to include in summary
   */
  private isImportantLine(line: string, fileExt: string): boolean {
    // Skip pure whitespace or minor changes
    if (!line.trim() || line.trim() === '+' || line.trim() === '-') {
      return false;
    }
    
    // Always include function/class definitions
    if (this.isFunctionLine(line, fileExt)) {
      return true;
    }
    
    // Include imports/requires
    if (/^[+-]\s*(import|require|from|#include)/.test(line)) {
      return true;
    }
    
    // Include significant logic changes (not just formatting)
    if (/^[+-].*[{};=]/.test(line) && !/^\s*[+-]\s*[})\];,]\s*$/.test(line)) {
      return true;
    }
    
    // Include comments that explain changes
    if (/^[+-].*\/\/|^[+-].*\/\*|^[+-].*#/.test(line)) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate text using Cerebras LLM
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'gpt-oss-120b',
        max_tokens: 500,
        temperature: 0.7
      });
      
      return (response.choices as any[])[0].message.content?.trim() || '';
      
    } catch (error) {
      console.error('Error generating text:', error);
      throw error;
    }
  }

  /**
   * Generate commit title and message using LLM with semantic context
   */
  async generateCommitMessage(
    fileChanges: FileChange[], 
    featureName: string, 
    semanticSummary: string = ""
  ): Promise<{ title: string; message: string }> {
    
    // Prepare context for the LLM with smart truncation
    let context = `
Files changed:
`;
    
    for (const change of fileChanges) {
      context += `- ${change.file_path} (${change.change_type})\n`;
      if (change.diff_content) {
        // Intelligently summarize diff content instead of including everything
        const summarizedDiff = this.summarizeDiffContent(change.diff_content, change.file_path);
        context += `  Changes:\n${summarizedDiff}\n`;
      }
    }
    
    // Add semantic analysis if available
    if (semanticSummary) {
      context += `
Semantic Analysis:
${semanticSummary}
`;
    }
    
    context += `
Group: ${featureName}

IMPORTANT: Analyze the actual diff content above to understand what changed. Focus on the specific modifications, not just the file path.

Generate a concise commit message in the following format:

TITLE: <type>: <short summary in imperative mood, max 50 chars>
MESSAGE: <CONCISE explanation of WHAT changed, WHY it matters, and the USER IMPACT. Avoid restating code-level details unless they affect users.>

Conventional commit types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
Guidelines:
- Use a meaningful, descriptive title (not generic like "update" or "misc").
- Keep the title concise and scoped, message clear and actionable.
- The message should be a concise explanation of the changes.

Example:
TITLE: feat: add GitHub OAuth login  
MESSAGE: Introduced GitHub OAuth login so users can sign in without creating a new account, reducing onboarding friction.
`;
    
    try {
      console.log(`📏 Context size: ${context.length} characters (after intelligent summarization)`);
      console.log(`📋 Feature: ${featureName}`);
      console.log(`📁 Files: ${fileChanges.length}`);
      
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a git commit message generator. Analyze the diff content carefully to understand what actually changed. Focus on the specific modifications, not just the file path. Always respond with exactly two lines: TITLE: followed by MESSAGE:. Never include markdown, explanations, or extra formatting.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        model: 'gpt-oss-120b',
        max_tokens: 500,
        temperature: 0.3
      });
      
      // Simple parsing - just split on TITLE: and MESSAGE:
      const content = (response.choices as any[])[0].message.content?.trim();
      console.log(`📝 Raw LLM response:`, JSON.stringify(content));
      
      if (!content) {
        throw new Error('No response from LLM - content is empty');
      }
      
      // Extract title and message
      let title = '';
      let message = '';
      
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('TITLE:')) {
          title = trimmedLine.replace('TITLE:', '').trim();
        } else if (trimmedLine.startsWith('MESSAGE:')) {
          message = trimmedLine.replace('MESSAGE:', '').trim();
        }
      }
      
      // Fallback if parsing fails
      if (!title) {
        title = `feat: ${featureName}`;
      }
      if (!message) {
        message = `Changes related to ${featureName}`;
      }
      
      return { title, message };
      
    } catch (error) {
      console.error('Error generating commit message:', error);
      // Fallback to basic format
      return {
        title: `feat: ${featureName}`,
        message: `Changes related to ${featureName}`
      };
    }
  }
}
