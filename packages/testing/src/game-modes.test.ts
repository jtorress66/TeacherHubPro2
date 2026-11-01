import { contentKinds, defaultGameModes } from '@thp/domain';
import { describe, expect, it } from 'vitest';
import { gameModeContract } from './contracts/game-mode.contract.ts';
import { sampleGameContent } from './game-content.ts';

for (const mode of defaultGameModes.all()) {
  for (const kind of contentKinds.filter((k) => mode.plays(k))) {
    gameModeContract(`${mode.id} (${kind})`, mode, sampleGameContent[kind]);
  }
}

describe('default game modes', () => {
  it('has the eleven modes, and every content kind has a mode', () => {
    expect(defaultGameModes.all().map((mode) => mode.id)).toEqual([
      'quiz',
      'time_attack',
      'true_false',
      'fill_blanks',
      'flashcards',
      'matching',
      'memory',
      'word_search',
      'crossword',
      'sequence',
      'drag_drop',
    ]);
    for (const kind of contentKinds) {
      expect(defaultGameModes.modesFor(kind).length).toBeGreaterThan(0);
    }
  });
});
