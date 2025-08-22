import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { CEREBRAS_API_KEY } from './config';
import { applyUpdateSnippetToContent, applyUpdateSnippetToFile } from './morphLLM';
import * as fs from 'fs';
import * as path from 'path';

export interface ConflictBlock {
    startIndex: number;
    endIndex: number;
    raw: string;
    leftLabel?: string;
    rightLabel?: string;
    baseLabel?: string;
    leftText: string;
    rightText: string;
    baseText?: string;
    surroundingContext: string;
}

export function hasConflictMarkers(content: string): boolean {
    return content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>');
}

function indexOfNewlineAfter(text: string, fromIndex: number): number {
    const nlIndex = text.indexOf('\n', fromIndex);
    return nlIndex === -1 ? text.length : nlIndex + 1;
}

export function getSurroundingContent(content: string, startIndex: number, endIndex: number, radius: number = 100): string {
    const start = startIndex < radius ? 0 : startIndex - radius;
    const end = endIndex + radius > content.length ? content.length : endIndex + radius;
    return content.substring(start, end);
}

export function findAllConflictBlocks(content: string, contextRadius: number = 100): ConflictBlock[] {
    const conflicts: ConflictBlock[] = [];
    let searchFrom = 0;
    while (true) {
        const start = content.indexOf('<<<<<<<', searchFrom);
        if (start === -1) break;

        const endMarker = content.indexOf('>>>>>>>', start + 7);
        if (endMarker === -1) break;
        const endLineInclusive = indexOfNewlineAfter(content, endMarker);
        const raw = content.substring(start, endLineInclusive);

        const parsed = parseConflictBlock(raw);
        conflicts.push({
            startIndex: start,
            endIndex: endLineInclusive,
            raw,
            leftLabel: parsed.leftLabel,
            rightLabel: parsed.rightLabel,
            baseLabel: parsed.baseLabel,
            leftText: parsed.leftText,
            rightText: parsed.rightText,
            baseText: parsed.baseText,
            surroundingContext: getSurroundingContent(content, start, endLineInclusive, contextRadius)
        });

        searchFrom = endLineInclusive;
    }
    return conflicts;
}

function parseConflictBlock(raw: string): {
    leftLabel?: string;
    rightLabel?: string;
    baseLabel?: string;
    leftText: string;
    rightText: string;
    baseText?: string;
} {
    const leftHeaderIdx = raw.indexOf('<<<<<<<');
    if (leftHeaderIdx !== 0) {
        throw new Error('parseConflictBlock expects raw to start with <<<<<<<');
    }
    const leftHeaderEnd = indexOfNewlineAfter(raw, leftHeaderIdx);
    const rightMarkerIdx = raw.indexOf('>>>>>>>', leftHeaderEnd);
    if (rightMarkerIdx === -1) {
        throw new Error('Malformed conflict block: missing >>>>>>>');
    }
    const rightHeaderEnd = indexOfNewlineAfter(raw, rightMarkerIdx);

    const baseMarkerIdx = raw.indexOf('|||||||', leftHeaderEnd);
    const splitMarkerIdx = raw.indexOf('=======', leftHeaderEnd);
    if (splitMarkerIdx === -1) {
        throw new Error('Malformed conflict block: missing =======');
    }
    const splitHeaderEnd = indexOfNewlineAfter(raw, splitMarkerIdx);

    let leftText = '';
    let baseText: string | undefined;
    let rightText = '';

    if (baseMarkerIdx !== -1 && baseMarkerIdx < splitMarkerIdx) {
        const baseHeaderEnd = indexOfNewlineAfter(raw, baseMarkerIdx);
        leftText = raw.substring(leftHeaderEnd, baseMarkerIdx);
        baseText = raw.substring(baseHeaderEnd, splitMarkerIdx);
        rightText = raw.substring(splitHeaderEnd, rightMarkerIdx);
    } else {
        leftText = raw.substring(leftHeaderEnd, splitMarkerIdx);
        rightText = raw.substring(splitHeaderEnd, rightMarkerIdx);
    }

    const leftHeaderLine = raw.substring(0, leftHeaderEnd).trimEnd();
    const rightHeaderLine = raw.substring(rightMarkerIdx, rightHeaderEnd).trimEnd();
    const baseHeaderLine = baseMarkerIdx !== -1 && baseMarkerIdx < splitMarkerIdx
        ? raw.substring(baseMarkerIdx, indexOfNewlineAfter(raw, baseMarkerIdx)).trimEnd()
        : undefined;

    const leftLabel = leftHeaderLine.replace(/^<<<<<<<\s?/, '').trim();
    const rightLabel = rightHeaderLine.replace(/^>>>>>>>\s?/, '').trim();
    const baseLabel = baseHeaderLine ? baseHeaderLine.replace(/^\|\|\|\|\|\|\|\s?/, '').trim() : undefined;

    return {
        leftLabel: leftLabel || undefined,
        rightLabel: rightLabel || undefined,
        baseLabel,
        leftText: trimTrailingNewline(leftText),
        rightText: trimTrailingNewline(rightText),
        baseText: baseText !== undefined ? trimTrailingNewline(baseText) : undefined
    };
}

function trimTrailingNewline(text: string): string {
    if (text.endsWith('\r\n')) return text.slice(0, -2);
    if (text.endsWith('\n')) return text.slice(0, -1);
    return text;
}

async function suggestUpdateSnippetForContent(content: string, filePathHint?: string): Promise<{ instruction: string; updateSnippet: string }> {
    const client = new Cerebras({ apiKey: CEREBRAS_API_KEY });
    const instruction = `Resolve all Git merge conflicts${filePathHint ? ` in ${filePathHint}` : ''} by removing conflict markers and producing the best unified code. Preserve surrounding structure and formatting.`;
    const system = 'You generate minimal <update> snippets for Morph Apply API. Return ONLY the update code between <update> tags. Use // ... existing code ... to omit unchanged sections. Do not repeat <code> or <instruction>.';
    const user = `<instruction>${instruction}</instruction>\n<code>${content}</code>\n<update>// Provide only the changed code with // ... existing code ... markers</update>`;

    const response = await client.chat.completions.create({
        model: 'gpt-oss-120b',
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ],
        max_tokens: 800,
        temperature: 0.2
    });
    const raw = (response.choices as any[])?.[0]?.message?.content?.trim() || '';
    const m = raw.match(/<update>[\s\S]*?<\/update>/i);
    const updateSnippet = m ? m[0].replace(/<\/?update>/gi, '').trim() : raw;
    return { instruction, updateSnippet };
}

export async function suggestConflictResolutions(content: string, filePath?: string): Promise<void> {
    const conflicts = findAllConflictBlocks(content, 200);
    if (conflicts.length === 0) {
        console.log(`[merge-conflicts] No conflict markers found${filePath ? ` in ${filePath}` : ''}.`);
        return;
    }

    const client = new Cerebras({ apiKey: CEREBRAS_API_KEY });

    for (let i = 0; i < conflicts.length; i++) {
        const c = conflicts[i];
        const prompt = buildSuggestionPrompt(c, filePath, i + 1, conflicts.length);
        try {
            const response = await client.chat.completions.create({
                model: 'gpt-oss-120b',
                messages: [
                    { role: 'system', content: 'You resolve Git merge conflicts. Return only the resolved code for the conflicted region and a one-paragraph rationale. Do not include conflict markers.' },
                    { role: 'user', content: prompt }
                ],
                max_tokens: 800,
                temperature: 0.2
            });

            const suggestion = (response.choices as any[])[0]?.message?.content?.trim() || '';
            console.log(`\n[merge-conflicts] Suggestions for ${filePath || 'in-memory content'} — conflict ${i + 1}/${conflicts.length}:\n`);
            console.log(suggestion);
        } catch (err) {
            console.error(`[merge-conflicts] Failed to get suggestion for conflict ${i + 1}:`, err);
        }
    }

    // Try applying changes using Morph Apply API on the full file (preview only; does not write)
    try {
        const { instruction, updateSnippet } = await suggestUpdateSnippetForContent(content, filePath);
        const appliedCode = await applyUpdateSnippetToContent(content, updateSnippet, instruction);
        console.log('\n[merge-conflicts] Applied file (Morph preview):');
        console.log(appliedCode);
    } catch (err) {
        console.error('[merge-conflicts] Morph apply preview failed:', err);
    }
}

function buildSuggestionPrompt(conflict: ConflictBlock, filePath: string | undefined, index: number, total: number): string {
    const parts: string[] = [];
    if (filePath) parts.push(`File: ${filePath}`);
    parts.push(`Conflict ${index} of ${total}`);
    if (conflict.leftLabel) parts.push(`Ours label: ${conflict.leftLabel}`);
    if (conflict.rightLabel) parts.push(`Theirs label: ${conflict.rightLabel}`);
    if (conflict.baseLabel) parts.push(`Base label: ${conflict.baseLabel}`);
    parts.push('--- Surrounding context (truncated) ---');
    parts.push(conflict.surroundingContext);
    parts.push('--- Ours (left) ---');
    parts.push(conflict.leftText);
    if (conflict.baseText !== undefined) {
        parts.push('--- Base (if provided) ---');
        parts.push(conflict.baseText);
    }
    parts.push('--- Theirs (right) ---');
    parts.push(conflict.rightText);
    parts.push('\nReturn ONLY:\n1) A code block that represents the resolved code for this conflicted region (without conflict markers), and\n2) A short rationale after the code block.');
    return parts.join('\n');
}

/**
 * Apply Morph-based conflict resolution to in-memory content.
 * Returns the resolved content. Optionally provide a filePathHint for better LLM context.
 */
// Convenience: suggest resolutions and then apply them to a file on disk
export async function suggestAndApplyConflictResolutionsToFile(inputPath: string): Promise<string> {
  const absIn = path.resolve(inputPath);
  const original = await fs.promises.readFile(absIn, 'utf8');
  await suggestConflictResolutions(original, absIn);
  const { instruction, updateSnippet } = await suggestUpdateSnippetForContent(original, absIn);
  return await applyUpdateSnippetToFile(absIn, updateSnippet, instruction);
}

/**
 * Recursively resolve merge conflicts under a directory. Returns a summary of results.
 */
export async function resolveMergeConflictsUnderPath(rootPath: string, previewOnly: boolean = false): Promise<{
  processed: number;
  withConflicts: number;
  resolved: number;
  errors: number;
  results: Array<{ file: string; hadConflict: boolean; resolved: boolean; written: boolean; error?: string }>;
}> {
  const absRoot = path.resolve(rootPath);
  const ignoreDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.turbo', '.cache']);

  async function* walk(dir: string): AsyncGenerator<string> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) {
          yield* walk(full);
        }
      } else if (entry.isFile()) {
        yield full;
      }
    }
  }

  const results: Array<{ file: string; hadConflict: boolean; resolved: boolean; written: boolean; error?: string }> = [];
  let processed = 0;
  let withConflicts = 0;
  let resolved = 0;
  let errors = 0;

  for await (const file of walk(absRoot)) {
    processed++;
    try {
      const content = await fs.promises.readFile(file, 'utf8');
      const has = hasConflictMarkers(content);
      if (!has) {
        results.push({ file, hadConflict: false, resolved: false, written: false });
        continue;
      }
      withConflicts++;
      const { instruction, updateSnippet } = await suggestUpdateSnippetForContent(content, file);
      if (previewOnly) {
        await applyUpdateSnippetToContent(content, updateSnippet, instruction);
        results.push({ file, hadConflict: true, resolved: true, written: false });
        resolved++;
      } else {
        await applyUpdateSnippetToFile(file, updateSnippet, instruction);
        results.push({ file, hadConflict: true, resolved: true, written: true });
        resolved++;
      }
    } catch (err) {
      errors++;
      results.push({ file, hadConflict: false, resolved: false, written: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { processed, withConflicts, resolved, errors, results };
}

