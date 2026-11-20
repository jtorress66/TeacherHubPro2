import { describe, expect, it } from 'vitest';
import { locales } from './locales.ts';
import { createTranslator } from './translator.ts';

// WCAG 2.5.3 (label in name): a control's spoken name starts with the words it shows, so people
// who use voice control can say what they see.
describe.each(locales)('names a screen reader hears (%s)', (locale) => {
  const t = createTranslator(locale);

  it("start with the report card download button's visible words", () => {
    expect(t('reportCards.downloadFor', { name: 'Ana Zayas' })).toMatch(
      new RegExp(`^${t('reportCards.download')}`),
    );
  });
});
