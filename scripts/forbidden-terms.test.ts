import { describe, expect, it } from 'vitest';
import { findForbiddenTerms } from './forbidden-terms.ts';

// Built from parts so this file does not contain the term itself.
const term = ['Emer', 'gent'].join('');

describe('findForbiddenTerms', () => {
  it('flags the term in source files with its line number', () => {
    const violations = findForbiddenTerms([
      { path: 'apps/web/src/page.tsx', content: `ok\nmade with ${term}\n` },
    ]);

    expect(violations).toEqual([{ path: 'apps/web/src/page.tsx', line: 2 }]);
  });

  it('allows CLAUDE.md and docs/', () => {
    const violations = findForbiddenTerms([
      { path: 'CLAUDE.md', content: term },
      { path: 'docs/FEATURES.md', content: term },
    ]);

    expect(violations).toEqual([]);
  });

  it('is case-insensitive', () => {
    const violations = findForbiddenTerms([
      { path: 'a.env', content: `${term.toUpperCase()}_LLM_KEY=x` },
      { path: 'b.ts', content: term.toLowerCase() },
    ]);

    expect(violations.map((v) => v.path)).toEqual(['a.env', 'b.ts']);
  });

  it('does not allow docs folders nested elsewhere', () => {
    const violations = findForbiddenTerms([{ path: 'apps/web/docs/x.md', content: term }]);

    expect(violations).toHaveLength(1);
  });
});
