import { describe, expect, it } from 'vitest';
import { languageFromText } from './language.ts';

describe('languageFromText', () => {
  it('reads a code, or the name in English or in the language itself', () => {
    expect(languageFromText('es')).toBe('es');
    expect(languageFromText(' Spanish ')).toBe('es');
    expect(languageFromText('Español')).toBe('es');
    expect(languageFromText('espanol')).toBe('es');
    expect(languageFromText('Chinese')).toBe('zh');
    expect(languageFromText('中文')).toBe('zh');
    expect(languageFromText('Português')).toBe('pt');
    expect(languageFromText('DEUTSCH')).toBe('de');
  });

  it('gives none for a blank or unknown language', () => {
    expect(languageFromText('')).toBeNull();
    expect(languageFromText('Klingon')).toBeNull();
  });
});
