import type { ContentOf } from '../content.ts';
import { defineMode, listOf, scored, type PreparedRound } from '../game-mode.ts';
import { shuffle, type Random } from '../random.ts';

export interface ShownQuestion {
  readonly prompt: string;
  readonly options: readonly string[];
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
  const shown = shuffle(content.items, random).map((item) => {
    const order = shuffle(
      item.options.map((_, index) => index),
      random,
    );
    return {
      question: { prompt: item.prompt, options: order.map((index) => item.options[index] ?? '') },
      answer: order.indexOf(item.answer),
    };
  });
  return { view: shown.map((s) => s.question), key: shown.map((s) => s.answer) };
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
    return { view: { mode: 'quiz', questions: round.view } satisfies QuizView, key: round.key };
  },
  solve: (key) => key,
  score: scoreChoices,
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
    return { view, key: round.key };
  },
  solve: (key) => key,
  score: scoreChoices,
});
