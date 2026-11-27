import { blank } from '../content.ts';
import type { GamePicture } from '../game-picture.ts';
import {
  defineMode,
  explanationsOf,
  listOf,
  sameAnswer,
  scored,
  typedAt,
} from '../game-mode.ts';
import { shuffle } from '../random.ts';

export interface ShownSentence {
  readonly before: string;
  readonly after: string;
  readonly picture?: GamePicture;
}

export interface FillBlanksView {
  readonly mode: 'fill_blanks';
  readonly sentences: readonly ShownSentence[];
  /** Every answer, shuffled, to choose from. */
  readonly wordBank: readonly string[];
}

/** Answers are the typed (or picked) word per sentence, matched leniently. */
export const fillBlanksMode = defineMode({
  id: 'fill_blanks',
  kind: 'sentences',
  prepare(content, random) {
    const items = shuffle(content.items, random);
    const view: FillBlanksView = {
      mode: 'fill_blanks',
      sentences: items.map((item) => {
        const [before = '', after = ''] = item.text.split(blank);
        return item.picture === undefined
          ? { before, after }
          : { before, after, picture: item.picture };
      }),
      wordBank: shuffle(
        items.map((item) => item.answer),
        random,
      ),
    };
    return { view, key: items.map((item) => item.answer), explanations: explanationsOf(items) };
  },
  solve: (key) => key,
  score(key, answers) {
    const typed = listOf(answers);
    return scored(key.map((answer, index) => sameAnswer(typed[index], answer)));
  },
  review({ view, key, explanations }, answers) {
    return view.sentences.map((sentence, index) => ({
      prompt: `${sentence.before}${blank}${sentence.after}`,
      given: typedAt(answers, index),
      right: { text: key[index] ?? '' },
      explanation: explanations?.[index] ?? null,
    }));
  },
});
