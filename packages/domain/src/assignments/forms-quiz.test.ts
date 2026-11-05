import { describe, expect, it } from 'vitest';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Question } from '../gradebook/question.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  QuestionId,
  SchoolId,
} from '../shared/ids.ts';
import { toFormsQuiz } from './forms-quiz.ts';

const labels = { true: 'True', false: 'False' };

const assignmentWith = (
  questions: readonly Question[],
  instructions: string | null = null,
): Assignment => ({
  id: 'a1' as AssignmentId,
  schoolId: 's1' as SchoolId,
  classId: 'c1' as ClassId,
  categoryId: 'g1' as GradeCategoryId,
  title: 'Fractions quiz',
  points: 100,
  dueDate: null,
  instructions,
  questions,
});

const common = { id: 'q1' as QuestionId, points: 5, instructions: null };

describe('toFormsQuiz', () => {
  it('keeps the title and general instructions', () => {
    const quiz = toFormsQuiz(assignmentWith([], 'Show your work.'), labels);
    expect(quiz).toEqual({ title: 'Fractions quiz', description: 'Show your work.', items: [] });
  });

  it('makes a quiz from reviewed questions that belong to no assignment', () => {
    const quiz = toFormsQuiz(
      {
        title: 'Loose quiz',
        instructions: null,
        questions: [{ ...common, type: 'essay', prompt: 'Why?', rubric: null }],
      },
      labels,
    );
    expect(quiz.title).toBe('Loose quiz');
    expect(quiz.items).toHaveLength(1);
  });

  it('uses an empty description when there are no instructions', () => {
    expect(toFormsQuiz(assignmentWith([]), labels).description).toBe('');
  });

  it('turns multiple choice into a scored single choice with its correct option', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        {
          ...common,
          type: 'multiple_choice',
          prompt: 'What is 1/2 + 1/4?',
          options: ['3/4', '2/6'],
          correctOption: 0,
        },
      ]),
      labels,
    );
    expect(quiz.items).toEqual([
      {
        kind: 'choice',
        title: 'What is 1/2 + 1/4?',
        description: null,
        points: 5,
        options: ['3/4', '2/6'],
        correct: ['3/4'],
      },
    ]);
  });

  it('turns true/false into a scored choice with labels in the teacher language', () => {
    const quiz = toFormsQuiz(
      assignmentWith([{ ...common, type: 'true_false', prompt: '1/2 > 1/3', answer: false }]),
      { true: 'Verdadero', false: 'Falso' },
    );
    expect(quiz.items[0]).toMatchObject({
      kind: 'choice',
      options: ['Verdadero', 'Falso'],
      correct: ['Falso'],
    });
  });

  it('scores fill in the blank by its accepted answers', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        {
          ...common,
          type: 'fill_blank',
          prompt: 'Half of 8 is ___',
          acceptedAnswers: ['4', 'four'],
        },
      ]),
      labels,
    );
    expect(quiz.items[0]).toEqual({
      kind: 'text',
      title: 'Half of 8 is ___',
      description: null,
      points: 5,
      paragraph: false,
      correct: ['4', 'four'],
    });
  });

  it('leaves short answers and essays for the teacher to score in Forms', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        { ...common, type: 'short_answer', prompt: 'Why?', modelAnswer: 'Because' },
        { ...common, type: 'essay', prompt: 'Explain fractions.', rubric: 'Clear' },
      ]),
      labels,
    );
    expect(quiz.items).toEqual([
      { kind: 'text', title: 'Why?', description: null, points: 5, paragraph: false, correct: [] },
      {
        kind: 'text',
        title: 'Explain fractions.',
        description: null,
        points: 5,
        paragraph: true,
        correct: [],
      },
    ]);
  });

  it('turns matching into an unscored grid whose columns do not reveal the pairs', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        {
          ...common,
          type: 'matching',
          prompt: 'Match each fraction',
          pairs: [
            { left: '1/2', right: 'half' },
            { left: '1/4', right: 'a quarter' },
            { left: '3/4', right: 'three quarters' },
          ],
        },
      ]),
      labels,
    );
    expect(quiz.items[0]).toEqual({
      kind: 'grid',
      title: 'Match each fraction',
      description: null,
      rows: ['1/2', '1/4', '3/4'],
      columns: ['a quarter', 'half', 'three quarters'],
    });
  });

  it('lists a right side shared by several pairs once', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        {
          ...common,
          type: 'matching',
          prompt: 'Even or odd',
          pairs: [
            { left: '2', right: 'even' },
            { left: '3', right: 'odd' },
            { left: '4', right: 'even' },
          ],
        },
      ]),
      labels,
    );
    expect(quiz.items[0]).toMatchObject({ rows: ['2', '3', '4'], columns: ['even', 'odd'] });
  });

  it('gives Forms whole points, at least one', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        { ...common, type: 'true_false', prompt: 'a', answer: true, points: 2.5 },
        { ...common, type: 'essay', prompt: 'b', rubric: null, points: 0.25 },
      ]),
      labels,
    );
    expect(quiz.items.map((item) => ('points' in item ? item.points : null))).toEqual([3, 1]);
  });

  it('keeps each question instructions as its description', () => {
    const quiz = toFormsQuiz(
      assignmentWith([
        {
          ...common,
          type: 'true_false',
          prompt: 'p',
          answer: true,
          instructions: 'Word bank: a, b',
        },
      ]),
      labels,
    );
    expect(quiz.items[0]?.description).toBe('Word bank: a, b');
  });
});
