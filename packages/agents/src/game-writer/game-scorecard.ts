import { defaultGameModes, type GameContent, type GameRequest } from '@thp/domain';
import { languageEvidence } from '../drafting/language.ts';

export const gameMetrics = ['structure', 'count', 'language', 'playable'] as const;
export type GameMetric = (typeof gameMetrics)[number];
export type GameScores = Readonly<Record<GameMetric, number>>;

const itemText = (item: GameContent['items'][number]): string =>
  typeof item === 'string' ? item : Object.values(item).flat().join(' ');

/**
 * Scores one eval case: usable content with the count asked for, in the requested language,
 * that every mode for its kind can play (word search and crossword have their own rules). Items
 * of single names and numbers show no language, so only text that shows one can fail it.
 */
export function scoreGame(request: GameRequest, content: GameContent | null): GameScores {
  if (content === null) return { structure: 0, count: 0, language: 0, playable: 0 };
  const modes = defaultGameModes.modesFor(content.kind);
  const playable = modes.filter((mode) => mode.unsuitable(content) === null).length;
  const evidence = languageEvidence(content.items.map(itemText).join('\n'));
  return {
    structure: 1,
    count: content.items.length === request.count ? 1 : 0,
    language: evidence.hits === 0 || evidence.language === request.language ? 1 : 0,
    playable: modes.length === 0 ? 1 : playable / modes.length,
  };
}
