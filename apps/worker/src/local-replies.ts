import { contentSystemPrompt, slidesSystemPrompt } from '@thp/agents';
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

const repliesBySystem: ReadonlyMap<string, (request: LlmRequest) => string> = new Map([
  [contentSystemPrompt, contentReply],
  [slidesSystemPrompt, slidesReply],
]);

export function localReply(request: LlmRequest): string {
  return (repliesBySystem.get(request.system) ?? localPlannerReply)(request);
}
