import { compareDates, parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, type ValidationError } from '../shared/validation.ts';
import { longText, optionalDate, shiftDate } from './plan-fields.ts';

/** A Conversational English lesson: one lesson (or a short run of days) with its own sections. */
export interface ConversationalBody {
  readonly kind: 'conversational_english';
  readonly subject: string | null;
  readonly lessonDate: LocalDate;
  readonly lessonDateEnd: LocalDate | null;
  readonly topic: string | null;
  readonly learningObjectives: string | null;
  readonly materials: string | null;
  readonly hook: string | null;
  readonly learningGoal: string | null;
  readonly closure: string | null;
  readonly testQuizDate: LocalDate | null;
  readonly notes: string | null;
}

export interface ConversationalBodyInput {
  readonly kind: 'conversational_english';
  readonly subject?: string | null;
  readonly lessonDate: string;
  readonly lessonDateEnd?: string | null;
  readonly topic?: string | null;
  readonly learningObjectives?: string | null;
  readonly materials?: string | null;
  readonly hook?: string | null;
  readonly learningGoal?: string | null;
  readonly closure?: string | null;
  readonly testQuizDate?: string | null;
  readonly notes?: string | null;
}

const longFields = [
  'learningObjectives',
  'materials',
  'hook',
  'learningGoal',
  'closure',
  'notes',
] as const;

export function conversationalBody(
  input: ConversationalBodyInput,
): Result<ConversationalBody, ValidationError> {
  const subject = optionalText('subject', input.subject);
  if (!subject.ok) return subject;
  const topic = optionalText('topic', input.topic);
  if (!topic.ok) return topic;
  const lessonDate = parseLocalDate('lessonDate', input.lessonDate);
  if (!lessonDate.ok) return lessonDate;
  const lessonDateEnd = optionalDate('lessonDateEnd', input.lessonDateEnd);
  if (!lessonDateEnd.ok) return lessonDateEnd;
  if (lessonDateEnd.value !== null && compareDates(lessonDateEnd.value, lessonDate.value) < 0) {
    return invalid('lessonDateEnd', 'invalid_order');
  }
  const testQuizDate = optionalDate('testQuizDate', input.testQuizDate);
  if (!testQuizDate.ok) return testQuizDate;

  const texts: Partial<Record<(typeof longFields)[number], string | null>> = {};
  for (const field of longFields) {
    const text = longText(field, input[field]);
    if (!text.ok) return text;
    texts[field] = text.value;
  }
  return ok({
    kind: 'conversational_english',
    subject: subject.value,
    lessonDate: lessonDate.value,
    lessonDateEnd: lessonDateEnd.value,
    topic: topic.value,
    learningObjectives: texts.learningObjectives ?? null,
    materials: texts.materials ?? null,
    hook: texts.hook ?? null,
    learningGoal: texts.learningGoal ?? null,
    closure: texts.closure ?? null,
    testQuizDate: testQuizDate.value,
    notes: texts.notes ?? null,
  });
}

export const shiftConversational = (
  body: ConversationalBody,
  days: number,
): ConversationalBody => ({
  ...body,
  lessonDate: shiftDate(body.lessonDate, days),
  lessonDateEnd: shiftDate(body.lessonDateEnd, days),
  testQuizDate: shiftDate(body.testQuizDate, days),
});
