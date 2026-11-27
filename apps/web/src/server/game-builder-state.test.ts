import { describe, expect, it } from 'vitest';
import { maxGameItems, maxOptions, type QuestionItem } from '@thp/domain';
import {
  addItem,
  addMember,
  addOption,
  builderContent,
  builderItemsOf,
  emptyItem,
  itemsAsText,
  moveItem,
  removeItem,
  removeMember,
  removeOption,
  replaceItem,
  addStandardsToAll,
  keepExtras,
  standardsText,
  textAsStandards,
  setPicture,
  textAsItems,
  withStartingCard,
} from './game-builder-state.ts';

const q = (prompt: string, answer = 0): QuestionItem => ({
  prompt,
  options: ['A', 'B', 'C'],
  answer,
});

describe('the question builder', () => {
  it('starts a new game with one empty card of its kind', () => {
    const items = withStartingCard(builderItemsOf(null), 'questions');

    expect(items.questions).toEqual([{ prompt: '', options: ['', ''], answer: 0 }]);
    expect(withStartingCard(items, 'questions')).toBe(items);
  });

  it('keeps each kind’s cards apart, so switching mode and back loses nothing', () => {
    const items = builderItemsOf({ kind: 'questions', items: [q('One')] });

    expect(items.questions).toHaveLength(1);
    expect(items.pairs).toEqual([]);
  });

  it('adds, removes, moves and replaces cards', () => {
    const cards = [q('One'), q('Two'), q('Three')];

    expect(addItem(cards, 'questions')).toHaveLength(4);
    expect(removeItem(cards, 1).map((c) => c.prompt)).toEqual(['One', 'Three']);
    expect(moveItem(cards, 0, 1).map((c) => c.prompt)).toEqual(['Two', 'One', 'Three']);
    expect(moveItem(cards, 0, -1)).toBe(cards);
    expect(moveItem(cards, 2, 1)).toBe(cards);
    expect(replaceItem(cards, 2, q('Tres'))[2]?.prompt).toBe('Tres');
  });

  it('stops adding cards at the most a game can have', () => {
    const full = Array.from({ length: maxGameItems }, (_, i) => q(String(i)));

    expect(addItem(full, 'questions')).toBe(full);
  });

  it('adds and removes answer choices, keeping the right answer on the same choice', () => {
    expect(addOption(q('One')).options).toEqual(['A', 'B', 'C', '']);
    expect(removeOption(q('One', 2), 0)).toEqual({ prompt: 'One', options: ['B', 'C'], answer: 1 });
    expect(removeOption(q('One', 1), 1).answer).toBe(0);
    const most = { prompt: 'P', options: Array.from({ length: maxOptions }, String), answer: 0 };
    expect(addOption(most)).toBe(most);
    const fewest = { prompt: 'P', options: ['A', 'B'], answer: 1 };
    expect(removeOption(fewest, 0)).toBe(fewest);
  });

  it('adds and removes group members, keeping at least two', () => {
    const group = { name: 'Mammals', members: ['Cat', 'Dog'] };

    expect(addMember(group).members).toEqual(['Cat', 'Dog', '']);
    expect(removeMember(group, 0)).toBe(group);
    expect(removeMember(addMember(group), 2).members).toEqual(['Cat', 'Dog']);
  });

  it('sends the filled cards only, so an empty card is not an error', () => {
    const content = builderContent('questions', [q('One'), emptyItem('questions'), q('Two')]);

    expect(content).toEqual({ kind: 'questions', items: [q('One'), q('Two')] });
    expect(
      builderContent('groups', [{ name: 'Birds', members: ['Owl', '', 'Hawk'] }]).items,
    ).toEqual([{ name: 'Birds', members: ['Owl', 'Hawk'] }]);
  });

  it('switches to text and back without losing the cards', () => {
    const cards = [q('Capital of Peru', 1), q('Capital of Chile')];
    const text = itemsAsText('questions', [...cards, emptyItem('questions')]);

    expect(text).toBe('Capital of Peru | A | *B | C\nCapital of Chile | *A | B | C');
    expect(textAsItems('questions', text)).toEqual(cards);
  });

  it('keeps each picture, standard and explanation on its question when the text is edited and read back', () => {
    const map = { id: 'pic-1', alt: 'A map of Peru' };
    const why = 'Lima is the seat of government.';
    const cards = [
      { ...q('Capital of Peru', 1), picture: map, standards: ['6.G.1'], explanation: why },
      q('Capital of Chile'),
    ];
    const edited = textAsItems('questions', 'Capital of Chile | *A | B\nCapital of Peru | A | *B');

    expect(keepExtras('questions', cards, edited)).toEqual([
      { prompt: 'Capital of Chile', options: ['A', 'B'], answer: 0 },
      {
        prompt: 'Capital of Peru',
        options: ['A', 'B'],
        answer: 1,
        picture: map,
        standards: ['6.G.1'],
        explanation: why,
      },
    ]);
    expect(keepExtras('steps', ['Mix'], ['Mix', 'Bake'])).toEqual(['Mix', 'Bake']);
  });
});

describe('pictures on cards', () => {
  const map = { id: 'pic-1', alt: 'A map' };

  it('puts a picture on a card and takes it off again', () => {
    const pictured = setPicture(q('Where?'), map);
    expect(pictured.picture).toEqual(map);
    expect(setPicture(pictured, undefined)).toEqual(q('Where?'));
  });

  it('sends a card that has only a picture, so the teacher is told what is missing', () => {
    const onlyPicture = { prompt: '', options: ['', ''], answer: 0, picture: map };
    expect(builderContent('questions', [onlyPicture]).items).toEqual([onlyPicture]);
  });
});

describe('standards on cards', () => {
  it('edits a card’s codes as typed, commas and spaces kept until it is sent', () => {
    const typed = textAsStandards('6.G.1, ');
    expect(standardsText(typed)).toBe('6.G.1, ');
    const sent = builderContent('questions', [{ ...q('Where?'), standards: typed }]);
    expect(sent.items[0]).toEqual({ ...q('Where?'), standards: ['6.G.1'] });
    expect(builderContent('questions', [{ ...q('Where?'), standards: [' '] }]).items[0]).toEqual(
      q('Where?'),
    );
  });

  it('adds codes to every card once, keeping what each card already has', () => {
    const cards = [{ ...q('One'), standards: ['A.1'] }, q('Two')];
    expect(addStandardsToAll(cards, ['A.1', ' B.2 ', ''])).toEqual([
      { ...q('One'), standards: ['A.1', 'B.2'] },
      { ...q('Two'), standards: ['A.1', 'B.2'] },
    ]);
    expect(addStandardsToAll(['Mix', 'Bake'], ['A.1'])).toEqual(['Mix', 'Bake']);
  });
});
