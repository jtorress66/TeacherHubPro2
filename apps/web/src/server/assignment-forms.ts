import { z } from 'zod';
import type { QuestionInput } from '@thp/domain';
import type { Locale } from '@thp/i18n';

// Form shapes for the question builder and the student answer form. Only the shape is read
// here: the domain checks the values.

const common = {
  id: z.string().min(1),
  prompt: z.string(),
  points: z.number().optional(),
  instructions: z.string().nullish(),
};

const questionShape = z.discriminatedUnion('type', [
  z.object({
    ...common,
    type: z.literal('multiple_choice'),
    options: z.array(z.string()),
    correctOption: z.number(),
  }),
  z.object({ ...common, type: z.literal('true_false'), answer: z.boolean() }),
  z.object({ ...common, type: z.literal('fill_blank'), acceptedAnswers: z.array(z.string()) }),
  z.object({ ...common, type: z.literal('short_answer'), modelAnswer: z.string().nullish() }),
  z.object({
    ...common,
    type: z.literal('matching'),
    pairs: z.array(z.object({ left: z.string(), right: z.string() })),
  }),
  z.object({ ...common, type: z.literal('essay'), rubric: z.string().nullish() }),
]);

/** Leaves out fields that were not sent (the types allow no explicit undefined). */
const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/** The builder sends its questions as JSON; anything else is null. */
export function parseQuestionsJson(json: string): QuestionInput[] | null {
  try {
    const parsed = z.array(questionShape).safeParse(JSON.parse(json));
    return parsed.success ? (parsed.data.map(defined) as QuestionInput[]) : null;
  } catch {
    return null;
  }
}

/**
 * A student's answers: `q.<id>` for one answer, and `m.<id>.<left item>` for each matching
 * dropdown, which become one JSON answer. Blank dropdowns are left out.
 */
export function parseAnswersForm(data: FormData): Record<string, string> {
  const answers: Record<string, string> = {};
  const matching: Record<string, Record<string, string>> = {};
  for (const [name, value] of data.entries()) {
    if (typeof value !== 'string') continue;
    if (name.startsWith('q.')) answers[name.slice(2)] = value;
    const match = /^m\.([^.]+)\.(.+)$/.exec(name);
    if (match?.[1] !== undefined && match[2] !== undefined && value !== '') {
      matching[match[1]] = { ...matching[match[1]], [match[2]]: value };
    }
  }
  for (const [id, pairs] of Object.entries(matching)) answers[id] = JSON.stringify(pairs);
  return answers;
}

/** The address a student opens. Only shown once, when the link is issued. */
export const studentLinkUrl = (appUrl: string, locale: Locale, token: string): string =>
  `${appUrl}/${locale}/s/${token}`;
