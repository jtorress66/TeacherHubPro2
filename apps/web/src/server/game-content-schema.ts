import { z } from 'zod';
import {
  maxGameItems,
  maxItemTextLength,
  maxOptions,
  type ContentKind,
  type GameContent,
} from '@thp/domain';

// The question builder sends a game's items as JSON. Only the shape is checked here (Zod at the
// edge); the domain checks the rules (lengths, repeats, the right answer) when the game is saved.

const text = z.string().max(maxItemTextLength * 2);
const list = <T extends z.ZodType>(item: T) => z.array(item).max(maxGameItems * 2);

const itemSchemas = {
  questions: z.object({
    prompt: text,
    options: z.array(text).max(maxOptions * 2),
    answer: z.number().int(),
  }),
  statements: z.object({ statement: text, isTrue: z.boolean() }),
  sentences: z.object({ text, answer: text }),
  pairs: z.object({ term: text, definition: text }),
  steps: text,
  groups: z.object({ name: text, members: z.array(text).max(maxGameItems * 2) }),
} as const satisfies Record<ContentKind, z.ZodType>;

/** The builder's items for a kind, or null when the JSON is not that shape. */
export function parseContentJson(kind: ContentKind, json: string): GameContent | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  const items = list(itemSchemas[kind]).safeParse(value);
  return items.success ? ({ kind, items: items.data } as GameContent) : null;
}
