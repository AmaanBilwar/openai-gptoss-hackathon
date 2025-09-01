/**
 * Diff Parser for RAG Feature
 * Parses unified diffs into structured file and hunk data
 */

export interface ParsedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  previousPath?: string;
  hunks: ParsedHunk[];
}

export interface ParsedHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  hunk: string;
  hunkIndex: number;
}

export interface ParseResult {
  files: ParsedFile[];
  totalHunks: number;
  totalAdditions: number;
  totalDeletions: number;
}

/**
 * Parse a full commit diff string into files and hunks
 */
export function parseCommitDiffToFilesAndHunks(diff: string): ParseResult {
  const files: ParsedFile[] = [];
  let currentFile: ParsedFile | null = null;
  let currentHunk: ParsedHunk | null = null;
  let hunkIndex = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;

  const lines = diff.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header
    if (line.startsWith('diff --git')) {
      // Save previous file if exists
      if (currentFile) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
          currentHunk = null;
        }
        files.push(currentFile);
      }

      // Parse file info
      const fileInfo = parseFileHeader(lines, i);
      currentFile = {
        path: fileInfo.path,
        status: fileInfo.status,
        additions: 0,
        deletions: 0,
        previousPath: fileInfo.previousPath,
        hunks: []
      };
      i = fileInfo.nextIndex - 1; // -1 because loop will increment
      continue;
    }

    // Hunk header
    if (line.startsWith('@@') && currentFile) {
      // Save previous hunk if exists
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      const hunkInfo = parseHunkHeader(line);
      currentHunk = {
        header: line,
        oldStart: hunkInfo.oldStart,
        oldLines: hunkInfo.oldLines,
        newStart: hunkInfo.newStart,
        newLines: hunkInfo.newLines,
        hunk: line + '\n',
        hunkIndex: hunkIndex++
      };
      continue;
    }

    // Hunk content
    if (currentHunk && currentFile) {
      currentHunk.hunk += line + '\n';
      
      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentFile.additions++;
        totalAdditions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentFile.deletions++;
        totalDeletions++;
      }
    }
  }

  // Save final hunk and file
  if (currentHunk && currentFile) {
    currentFile.hunks.push(currentHunk);
  }
  if (currentFile) {
    files.push(currentFile);
  }

  return {
    files,
    totalHunks: hunkIndex,
    totalAdditions,
    totalDeletions
  };
}

/**
 * Parse PR files response into hunks
 */
export function parsePRFilesToHunks(prFilesResponse: any[]): ParseResult {
  const files: ParsedFile[] = [];
  let totalHunks = 0;
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of prFilesResponse) {
    const fileData: ParsedFile = {
      path: file.filename,
      status: file.status as 'added' | 'modified' | 'deleted' | 'renamed',
      additions: file.additions || 0,
      deletions: file.deletions || 0,
      previousPath: file.previous_filename,
      hunks: []
    };

    totalAdditions += fileData.additions;
    totalDeletions += fileData.deletions;

    // Parse patch if available
    if (file.patch) {
      const patchResult = parseCommitDiffToFilesAndHunks(file.patch);
      if (patchResult.files.length > 0) {
        // Take hunks from the parsed patch (should be only one file)
        fileData.hunks = patchResult.files[0].hunks;
        totalHunks += fileData.hunks.length;
      }
    }

    files.push(fileData);
  }

  return {
    files,
    totalHunks,
    totalAdditions,
    totalDeletions
  };
}

/**
 * Parse file header from diff lines
 */
function parseFileHeader(lines: string[], startIndex: number): {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  previousPath?: string;
  nextIndex: number;
} {
  let path = '';
  let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';
  let previousPath: string | undefined;

  // Parse diff --git line
  const diffLine = lines[startIndex];
  const match = diffLine.match(/diff --git a\/(.+) b\/(.+)/);
  if (match) {
    const oldPath = match[1];
    const newPath = match[2];
    
    if (oldPath === '/dev/null') {
      status = 'added';
      path = newPath;
    } else if (newPath === '/dev/null') {
      status = 'deleted';
      path = oldPath;
    } else if (oldPath !== newPath) {
      status = 'renamed';
      path = newPath;
      previousPath = oldPath;
    } else {
      status = 'modified';
      path = newPath;
    }
  }

  // Look for additional file info in subsequent lines
  let nextIndex = startIndex + 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Stop at next file or hunk
    if (line.startsWith('diff --git') || line.startsWith('@@')) {
      break;
    }

    // Parse index line for more info
    if (line.startsWith('index ')) {
      // Index line can provide additional context
    }
    
    // Parse similarity line for renames
    if (line.startsWith('similarity index ')) {
      // This indicates a rename with similarity percentage
    }

    nextIndex = i + 1;
  }

  return { path, status, previousPath, nextIndex };
}

/**
 * Parse hunk header (@@ line)
 */
function parseHunkHeader(header: string): {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
} {
  // Parse @@ -oldStart,oldLines +newStart,newLines @@
  const match = header.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
  
  if (!match) {
    throw new Error(`Invalid hunk header: ${header}`);
  }

  const [, oldStartStr, oldLinesStr, newStartStr, newLinesStr] = match;
  
  const oldStart = parseInt(oldStartStr);
  const newStart = parseInt(newStartStr);
  
  // Handle cases where line count is omitted (means 1 line)
  const oldLines = oldLinesStr ? parseInt(oldLinesStr) : 1;
  const newLines = newLinesStr ? parseInt(newLinesStr) : 1;

  return {
    oldStart,
    oldLines,
    newStart,
    newLines
  };
}

/**
 * Validate that hunk line ranges match the actual content
 */
export function validateHunkRanges(hunk: ParsedHunk): boolean {
  const lines = hunk.hunk.split('\n').filter(line => line.trim() !== '');
  
  let actualOldLines = 0;
  let actualNewLines = 0;

  for (const line of lines) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      actualOldLines++;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      actualNewLines++;
    } else if (line.startsWith(' ')) {
      // Context lines count for both old and new
      actualOldLines++;
      actualNewLines++;
    }
  }

  return actualOldLines === hunk.oldLines && actualNewLines === hunk.newLines;
}

/**
 * Get a summary of parsed diff
 */
export function getDiffSummary(result: ParseResult): string {
  const { files, totalHunks, totalAdditions, totalDeletions } = result;
  
  const fileSummary = files.map(file => {
    const statusEmoji = {
      added: '🟢',
      modified: '🟡',
      deleted: '🔴',
      renamed: '🔄'
    }[file.status];
    
    return `${statusEmoji} ${file.path} (+${file.additions} -${file.deletions}, ${file.hunks.length} hunks)`;
  }).join('\n');

  return `📊 Diff Summary:
Files: ${files.length}
Hunks: ${totalHunks}
Changes: +${totalAdditions} -${totalDeletions}

${fileSummary}`;
}

/**
 * Extract text content from hunks for embedding
 */
export function extractHunkText(hunk: ParsedHunk): string {
  const lines = hunk.hunk.split('\n');
  const contentLines = lines.filter(line => 
    line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')
  ).map(line => line.substring(1)); // Remove +/-/ prefix
  
  return contentLines.join('\n');
}

/**
 * Get all hunk texts from a parse result
 */
export function getAllHunkTexts(result: ParseResult): string[] {
  const texts: string[] = [];
  
  for (const file of result.files) {
    for (const hunk of file.hunks) {
      texts.push(extractHunkText(hunk));
    }
  }
  
  return texts;
}
