import type { ContentOf } from '../content.ts';
import type { GamePicture } from '../game-picture.ts';
import {
  defineMode,
  explanationsOf,
  listOf,
  scored,
  type PreparedRound,
  type ReviewItem,
} from '../game-mode.ts';
import { shuffle, type Random } from '../random.ts';

export interface ShownQuestion {
  readonly prompt: string;
  readonly options: readonly string[];
  readonly picture?: GamePicture;
}

export interface QuizView {
  readonly mode: 'quiz';
  readonly questions: readonly ShownQuestion[];
}

export interface TimeAttackView {
  readonly mode: 'time_attack';
  readonly questions: readonly ShownQuestion[];
  readonly seconds: number;
}

/** Answer as many as you can before the clock runs out. */
export const timeAttackSeconds = 60;

/** Shuffles the questions and each question's options; the key is each correct position. */
function questionRound(
  content: ContentOf<'questions'>,
  random: Random,
): PreparedRound<readonly ShownQuestion[], readonly number[]> {
  const items = shuffle(content.items, random);
  const shown = items.map((item) => {
    const order = shuffle(
      item.options.map((_, index) => index),
      random,
    );
    return {
      question: {
        prompt: item.prompt,
        options: order.map((index) => item.options[index] ?? ''),
        ...(item.picture === undefined ? {} : { picture: item.picture }),
      },
      answer: order.indexOf(item.answer),
    };
  });
  return {
    view: shown.map((s) => s.question),
    key: shown.map((s) => s.answer),
    explanations: explanationsOf(items),
  };
}

/** Each question with the chosen option (if any) and the right one. */
function reviewChoices<V extends { readonly questions: readonly ShownQuestion[] }>(
  round: PreparedRound<V, readonly number[]>,
  answers: unknown,
): ReviewItem[] {
  const chosen = listOf(answers);
  return round.view.questions.map((question, index) => {
    const pick = chosen[index];
    const given = typeof pick === 'number' ? question.options[pick] : undefined;
    return {
      prompt: question.prompt,
      given: given === undefined ? null : { text: given },
      right: { text: question.options[round.key[index] ?? -1] ?? '' },
      explanation: round.explanations?.[index] ?? null,
    };
  });
}

/** Answers are the chosen option index per question. */
const scoreChoices = (key: readonly number[], answers: unknown) => {
  const chosen = listOf(answers);
  return scored(key.map((answer, index) => chosen[index] === answer));
};

export const quizMode = defineMode({
  id: 'quiz',
  kind: 'questions',
  prepare(content, random) {
    const round = questionRound(content, random);
    const view: QuizView = { mode: 'quiz', questions: round.view };
    return { ...round, view };
  },
  solve: (key) => key,
  score: scoreChoices,
  review: reviewChoices,
});

/** A quiz against the clock: unanswered questions when time runs out score as wrong. */
export const timeAttackMode = defineMode({
  id: 'time_attack',
  kind: 'questions',
  prepare(content, random) {
    const round = questionRound(content, random);
    const view: TimeAttackView = {
      mode: 'time_attack',
      questions: round.view,
      seconds: timeAttackSeconds,
    };
    return { ...round, view };
  },
  solve: (key) => key,
  score: scoreChoices,
  review: reviewChoices,
});
