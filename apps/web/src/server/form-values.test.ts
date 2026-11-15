import { describe, expect, it } from 'vitest';
import { prefill, submittedValues } from './form-values.ts';

const form = (entries: readonly [string, string | Blob][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe('submittedValues', () => {
  it('keeps what the teacher typed, chose and ticked, with repeated names as lists', () => {
    const data = form([
      ['type', 'quiz'],
      ['questionCount', '101'],
      ['instructions', ' Use rain '],
      ['esl', 'on'],
      ['days', 'mon'],
      ['days', 'wed'],
    ]);
    expect(submittedValues(data)).toEqual({
      type: 'quiz',
      questionCount: '101',
      instructions: ' Use rain ',
      esl: 'on',
      days: ['mon', 'wed'],
    });
  });

  it('never sends back passwords, tokens, files or the framework’s own fields', () => {
    const data = form([
      ['email', 'ana@example.com'],
      ['password', 'secret-1'],
      ['newPassword', 'secret-2'],
      ['token', 'abc'],
      ['key', 'setup-key'],
      ['apiKey', 'k-1'],
      ['$ACTION_ID_123', ''],
      ['file', new File(['x'], 'work.pdf')],
    ]);
    expect(submittedValues(data)).toEqual({ email: 'ana@example.com' });
  });
});

describe('prefill', () => {
  it('uses the defaults before anything was sent', () => {
    const values = prefill(undefined);
    expect(values.text('type', 'worksheet')).toBe('worksheet');
    expect(values.text('topic')).toBeUndefined();
    expect(values.checked('esl')).toBe(false);
    expect(values.checked('esl', true)).toBe(true);
    expect(values.all('days', ['mon'])).toEqual(['mon']);
    expect(values.key).toBe('');
  });

  it('uses what was sent, and an unticked box stays unticked', () => {
    const values = prefill({ type: 'quiz', questionCount: '101', days: ['mon', 'wed'] });
    expect(values.text('type', 'worksheet')).toBe('quiz');
    expect(values.text('questionCount', 10)).toBe('101');
    expect(values.text('missing', 'fallback')).toBe('fallback');
    expect(values.text('days')).toBe('mon');
    expect(values.checked('esl', true)).toBe(false);
    expect(values.all('days')).toEqual(['mon', 'wed']);
    expect(values.all('type')).toEqual(['quiz']);
    expect(values.all('missing', ['x'])).toEqual([]);
  });

  it('gives the form a new key when the values sent change, and the same key when not', () => {
    const first = prefill({ type: 'quiz' }).key;
    expect(first).not.toBe('');
    expect(prefill({ type: 'quiz' }).key).toBe(first);
    expect(prefill({ type: 'summary' }).key).not.toBe(first);
  });
});
