

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
    description,
    body
  };
}
