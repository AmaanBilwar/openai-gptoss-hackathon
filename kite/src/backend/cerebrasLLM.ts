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
    
    // Prepare context for the LLM
    let context = `
Files changed:
`;
    
    for (const change of fileChanges) {
      context += `- ${change.file_path} (${change.change_type})\n`;
      if (change.diff_content) {
        // Include full diff content for better context
        context += `  Changes:\n${change.diff_content}\n`;
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

Generate a commit message in the following format:

TITLE: <type>: <short summary in imperative mood, max 50 chars>
MESSAGE: <explanation of WHAT changed, WHY it matters, and the USER IMPACT. Avoid restating code-level details unless they affect users.>

Conventional commit types: feat, fix, docs, style, refactor, test, chore, perf, ci, build.
Guidelines:
- Use a meaningful, descriptive title (not generic like "update" or "misc").
- Highlight the business or user value in the message.
- Keep the title concise and scoped, message clear and actionable.
- Write in present tense, imperative mood.
- Avoid unnecessary technical jargon unless essential.

Example:
TITLE: feat: add GitHub OAuth login  
MESSAGE: Introduced GitHub OAuth login so users can sign in without creating a new account, reducing onboarding friction.
`;
    
    try {
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
        max_tokens: 200,
        temperature: 0.7
      });
      
      // Simple parsing - just split on TITLE: and MESSAGE:
      const content = (response.choices as any[])[0].message.content?.trim() || '';
      
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
