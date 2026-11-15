import { describe, expect, it } from 'vitest';
import { checkClaudeKey, keyRefusedMessage } from './container.ts';

// Refused and accepted keys are covered against recorded replies in the adapter's tests.
describe('checkClaudeKey', () => {
  it('skips the check for the local stand-in model', async () => {
    expect(await checkClaudeKey({ provider: 'local' })).toBe('AI key check skipped (local model).');
  });

  it('names the setting to fix in plain words', () => {
    expect(keyRefusedMessage).toContain('ANTHROPIC_API_KEY');
    expect(keyRefusedMessage).toMatch(/replaced/);
  });
});
