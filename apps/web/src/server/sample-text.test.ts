import { describe, expect, it } from 'vitest';
import { locales } from '@thp/i18n';
import { sampleText } from './sample-text.ts';

describe('sampleText', () => {
  it.each(locales)('writes the whole sample class in %s', (locale) => {
    const text = sampleText(locale);

    expect(text.students).toHaveLength(6);
    expect(text.plan.days).toHaveLength(5);
    expect(text.plan.skills).toHaveLength(3);
    expect(text.game.prompts).toHaveLength(5);
    const words = JSON.stringify(text);
    expect(words).not.toContain('sample.');
    expect(words).not.toContain('""');
  });

  it('uses the language it is asked for', () => {
    expect(sampleText('es').className).not.toBe(sampleText('en').className);
  });
});
