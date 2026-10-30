import { describe, expect, it } from 'vitest';
import {
  createSpeechRequest,
  maxSpeechPartLength,
  maxSpeechTextLength,
  speakableText,
  speechParts,
} from './speech.ts';

describe('speakableText', () => {
  it('drops Markdown marks, table rules and blanks so they are not read aloud', () => {
    const markdown = [
      '# Fractions',
      '',
      '**Bold** and _soft_ words, `code` and [a link](https://example.com).',
      '',
      '| Name | Answer |',
      '|---|---|',
      '| Ana | ___ |',
      '',
      '- one',
      '1. two',
      '> quoted',
    ].join('\n');

    expect(speakableText(markdown)).toBe(
      [
        'Fractions',
        '',
        'Bold and soft words, code and a link.',
        '',
        'Name, Answer',
        'Ana',
        '',
        'one',
        'two',
        'quoted',
      ].join('\n'),
    );
  });
});

describe('speechParts', () => {
  it('keeps short text in one part', () => {
    expect(speechParts('Hello class.')).toEqual(['Hello class.']);
  });

  it('splits long text on paragraphs, then sentences, losing nothing', () => {
    const sentence = 'The water cycle moves water around the planet. ';
    const paragraph = sentence.repeat(60).trim();
    const text = [paragraph, paragraph, paragraph].join('\n\n');
    const parts = speechParts(text);

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= maxSpeechPartLength)).toBe(true);
    expect(parts.join(' ').replace(/\s+/g, ' ')).toBe(text.replace(/\s+/g, ' '));
  });

  it('cuts a very long sentence at a space when it has no break', () => {
    const words = 'word '.repeat(1000).trim();
    const parts = speechParts(words);
    expect(parts.every((part) => part.length <= maxSpeechPartLength)).toBe(true);
    expect(parts.join(' ')).toBe(words);
  });

  it('returns nothing for blank text', () => {
    expect(speechParts('  \n ')).toEqual([]);
  });
});

describe('createSpeechRequest', () => {
  it('turns Markdown into speakable parts in a known language', () => {
    expect(createSpeechRequest({ text: '# Hola\n\nBuenos días.', language: 'es' })).toEqual({
      ok: true,
      value: { language: 'es', parts: ['Hola\n\nBuenos días.'] },
    });
  });

  it.each([
    [{ text: ' # ', language: 'en' }, 'text', 'required'],
    [{ text: 'x'.repeat(maxSpeechTextLength + 1), language: 'en' }, 'text', 'too_long'],
    [{ text: 'Hi', language: 'ru' }, 'language', 'not_allowed'],
  ])('rejects %o', (input, field, code) => {
    expect(createSpeechRequest(input)).toEqual({ ok: false, error: { field, code } });
  });
});
