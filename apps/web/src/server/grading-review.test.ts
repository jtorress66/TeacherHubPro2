import { describe, expect, it } from 'vitest';
import { createTranslator } from '@thp/i18n';
import { answerLines, scoreSummary } from './grading-review.ts';

const en = createTranslator('en');
const es = createTranslator('es');

describe('answerLines', () => {
  it('says when nothing was answered', () => {
    expect(answerLines({ kind: 'unanswered' }, en)).toEqual([
      { text: '(no answer)', mark: null, hint: false },
    ]);
  });

  it('shows a multiple-choice answer by letter and text, and the right one when it is wrong', () => {
    const choice = {
      kind: 'choice',
      letter: 'C',
      text: 'Mars',
      correctLetter: 'A',
      correctText: 'Mercury',
    } as const;

    expect(answerLines({ ...choice, correct: false }, en)).toEqual([
      { text: 'C. Mars', mark: 'incorrect', hint: false },
      { text: 'Correct answer: A. Mercury', mark: null, hint: true },
    ]);
    expect(answerLines({ ...choice, letter: 'A', text: 'Mercury', correct: true }, es)).toEqual([
      { text: 'A. Mercury', mark: 'correct', hint: false },
    ]);
  });

  it('translates true and false', () => {
    expect(answerLines({ kind: 'truefalse', value: true, correct: true }, es)).toEqual([
      { text: 'Cierto', mark: 'correct', hint: false },
    ]);
    expect(answerLines({ kind: 'truefalse', value: false, correct: false }, en)).toEqual([
      { text: 'False', mark: 'incorrect', hint: false },
    ]);
  });

  it('lists the accepted answers under a wrong blank only', () => {
    const blank = { kind: 'blank', text: 'moon', accepted: ['sun', 'the sun'] } as const;

    expect(answerLines({ ...blank, correct: false }, en)).toEqual([
      { text: 'moon', mark: 'incorrect', hint: false },
      { text: 'Accepted answers: sun, the sun', mark: null, hint: true },
    ]);
    expect(answerLines({ ...blank, text: 'Sun', correct: true }, en)).toEqual([
      { text: 'Sun', mark: 'correct', hint: false },
    ]);
  });

  it('gives one line per matching pair, with a dash for an unmatched one', () => {
    expect(
      answerLines(
        {
          kind: 'matching',
          pairs: [
            { left: 'dog', right: 'perro', correct: true },
            { left: 'cat', right: null, correct: false },
          ],
        },
        en,
      ),
    ).toEqual([
      { text: 'dog → perro', mark: 'correct', hint: false },
      { text: 'cat → —', mark: 'incorrect', hint: false, hidden: 'not matched' },
    ]);
  });

  it('shows written answers as they are', () => {
    expect(answerLines({ kind: 'text', text: 'Because it turns' }, en)).toEqual([
      { text: 'Because it turns', mark: null, hint: false },
    ]);
  });
});

describe('scoreSummary', () => {
  it('says right or wrong for an answer scored automatically, in points', () => {
    expect(scoreSummary({ score: 1, source: 'auto' }, 1, en, 'en')).toEqual({
      verdict: 'correct',
      points: '1 of 1 point',
      source: 'scored automatically',
    });
    expect(scoreSummary({ score: 0, source: 'auto' }, 4, en, 'en')).toEqual({
      verdict: 'incorrect',
      points: '0 of 4 points',
      source: 'scored automatically',
    });
  });

  it('gives only the points for partial credit and for AI suggestions', () => {
    expect(scoreSummary({ score: 0.5, source: 'auto' }, 1, en, 'en')).toEqual({
      verdict: null,
      points: '0.5 of 1 point',
      source: 'scored automatically',
    });
    expect(scoreSummary({ score: 10, source: 'ai' }, 10, en, 'en')).toEqual({
      verdict: null,
      points: '10 of 10 points',
      source: 'suggested by AI',
    });
  });

  it('is translated, with the language’s decimal mark', () => {
    expect(scoreSummary({ score: 0.5, source: 'auto' }, 1, es, 'es')).toEqual({
      verdict: null,
      points: '0,5 de 1 punto',
      source: 'calificada automáticamente',
    });
    expect(scoreSummary({ score: 2, source: 'ai' }, 4, es, 'es').points).toBe('2 de 4 puntos');
  });
});
