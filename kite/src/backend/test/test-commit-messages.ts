

import { describe, it, expect } from 'vitest';

describe('Commit Message Tests', () => {

  it('should validate conventional commit format', () => {
    const validMessages = [
      'feat: add new feature',
      'fix: resolve bug in login',
      'docs: update README',
      'style: format code',
      'refactor: restructure auth logic',
      'test: add unit tests',
      'chore: update dependencies'
    ];

    validMessages.forEach(msg => {
      expect(isConventionalCommit(msg)).toBe(true);
    });
  });

  it('should reject invalid commit messages', () => {
    const invalidMessages = [
      'adding stuff',
      'fixed bug',
      'feat:no space after type',
      'unknown: not a valid type',
      ': empty type',
      'feat: '
    ];

    invalidMessages.forEach(msg => {
      expect(isConventionalCommit(msg)).toBe(false);
    });
  });

  it('should parse commit message components', () => {
    const message = 'feat(auth): implement OAuth login\n\nImplements OAuth2 flow with Google';
    const parsed = parseCommitMessage(message);
    
    expect(parsed).toEqual({
      type: 'feat',
      scope: 'auth',
      description: 'implement OAuth login',
      body: 'Implements OAuth2 flow with Google'
    });
  });

});

function isConventionalCommit(message: string): boolean {
  const pattern = /^(feat|fix|docs|style|refactor|test|chore)(\([a-z-]+\))?: .+/;
  return pattern.test(message);
}

function parseCommitMessage(message: string) {
  const [firstLine, ...bodyLines] = message.split('\n').filter(line => line.trim());
  const typeMatch = firstLine.match(/^(\w+)(?:\(([a-z-]+)\))?: (.+)$/);

  if (!typeMatch) {
    return null;
  }

  const [, type, scope, description] = typeMatch;
  const body = bodyLines.join('\n').trim();

  return {
    type,
    scope,
    body
  };
}



function sortNumberArray(numbers: number[]): number[] {
  return numbers.sort((a, b) => {
    // Handle special cases like NaN and Infinity
    if (isNaN(a)) return 1;
    if (isNaN(b)) return -1;
    if (a === Infinity) return 1;
    if (b === Infinity) return -1;
    return a - b;
  });
}

function logGitOperationStatus(operation: string, success: boolean, details?: string): void {
  const timestamp = new Date().toISOString();
  const status = success ? 'SUCCESS' : 'FAILED';
  console.log(`[${timestamp}] Git ${operation} - ${status}`);
  if (details) {
    console.log(`Details: ${details}`);
  }
  console.log('-'.repeat(50));
}


