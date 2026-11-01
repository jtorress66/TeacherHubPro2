import { defineMode, listOf, scored } from '../game-mode.ts';
import { shuffle } from '../random.ts';

export interface TrueFalseView {
  readonly mode: 'true_false';
  readonly statements: readonly string[];
}

/** Answers are true or false per statement. */
export const trueFalseMode = defineMode({
  id: 'true_false',
  kind: 'statements',
  prepare(content, random) {
    const items = shuffle(content.items, random);
    const view: TrueFalseView = { mode: 'true_false', statements: items.map((i) => i.statement) };
    return { view, key: items.map((item) => item.isTrue) };
  },
  solve: (key) => key,
  score(key, answers) {
    const given = listOf(answers);
    return scored(key.map((truth, index) => given[index] === truth));
  },
});
