import type { GamePicture } from '../game-picture.ts';
import { defineMode, explanationsOf, listOf, scored } from '../game-mode.ts';
import { shuffle } from '../random.ts';

export interface TrueFalseView {
  readonly mode: 'true_false';
  readonly statements: readonly string[];
  /** Each statement's picture, at the same place; null where it has none. */
  readonly pictures: readonly (GamePicture | null)[];
}

/** Answers are true or false per statement. */
export const trueFalseMode = defineMode({
  id: 'true_false',
  kind: 'statements',
  prepare(content, random) {
    const items = shuffle(content.items, random);
    const view: TrueFalseView = {
      mode: 'true_false',
      statements: items.map((i) => i.statement),
      pictures: items.map((i) => i.picture ?? null),
    };
    return { view, key: items.map((item) => item.isTrue), explanations: explanationsOf(items) };
  },
  solve: (key) => key,
  score(key, answers) {
    const given = listOf(answers);
    return scored(key.map((truth, index) => given[index] === truth));
  },
  review({ view, key, explanations }, answers) {
    const given = listOf(answers);
    return view.statements.map((statement, index) => {
      const truth = given[index];
      return {
        prompt: statement,
        given: typeof truth === 'boolean' ? { truth } : null,
        right: { truth: key[index] === true },
        explanation: explanations?.[index] ?? null,
      };
    });
  },
});
