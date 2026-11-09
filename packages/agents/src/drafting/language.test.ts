import { describe, expect, it } from 'vitest';
import { detectLanguage, languageEvidence } from './language.ts';

describe('detectLanguage', () => {
  it('tells Spanish from Portuguese in short questions, accents and all', () => {
    expect(detectLanguage('¿Qué fracción es mayor? ¿Cuál es el numerador de 3/4?')).toBe('es');
    expect(detectLanguage('Qual fração é maior? Os animais com coluna são vertebrados.')).toBe(
      'pt',
    );
  });

  it('still recognises the other languages', () => {
    expect(detectLanguage('Which fraction is the biggest of the three?')).toBe('en');
    expect(detectLanguage('Quelle fraction est la plus grande? Les élèves comparent.')).toBe('fr');
    expect(detectLanguage('Welcher Bruch ist größer? Die Schüler vergleichen.')).toBe('de');
    expect(detectLanguage('Quale frazione è più grande? Gli studenti confrontano.')).toBe('it');
    expect(detectLanguage('哪个分数更大？')).toBe('zh');
  });
});

describe('languageEvidence', () => {
  it('counts no evidence in single words, so a game of names cannot be judged by them', () => {
    expect(languageEvidence('Vertebrados Gato Cão Invertebrados Polvo Minhoca').hits).toBe(0);
    expect(languageEvidence('Which is the largest planet?')).toEqual({ language: 'en', hits: 3 });
  });
});
