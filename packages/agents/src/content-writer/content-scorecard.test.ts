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

  it('counts only the first numbered section when the headings are in another language', () => {
    const quiz = [
      '# Cuestionario',
      'Lee con atención.',
      '## Preguntas',
      '1. ¿Uno?',
      '2. ¿Dos?',
      '## Clave de respuestas',
      '1. Sí',
      '2. No',
    ].join('\n');
    expect(countQuestions(quiz)).toBe(2);
  });

  it('counts every numbered item when there are no headings around them', () => {
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
      numbering: 1,
      uniqueQuestions: 1,
    });
  });

  it('scores a missing result as failing, still checking the raw codes', () => {
    expect(scoreContent(aContentRequest(), null, 'Cite CCSS.Math.Content.4.NF.Z.9')).toEqual({
      structure: 0,
      language: 0,
      validCodes: 0,
      questionCount: 0,
      numbering: 0,
      uniqueQuestions: 0,
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
    expect(contentMetrics).toEqual([
      'structure',
      'language',
      'validCodes',
      'questionCount',
      'numbering',
      'uniqueQuestions',
    ]);
  });

  const quizOf = (questions: readonly string[], answers: readonly string[]) =>
    ['# Quiz', '', '## Questions', ...questions, '', '## Answer key', ...answers].join('\n');
  const three = aContentRequest({ type: 'quiz', questionCount: 3 });

  it('scores a quiz numbered 1 to the last with one matching answer key', () => {
    const quiz = quizOf(['1. Red?', '2. Blue?', '3. Green?'], ['1. a', '2. b', '3. c']);
    expect(scoreContent(three, quiz, quiz)).toMatchObject({ numbering: 1, uniqueQuestions: 1 });
  });

  it.each([
    ['a gap in the questions', ['1. Red?', '2. Blue?', '4. Green?'], ['1. a', '2. b', '3. c']],
    ['a short answer key', ['1. Red?', '2. Blue?', '3. Green?'], ['1. a', '2. b']],
    ['numbering restarted', ['1. Red?', '2. Blue?', '1. Green?'], ['1. a', '2. b', '3. c']],
  ])('fails the numbering of a quiz with %s', (_name, questions, answers) => {
    const quiz = quizOf(questions, answers);
    expect(scoreContent(three, quiz, quiz).numbering).toBe(0);
  });

  it('fails the numbering of a quiz without numbered questions', () => {
    const quiz = '# Quiz\n\nNo questions here.';
    expect(scoreContent(three, quiz, quiz).numbering).toBe(0);
  });

  it('fails the numbering of a quiz with two answer keys', () => {
    const quiz = `${quizOf(['1. Red?', '2. Blue?', '3. Green?'], ['1. a', '2. b', '3. c'])}\n\n## Answer key\n1. a`;
    expect(scoreContent(three, quiz, quiz).numbering).toBe(0);
  });

  it('fails a quiz that asks the same question twice, whatever the case or punctuation', () => {
    const quiz = quizOf(
      ['1. What is red?', '2. Blue?', '3. what is RED'],
      ['1. a', '2. b', '3. c'],
    );
    expect(scoreContent(three, quiz, quiz).uniqueQuestions).toBe(0);
  });
});
