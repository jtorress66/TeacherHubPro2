import {
  contentSystemPrompt,
  extractorSystemPrompt,
  gameFormats,
  gameWriterSystemPrompt,
  graderSystemPrompt,
  slidesSystemPrompt,
} from '@thp/agents';
import type { ContentKind } from '@thp/domain';
import type { LlmRequest } from '@thp/ports';
import { localPlannerReply } from './local-planner-reply.ts';

// Scripted replies for the local stand-in model, one per agent (told apart by its system prompt),
// so local runs and E2E tests work without calling Claude.

const promptOf = (request: LlmRequest) => request.messages[0]?.content ?? '';

function contentReply(request: LlmRequest): string {
  const prompt = promptOf(request);
  const count = Number(/exactly (\d+) questions/.exec(prompt)?.[1] ?? 0);
  const questions = Array.from({ length: count }, (_, i) => `${String(i + 1)}. Question ___?`);
  return [
    '# Local draft',
    '',
    'Name: ___ Date: ___',
    '',
    '## Practice',
    '',
    '| Problem | Answer |',
    '|---|---|',
    '| 1/2 = 2/4 | ___ |',
    '',
    ...(count > 0 ? ['## Questions', '', ...questions, ''] : []),
    '## Answer key',
    '',
    '1. True',
  ].join('\n');
}

function slidesReply(request: LlmRequest): string {
  const count = Number(/exactly (\d+) slides/.exec(promptOf(request))?.[1] ?? 3);
  const slides = Array.from({ length: count }, (_, i) =>
    i === 0
      ? { layout: 'title', title: 'Local slides', subtitle: 'A local draft', emoji: '🌋' }
      : {
          layout: 'content',
          title: `Slide ${String(i + 1)}`,
          content: 'A short explanation.',
          bullets: ['First point', 'Second point'],
          emoji: '💡',
        },
  );
  return JSON.stringify({ title: 'Local slides', slides });
}

/** A short test, whatever the PDF says: enough for an objective score and an open answer. */
function extractorReply(): string {
  return JSON.stringify({
    instructions: 'Answer every question.',
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Which planet is closest to the Sun?',
        options: ['Mercury', 'Venus', 'Mars'],
        correctOption: 0,
        points: 4,
        instructions: 'A. Choose the best answer.',
      },
      { type: 'true_false', prompt: 'The Sun is a star.', answer: true, points: 2 },
      {
        type: 'short_answer',
        prompt: 'Why do we have day and night?',
        modelAnswer: 'Because the Earth spins.',
        points: 4,
      },
    ],
  });
}

/** Half the points for every open answer the grader is asked about. */
function graderReply(request: LlmRequest): string {
  const json = /Answers \(JSON\):\n(\[[\s\S]*?\n\])/.exec(promptOf(request))?.[1] ?? '[]';
  const questions = JSON.parse(json) as { id: string; points: number }[];
  return JSON.stringify({
    scores: Object.fromEntries(
      questions.map((q) => [q.id, { score: q.points / 2, feedback: 'A good start.' }]),
    ),
    feedback: 'Keep going.',
  });
}

const spaceWords = [
  'Sun',
  'Moon',
  'Star',
  'Comet',
  'Orbit',
  'Planet',
  'Galaxy',
  'Meteor',
  'Nebula',
  'Rocket',
  'Saturn',
  'Mars',
  'Venus',
  'Earth',
  'Jupiter',
  'Pluto',
  'Crater',
  'Eclipse',
  'Gravity',
  'Neptune',
];

const nth = (i: number): string => String(i + 1);

/** Simple, valid items of each kind, numbered so they are all different. */
const localGameItems: Readonly<Record<ContentKind, (count: number) => unknown[]>> = {
  questions: (count) =>
    Array.from({ length: count }, (_, i) => ({
      prompt: `Question ${nth(i)}: which one is a planet?`,
      options: ['Mars', 'Banana', 'Chair'],
      correct: 'Mars',
    })),
  statements: (count) =>
    Array.from({ length: count }, (_, i) => ({
      statement: `Statement ${nth(i)}: ${i % 2 === 0 ? 'the Sun is a star' : 'the Moon is a star'}`,
      isTrue: i % 2 === 0,
    })),
  sentences: (count) =>
    Array.from({ length: count }, (_, i) => ({
      text: `Fact ${nth(i)}: the ___ is a star.`,
      answer: 'Sun',
    })),
  pairs: (count) =>
    spaceWords.slice(0, count).map((term, i) => ({
      term,
      definition: `Space word number ${nth(i)}`,
    })),
  steps: (count) => Array.from({ length: count }, (_, i) => `Step ${nth(i)} of the process`),
  groups: (count) =>
    Array.from({ length: count }, (_, i) => ({
      name: `Group ${nth(i)}`,
      members: ['a', 'b', 'c'].map((letter) => `Member ${nth(i)}${letter}`),
    })),
};

/** As many items as asked for, of the kind the prompt asks for. */
function gameReply(request: LlmRequest): string {
  const prompt = promptOf(request);
  const count = Number(/^Write (\d+) /.exec(prompt)?.[1] ?? 4);
  const kind =
    (Object.keys(gameFormats) as ContentKind[]).find((k) => prompt.includes(gameFormats[k].ask)) ??
    'pairs';
  return JSON.stringify({ items: localGameItems[kind](count) });
}

const repliesBySystem: ReadonlyMap<string, (request: LlmRequest) => string> = new Map([
  [contentSystemPrompt, contentReply],
  [slidesSystemPrompt, slidesReply],
  [extractorSystemPrompt, extractorReply],
  [graderSystemPrompt, graderReply],
  [gameWriterSystemPrompt, gameReply],
]);

export function localReply(request: LlmRequest): string {
  return (repliesBySystem.get(request.system) ?? localPlannerReply)(request);
}
