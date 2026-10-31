import { describe, expect, it } from 'vitest';
import { createQuestion, type Question } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';
import type { ExtractedQuestionInput } from './extracted-test.ts';
import { questionForStudent } from './student-view.ts';

const q = (input: ExtractedQuestionInput): Question => {
  const created = createQuestion({ id: 'q1' as QuestionId, ...input });
  if (!created.ok) throw new Error('bad');
  return created.value;
};

describe('questionForStudent', () => {
  it('never includes the answer, model answer or rubric', () => {
    const views = [
      q({ type: 'multiple_choice', prompt: 'Pick', options: ['a', 'b'], correctOption: 1 }),
      q({ type: 'true_false', prompt: 'True?', answer: false }),
      q({ type: 'fill_blank', prompt: 'The ___', acceptedAnswers: ['secret-answer'] }),
      q({ type: 'short_answer', prompt: 'Why?', modelAnswer: 'secret-model' }),
      q({ type: 'essay', prompt: 'Write', rubric: 'secret-rubric' }),
    ].map(questionForStudent);

    const text = JSON.stringify(views);
    for (const secret of [
      'correctOption',
      'secret-answer',
      'secret-model',
      'secret-rubric',
      '"answer"',
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(views[0]).toEqual({
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'Pick',
      points: 10,
      instructions: null,
      options: ['a', 'b'],
      lefts: [],
      rights: [],
    });
  });

  it('lists matching items with the right-hand choices sorted, so their order gives nothing away', () => {
    const view = questionForStudent(
      q({
        type: 'matching',
        prompt: 'Match',
        pairs: [
          { left: 'dog', right: 'perro' },
          { left: 'cat', right: 'gato' },
        ],
      }),
    );
    expect(view).toMatchObject({ lefts: ['dog', 'cat'], rights: ['gato', 'perro'], options: [] });
  });
});
