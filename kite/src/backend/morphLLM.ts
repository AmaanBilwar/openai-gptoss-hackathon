import { MORPH_API_KEY } from './config';
import * as fs from 'fs';
import * as path from 'path';

interface MorphApplyRequestBody {
  model?: string;
  messages: Array<{ role: 'user'; content: string }>;
  stream?: boolean;
}

interface MorphApplyResponseChoice {
  index: number;
  message: { role: 'assistant'; content: string };
  finish_reason?: string;
}

interface MorphApplyResponse {
  id: string;
  object: string;
  created: number;
  choices: MorphApplyResponseChoice[];
}

 

export interface ApplyCodeParams {
  instruction: string; // brief description of what you're changing
  originalCode: string; // full pre-change code
  updateSnippet: string; // minimal changes with // ... existing code ... markers
  model?: string; // default morph-v3-large
}

/**
 * Build Apply XML payload content
 */
function buildApplyXml(instruction: string, code: string, update: string): string {
  return `<instruction>${instruction}</instruction>\n<code>${code}</code>\n<update>${update}</update>`;
}

/**
 * Calls Morph Apply API to apply an update snippet onto original code.
 * API docs: https://docs.morphllm.com/api-reference/endpoint/apply
 */
export async function applyCodeWithMorph(params: ApplyCodeParams): Promise<string> {
  const apiKey = MORPH_API_KEY || process.env.MORPH_API_KEY;
  if (!apiKey) {
    throw new Error('MORPH_API_KEY not set');
  }

  const model = params.model || 'morph-v3-large';
  const content = buildApplyXml(params.instruction, params.originalCode, params.updateSnippet);

  const body: MorphApplyRequestBody = {
    model,
    messages: [
      { role: 'user', content }
    ],
    stream: false
  };

  const res = await fetch('https://api.morphllm.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Morph Apply failed: ${res.status} ${res.statusText} ${text}`);
  }

  const data = (await res.json()) as MorphApplyResponse;
  const contentOut = data.choices?.[0]?.message?.content;
  if (!contentOut) {
    throw new Error('Morph Apply returned empty content');
  }
  return contentOut;
}
 
/**
 * Apply a provided Morph update snippet to in-memory content.
 */
export async function applyUpdateSnippetToContent(
  originalCode: string,
  updateSnippet: string,
  instruction: string = 'Apply the provided update snippet to the code. Use // ... existing code ... markers to align unchanged sections.',
  model: string = 'morph-v3-large'
): Promise<string> {
  return applyCodeWithMorph({ instruction, originalCode, updateSnippet, model });
}

/**
 * Apply a provided Morph update snippet to a file on disk.
 * Overwrites the input file. Returns the absolute path written to.
 */
export async function applyUpdateSnippetToFile(
  inputPath: string,
  updateSnippet: string,
  instruction: string = 'Apply the provided update snippet to the code. Use // ... existing code ... markers to align unchanged sections.',
  model: string = 'morph-v3-large'
): Promise<string> {
  const absIn = path.resolve(inputPath);
  const original = await fs.promises.readFile(absIn, 'utf8');
  const applied = await applyCodeWithMorph({ instruction, originalCode: original, updateSnippet, model });
  await fs.promises.mkdir(path.dirname(absIn), { recursive: true });
  await fs.promises.writeFile(absIn, applied, 'utf8');
  return absIn;
}

