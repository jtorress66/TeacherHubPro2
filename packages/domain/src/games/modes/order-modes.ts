import { defineMode, listOf, scored } from '../game-mode.ts';
import { shuffle } from '../random.ts';

export interface SequenceView {
  readonly mode: 'sequence';
  readonly steps: readonly string[];
}

const maxReshuffles = 10;

/**
 * Put the steps in order. Shown steps never start in the right order; answers are the
 * shown indices in the student's order, scored per position.
 */
export const sequenceMode = defineMode({
  id: 'sequence',
  kind: 'steps',
  prepare(content, random) {
    const positions = content.items.map((_, index) => index);
    let shown = shuffle(positions, random);
    for (let tries = 0; tries < maxReshuffles && shown.every((p, i) => p === i); tries += 1) {
      shown = shuffle(positions, random);
    }
    const view: SequenceView = {
      mode: 'sequence',
      steps: shown.map((position) => content.items[position] ?? ''),
    };
    return { view, key: positions.map((position) => shown.indexOf(position)) };
  },
  solve: (key) => key,
  score(key, answers) {
    const order = listOf(answers);
    return scored(key.map((shownIndex, position) => order[position] === shownIndex));
  },
});

export interface DragDropView {
  readonly mode: 'drag_drop';
  readonly groups: readonly string[];
  readonly items: readonly string[];
}

/** Drag each item into its group; answers give the chosen group index per item. */
export const dragDropMode = defineMode({
  id: 'drag_drop',
  kind: 'groups',
  prepare(content, random) {
    const groups = shuffle(content.items, random);
    const items = shuffle(
      groups.flatMap((group, groupIndex) =>
        group.members.map((member) => ({ member, groupIndex })),
      ),
      random,
    );
    const view: DragDropView = {
      mode: 'drag_drop',
      groups: groups.map((group) => group.name),
      items: items.map((item) => item.member),
    };
    return { view, key: items.map((item) => item.groupIndex) };
  },
  solve: (key) => key,
  score(key, answers) {
    const chosen = listOf(answers);
    return scored(key.map((group, index) => chosen[index] === group));
  },
});
