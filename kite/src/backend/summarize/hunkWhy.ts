import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { config } from '../config';

/**
 * Interface for hunk summarization input
 */
export interface HunkSummaryInput {
  path: string;
  header: string;
  hunk: string;
  commitMessage?: string;
}

/**
 * Interface for hunk summarization result
 */
export interface HunkSummaryResult {
  summary: string;
  labels?: string[];
}

/**
 * Interface for batch summarization input
 */
export interface BatchHunkSummaryInput {
  hunks: HunkSummaryInput[];
}

/**
 * Interface for batch summarization result
 */
export interface BatchHunkSummaryResult {
  summaries: HunkSummaryResult[];
  errors?: Array<{ index: number; error: string }>;
}

/**
 * Hunk summarization client using Cerebras LLM
 */
export class HunkSummarizer {
  private client: Cerebras;

  constructor(apiKey?: string) {
    const key = apiKey || config.CEREBRAS_API_KEY;
    if (!key) {
      throw new Error('Cerebras API key is required for hunk summarization');
    }
    this.client = new Cerebras({ apiKey: key });
  }

  /**
   * Generate a why-summary for a single hunk
   */
  async summarizeHunk(input: HunkSummaryInput): Promise<HunkSummaryResult> {
    const { path, header, hunk, commitMessage } = input;

    // Clean and prepare the hunk text
    const cleanHunk = this.cleanHunkText(hunk);
    
    // Create the prompt
    const prompt = this.createSummaryPrompt({
      path,
      header,
      hunk: cleanHunk,
      commitMessage
    });

    try {
      const response = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: 'gpt-oss-120b',
        max_tokens: 150,
        temperature: 0.3 // Lower temperature for more consistent summaries
      });

      const content = (response.choices as any[])[0].message.content?.trim() || '';
      
      // Parse the response
      const result = this.parseSummaryResponse(content);
      
      return result;
    } catch (error) {
      console.error('Error generating hunk summary:', error);
      // Fallback to basic summary
      return {
        summary: this.generateFallbackSummary(input),
        labels: this.extractBasicLabels(input)
      };
    }
  }

  /**
   * Generate summaries for multiple hunks in parallel
   */
  async summarizeHunksBatch(input: BatchHunkSummaryInput): Promise<BatchHunkSummaryResult> {
    const { hunks } = input;
    const results: HunkSummaryResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Process hunks in parallel with concurrency limit
    const concurrencyLimit = 5; // Limit concurrent requests
    const chunks = this.chunkArray(hunks, concurrencyLimit);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPromises = chunk.map(async (hunk, chunkIndex) => {
        const globalIndex = i * concurrencyLimit + chunkIndex;
        try {
          return await this.summarizeHunk(hunk);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ index: globalIndex, error: errorMessage });
          // Return fallback summary
          return {
            summary: this.generateFallbackSummary(hunk),
            labels: this.extractBasicLabels(hunk)
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return {
      summaries: results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Create the system prompt for hunk summarization
   */
  private getSystemPrompt(): string {
    return `You are a code change analyzer. Your job is to generate concise, developer-friendly summaries of code changes.

Guidelines:
- Write 1-3 sentences maximum
- Use imperative, developer-speak ("fix bug in...", "rename for clarity", "migrate API v1→v2")
- Focus on intent and impact, not just what changed
- Avoid re-printing code unless crucial for understanding
- Include impact if obvious (e.g., "fixes memory leak", "improves performance")
- Use present tense, active voice
- Be specific about what was changed and why

Format your response as:
SUMMARY: [your summary here]
LABELS: [comma-separated labels like: fix,refactor,performance,security]`;
  }

  /**
   * Create the user prompt for a specific hunk
   */
  private createSummaryPrompt(input: HunkSummaryInput): string {
    const { path, header, hunk, commitMessage } = input;
    
    let prompt = `File: ${path}
Hunk: ${header}

Code changes:
${hunk}`;

    if (commitMessage) {
      prompt += `\n\nCommit message: ${commitMessage}`;
    }

    prompt += `\n\nGenerate a summary of what this change does and why.`;
    
    return prompt;
  }

  /**
   * Parse the LLM response to extract summary and labels
   */
  private parseSummaryResponse(content: string): HunkSummaryResult {
    let summary = '';
    let labels: string[] = [];

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('SUMMARY:')) {
        summary = trimmedLine.replace('SUMMARY:', '').trim();
      } else if (trimmedLine.startsWith('LABELS:')) {
        const labelsStr = trimmedLine.replace('LABELS:', '').trim();
        labels = labelsStr.split(',').map(label => label.trim()).filter(Boolean);
      }
    }

    // If parsing failed, use the entire content as summary
    if (!summary) {
      summary = content.trim();
    }

    return {
      summary,
      labels: labels.length > 0 ? labels : undefined
    };
  }

  /**
   * Clean hunk text by removing unnecessary whitespace and formatting
   */
  private cleanHunkText(hunk: string): string {
    return hunk
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  /**
   * Generate a fallback summary when LLM fails
   */
  private generateFallbackSummary(input: HunkSummaryInput): string {
    const { path, header } = input;
    
    // Extract basic info from header
    const headerMatch = header.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
    if (headerMatch) {
      const [, oldStart, oldLines, newStart, newLines] = headerMatch;
      const added = newLines ? parseInt(newLines) : 1;
      const removed = oldLines ? parseInt(oldLines) : 1;
      
      if (added > 0 && removed === 0) {
        return `Add ${added} line(s) to ${path}`;
      } else if (removed > 0 && added === 0) {
        return `Remove ${removed} line(s) from ${path}`;
      } else {
        return `Modify ${path} (${added} added, ${removed} removed)`;
      }
    }
    
    return `Update ${path}`;
  }

  /**
   * Extract basic labels from hunk content
   */
  private extractBasicLabels(input: HunkSummaryInput): string[] {
    const { hunk } = input;
    const labels: string[] = [];
    
    const lowerHunk = hunk.toLowerCase();
    
    // Basic pattern matching for common change types
    if (lowerHunk.includes('fix') || lowerHunk.includes('bug') || lowerHunk.includes('error')) {
      labels.push('fix');
    }
    if (lowerHunk.includes('refactor') || lowerHunk.includes('rename') || lowerHunk.includes('clean')) {
      labels.push('refactor');
    }
    if (lowerHunk.includes('add') || lowerHunk.includes('new') || lowerHunk.includes('create')) {
      labels.push('feature');
    }
    if (lowerHunk.includes('remove') || lowerHunk.includes('delete') || lowerHunk.includes('drop')) {
      labels.push('cleanup');
    }
    if (lowerHunk.includes('test') || lowerHunk.includes('spec')) {
      labels.push('test');
    }
    
    return labels;
  }

  /**
   * Split array into chunks for batch processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Convenience function to create a summarizer instance
 */
export function createHunkSummarizer(apiKey?: string): HunkSummarizer {
  return new HunkSummarizer(apiKey);
}

/**
 * Convenience function for single hunk summarization
 */
export async function summarizeHunk(input: HunkSummaryInput, apiKey?: string): Promise<HunkSummaryResult> {
  const summarizer = createHunkSummarizer(apiKey);
  return await summarizer.summarizeHunk(input);
}

/**
 * Convenience function for batch hunk summarization
 */
export async function summarizeHunksBatch(input: BatchHunkSummaryInput, apiKey?: string): Promise<BatchHunkSummaryResult> {
  const summarizer = createHunkSummarizer(apiKey);
  return await summarizer.summarizeHunksBatch(input);
}
