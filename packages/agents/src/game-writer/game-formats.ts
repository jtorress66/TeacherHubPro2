import type { ContentKind, GameContent, GradeLevel } from '@thp/domain';
import { objects, text, texts, type Json } from '../drafting/json-reply.ts';

/** How the model is asked for one kind of game content, and how its items are read back. */
export interface GameFormat {
  readonly ask: string;
  readonly shape: string;
  /** Builds the content from the reply's items; unreadable fields become blanks the checks reject. */
  readonly read: (items: unknown) => GameContent;
}

const str = (value: unknown): string => text(value) ?? '';

const questions: GameFormat = {
  ask: 'multiple-choice questions, each with 3 or 4 short options and exactly one right answer',
  shape: `{ "items": [ { "prompt": string, "options": [string, ...], "correct": string (copied exactly from options) } ] }`,
  read: (items) => ({
    kind: 'questions',
    items: objects(items).map((item: Json) => {
      const options = texts(item.options);
      return { prompt: str(item.prompt), options, answer: options.indexOf(str(item.correct)) };
    }),
  }),
};

const statements: GameFormat = {
  ask: 'true-or-false statements, about half of them true, each clearly true or clearly false',
  shape: `{ "items": [ { "statement": string, "isTrue": boolean } ] }`,
  read: (items) => ({
    kind: 'statements',
    items: objects(items).map((item: Json) => ({
      statement: str(item.statement),
      isTrue: item.isTrue === true,
    })),
  }),
};

const sentences: GameFormat = {
  ask: 'sentences with one missing key word, written as ___ (three underscores), and the missing word',
  shape: `{ "items": [ { "text": string (with exactly one ___), "answer": string (one or two words) } ] }`,
  read: (items) => ({
    kind: 'sentences',
    items: objects(items).map((item: Json) => ({ text: str(item.text), answer: str(item.answer) })),
  }),
};

const pairs: GameFormat = {
  ask: 'key terms with a short definition each; every term is one or two words of at most 12 letters',
  shape: `{ "items": [ { "term": string, "definition": string (one short sentence) } ] }`,
  read: (items) => ({
    kind: 'pairs',
    items: objects(items).map((item: Json) => ({
      term: str(item.term),
      definition: str(item.definition),
    })),
  }),
};

const steps: GameFormat = {
  ask: 'steps of one process, in the right order, each a short sentence',
  shape: `{ "items": [ string, ... ] (first step first) }`,
  read: (items) => ({ kind: 'steps', items: Array.isArray(items) ? items.map(str) : [] }),
};

const groups: GameFormat = {
  ask: 'groups to sort into, each with a name and 3 to 5 members that belong only to that group',
  shape: `{ "items": [ { "name": string, "members": [string, ...] } ] }`,
  read: (items) => ({
    kind: 'groups',
    items: objects(items).map((item: Json) => ({
      name: str(item.name),
      members: texts(item.members),
    })),
  }),
};

export const gameFormats: Readonly<Record<ContentKind, GameFormat>> = {
  questions,
  statements,
  sentences,
  pairs,
  steps,
  groups,
};

const bands: readonly { readonly grades: readonly GradeLevel[]; readonly words: string }[] = [
  {
    grades: ['K', '1', '2'],
    words: 'very simple words and short sentences a young child can read',
  },
  { grades: ['3', '4', '5'], words: 'simple, clear words for an upper elementary student' },
  { grades: ['6', '7', '8'], words: 'clear language for a middle school student' },
  {
    grades: ['9', '10', '11', '12'],
    words: 'precise, subject-appropriate language for a high school student',
  },
];

/** How simply to write for the grade (from the original app's grade bands). */
export const wordingFor = (grade: GradeLevel): string =>
  bands.find((band) => band.grades.includes(grade))?.words ?? 'clear language';
