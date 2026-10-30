import { describe, expect, it } from 'vitest';
import { aContentRequest } from '@thp/testing';
import { contentMetrics, countQuestions, scoreContent } from './content-scorecard.ts';

const english = [
  '# Equivalent fractions',
  '',
  'The students compare fractions with the same value and explain their thinking.',
  'CCSS.Math.Content.4.NF.A.1',
].join('\n');

describe('countQuestions', () => {
  it('counts numbered items under the Questions heading only', () => {
    const quiz = [
      '# Quiz',
      '## Questions',
      '1. One?',
      '   a) yes',
      '2. Two?',
      '10. Ten?',
      '## Answer key',
      '1. yes',
      '2. no',
    ].join('\n');
    expect(countQuestions(quiz)).toBe(3);
  });

  it('counts every numbered item when there is no Questions heading', () => {
    expect(countQuestions('# Quiz\n1. a\n2. b')).toBe(2);
  });
});

describe('scoreContent', () => {
  it('scores usable content in the right language with official codes as all ones', () => {
    expect(scoreContent(aContentRequest(), english, english)).toEqual({
      structure: 1,
      language: 1,
      validCodes: 1,
      questionCount: 1,
    });
  });

  it('scores a missing result as failing, still checking the raw codes', () => {
    expect(scoreContent(aContentRequest(), null, 'Cite CCSS.Math.Content.4.NF.Z.9')).toEqual({
      structure: 0,
      language: 0,
      validCodes: 0,
      questionCount: 0,
    });
  });

  it('marks codes from another grade or subject as invalid', () => {
    const raw = `${english}\nCCSS.Math.Content.7.NS.A.1`;
    expect(scoreContent(aContentRequest(), english, raw).validCodes).toBe(0.5);
  });

  it('checks the language and a quiz’s question count', () => {
    const quiz = aContentRequest({ type: 'quiz', questionCount: 2, language: 'es' });
    const content = '# Cuestionario\n\nLos estudiantes y las fracciones.\n\n## Questions\n1. ¿Qué?';
    expect(scoreContent(quiz, content, content)).toMatchObject({ language: 1, questionCount: 0 });
  });

  it('lists its metrics', () => {
    expect(contentMetrics).toEqual(['structure', 'language', 'validCodes', 'questionCount']);
  });
});
