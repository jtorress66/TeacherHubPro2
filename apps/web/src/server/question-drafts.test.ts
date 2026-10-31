import { describe, expect, it } from 'vitest';
import { createQuestion, type Question, type QuestionId } from '@thp/domain';
import { blankDraft, draftOf, inputOf, nextQuestionId } from './question-drafts.ts';

const question = (input: Parameters<typeof createQuestion>[0]): Question => {
  const created = createQuestion(input);
  if (!created.ok) throw new Error('bad');
  return created.value;
};

describe('question drafts', () => {
  it('round-trips every question type through the editor’s text fields', () => {
    const questions = [
      question({
        id: 'q1' as QuestionId,
        type: 'multiple_choice',
        prompt: 'Pick',
        options: ['a', 'b'],
        correctOption: 1,
        points: 4,
      }),
      question({
        id: 'q2' as QuestionId,
        type: 'true_false',
        prompt: 'True?',
        answer: false,
        instructions: 'Read',
      }),
      question({
        id: 'q3' as QuestionId,
        type: 'fill_blank',
        prompt: 'The ___',
        acceptedAnswers: ['sun', 'the sun'],
      }),
      question({
        id: 'q4' as QuestionId,
        type: 'short_answer',
        prompt: 'Why?',
        modelAnswer: 'Because',
      }),
      question({
        id: 'q5' as QuestionId,
        type: 'matching',
        prompt: 'Match',
        pairs: [
          { left: 'dog', right: 'perro' },
          { left: 'cat', right: 'gato' },
        ],
      }),
      question({ id: 'q6' as QuestionId, type: 'essay', prompt: 'Write', rubric: null }),
    ];
    const drafts = questions.map(draftOf);
    expect(drafts[0]).toMatchObject({ optionsText: 'a\nb', correctOption: 1, points: '4' });
    expect(drafts[4]?.pairsText).toBe('dog = perro\ncat = gato');

    const back = drafts.map(inputOf);
    for (const [i, input] of back.entries()) {
      const recreated = createQuestion(input);
      expect(recreated.ok && recreated.value).toEqual(questions[i]);
    }
  });

  it('starts a new question of a type with the next free id', () => {
    expect(blankDraft('true_false', 'q7')).toMatchObject({
      id: 'q7',
      type: 'true_false',
      prompt: '',
      answer: true,
      points: '10',
    });
    expect(nextQuestionId([{ id: 'q2' }, { id: 'q10' }, { id: 'imported' }])).toBe('q11');
    expect(nextQuestionId([])).toBe('q1');
  });

  it('keeps blank lines and a missing equals sign out of lists and pairs', () => {
    const draft = { ...blankDraft('matching', 'q1'), pairsText: 'a = b\n\nnot a pair\nc=d' };
    expect(inputOf(draft)).toMatchObject({
      pairs: [
        { left: 'a', right: 'b' },
        { left: 'c', right: 'd' },
      ],
    });
    const blank = { ...blankDraft('fill_blank', 'q2'), acceptedText: 'one\n\n two ', points: '' };
    expect(inputOf(blank)).toMatchObject({ acceptedAnswers: ['one', 'two'] });
    expect(inputOf(blank)).not.toHaveProperty('points');
  });
});
