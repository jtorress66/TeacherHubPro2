import type { ContentKind, GameContent, QuestionItem } from './content.ts';
import { shuffle, type Random } from './random.ts';

type Conversion = (content: GameContent, random: Random) => GameContent | null;

const wrongOptions = 3;

/** Term → definition, with other definitions as the wrong options (for "all modes" games). */
const pairsToQuestions: Conversion = (content, random) => {
  if (content.kind !== 'pairs') return null;
  const definitions = content.items.map((pair) => pair.definition);
  const items: QuestionItem[] = content.items.map((pair) => {
    const others = shuffle(
      definitions.filter((definition) => definition !== pair.definition),
      random,
    ).slice(0, wrongOptions);
    const options = shuffle([pair.definition, ...others], random);
    return { prompt: pair.term, options, answer: options.indexOf(pair.definition) };
  });
  return { kind: 'questions', items };
};

/** Conversions by "from>to", so a new one is a new entry. */
const conversions: Readonly<Record<string, Conversion>> = {
  'pairs>questions': pairsToQuestions,
};

export const converts = (from: ContentKind, to: ContentKind): boolean =>
  `${from}>${to}` in conversions;

export function convertContent(
  content: GameContent,
  to: ContentKind,
  random: Random,
): GameContent | null {
  const conversion = conversions[`${content.kind}>${to}`];
  return conversion === undefined ? null : conversion(content, random);
}
