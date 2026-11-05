import type { Question, QuestionType } from '../gradebook/question.ts';
import type { AssignmentId, SchoolId } from '../shared/ids.ts';

/** One question of a Forms quiz; `correct` is empty when the teacher scores it in Forms. */
export type FormsQuizItem =
  | {
      readonly kind: 'choice';
      readonly title: string;
      readonly description: string | null;
      readonly points: number;
      readonly options: readonly string[];
      readonly correct: readonly string[];
    }
  | {
      readonly kind: 'text';
      readonly title: string;
      readonly description: string | null;
      readonly points: number;
      readonly paragraph: boolean;
      readonly correct: readonly string[];
    }
  | {
      readonly kind: 'grid';
      readonly title: string;
      readonly description: string | null;
      readonly rows: readonly string[];
      readonly columns: readonly string[];
    };

/** Questions as a self-scoring quiz, independent of the provider that builds it. */
export interface FormsQuiz {
  readonly title: string;
  readonly description: string;
  readonly items: readonly FormsQuizItem[];
}

/** The true/false choices, in the teacher's language. */
export interface TrueFalseLabels {
  readonly true: string;
  readonly false: string;
}

type ItemOf = {
  [T in QuestionType]: (
    question: Extract<Question, { type: T }>,
    labels: TrueFalseLabels,
  ) => FormsQuizItem;
};

/** Forms takes whole points only. */
const formsPoints = (points: number) => Math.max(1, Math.round(points));

const head = (question: Question) => ({
  title: question.prompt,
  description: question.instructions,
});

const text = (
  question: Question,
  paragraph: boolean,
  correct: readonly string[],
): FormsQuizItem => ({
  kind: 'text',
  ...head(question),
  points: formsPoints(question.points),
  paragraph,
  correct,
});

const items: ItemOf = {
  multiple_choice: (question) => ({
    kind: 'choice',
    ...head(question),
    points: formsPoints(question.points),
    options: question.options,
    correct: [question.options[question.correctOption] ?? ''],
  }),
  true_false: (question, labels) => ({
    kind: 'choice',
    ...head(question),
    points: formsPoints(question.points),
    options: [labels.true, labels.false],
    correct: [question.answer ? labels.true : labels.false],
  }),
  fill_blank: (question) => text(question, false, question.acceptedAnswers),
  short_answer: (question) => text(question, false, []),
  essay: (question) => text(question, true, []),
  // Forms cannot score a grid; sorted columns keep the pairs from showing in order.
  matching: (question) => ({
    kind: 'grid',
    ...head(question),
    rows: question.pairs.map((pair) => pair.left),
    columns: [...new Set(question.pairs.map((pair) => pair.right))].sort((a, b) =>
      a.localeCompare(b),
    ),
  }),
};

const itemOf = (question: Question, labels: TrueFalseLabels): FormsQuizItem =>
  (items[question.type] as (q: Question, l: TrueFalseLabels) => FormsQuizItem)(question, labels);

/** What a quiz is made from: an assignment's title, instructions and questions. */
export interface QuizSource {
  readonly title: string;
  readonly instructions: string | null;
  readonly questions: readonly Question[];
}

/** The questions as a Forms quiz: objective ones keep their answer keys. */
export const toFormsQuiz = (source: QuizSource, labels: TrueFalseLabels): FormsQuiz => ({
  title: source.title,
  description: source.instructions ?? '',
  items: source.questions.map((question) => itemOf(question, labels)),
});

/** The latest Forms quiz made from an assignment, so its links stay at hand. */
export interface FormsExport {
  readonly schoolId: SchoolId;
  readonly assignmentId: AssignmentId;
  readonly formId: string;
  readonly editUrl: string;
  readonly responderUrl: string;
  readonly createdAt: Date;
}
