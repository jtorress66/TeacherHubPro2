import type { ClassId } from '../shared/ids.ts';
import { isLanguage, type Language } from '../shared/language.ts';
import { parseLocalDate, type LocalDate } from '../shared/local-date.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, optionalText, requiredText, type ValidationError } from '../shared/validation.ts';
import {
  isGradeLevel,
  standardSubjects,
  type GradeLevel,
  type StandardSubject,
} from '../standards/common-core.ts';
import type { LessonPlanKind, PlanBodyInput } from './lesson-plan.ts';
import { isMonday } from './plan-fields.ts';
import type { PlanDayInput } from './weekly-plan.ts';

export const draftDifficulties = ['easy', 'medium', 'hard'] as const;
export type DraftDifficulty = (typeof draftDifficulties)[number];
export const minDraftMinutes = 15;
export const maxDraftMinutes = 240;
export const maxInstructionsLength = 1000;

/** What a teacher asks the AI to draft. It holds no student data. */
export interface DraftRequest {
  readonly kind: LessonPlanKind;
  /** Needed for weekly plans (it picks the standards); Conversational English has none. */
  readonly subject: StandardSubject | null;
  readonly grade: GradeLevel;
  readonly topic: string;
  readonly difficulty: DraftDifficulty;
  readonly durationMinutes: number;
  readonly language: Language;
  readonly instructions: string | null;
  /** The week's Monday for a weekly plan; the lesson date for Conversational English. */
  readonly start: LocalDate;
  readonly classId: ClassId | null;
}

export interface DraftRequestInput {
  readonly kind: string;
  readonly subject?: string | null;
  readonly grade: string;
  readonly topic: string;
  readonly difficulty?: string;
  readonly durationMinutes?: number;
  readonly language: string;
  readonly instructions?: string | null;
  readonly start: string;
  readonly classId?: ClassId | null;
}

const kindNeeds: Readonly<Record<LessonPlanKind, { subject: boolean; monday: boolean }>> = {
  weekly: { subject: true, monday: true },
  conversational_english: { subject: false, monday: false },
};

const isKind = (value: string): value is LessonPlanKind => Object.hasOwn(kindNeeds, value);

export function createDraftRequest(
  input: DraftRequestInput,
): Result<DraftRequest, ValidationError> {
  if (!isKind(input.kind)) return invalid('kind', 'not_allowed');
  const needs = kindNeeds[input.kind];
  const subject = input.subject ?? null;
  if (subject !== null && !(standardSubjects as readonly string[]).includes(subject)) {
    return invalid('subject', 'not_allowed');
  }
  if (needs.subject && subject === null) return invalid('subject', 'required');
  if (!isGradeLevel(input.grade)) return invalid('grade', 'not_allowed');
  const topic = requiredText('topic', input.topic);
  if (!topic.ok) return topic;
  const difficulty = input.difficulty ?? 'medium';
  if (!(draftDifficulties as readonly string[]).includes(difficulty)) {
    return invalid('difficulty', 'not_allowed');
  }
  const minutes = input.durationMinutes ?? 45;
  if (!Number.isInteger(minutes) || minutes < minDraftMinutes || minutes > maxDraftMinutes) {
    return invalid('durationMinutes', 'out_of_range');
  }
  if (!isLanguage(input.language)) return invalid('language', 'not_allowed');
  const instructions = optionalText('instructions', input.instructions, maxInstructionsLength);
  if (!instructions.ok) return instructions;
  const start = parseLocalDate('start', input.start);
  if (!start.ok) return start;
  if (needs.monday && !isMonday(start.value)) return invalid('start', 'not_allowed');

  return ok({
    kind: input.kind,
    subject: needs.subject ? (subject as StandardSubject) : null,
    grade: input.grade,
    topic: topic.value,
    difficulty: difficulty as DraftDifficulty,
    durationMinutes: minutes,
    language: input.language,
    instructions: instructions.value,
    start: start.value,
    classId: input.classId ?? null,
  });
}

/** The parts of a weekly plan the AI may fill in. */
export interface WeeklyDraft {
  readonly kind: 'weekly';
  readonly unit: string | null;
  readonly objective: string;
  readonly skills: readonly string[];
  readonly standards: readonly string[];
  readonly expectations: string | null;
  readonly days: readonly PlanDayInput[];
}

/** The parts of a Conversational English plan the AI may fill in. */
export interface ConversationalDraft {
  readonly kind: 'conversational_english';
  readonly title: string;
  readonly topic: string | null;
  readonly learningObjectives: string | null;
  readonly materials: string | null;
  readonly hook: string | null;
  readonly learningGoal: string | null;
  readonly closure: string | null;
  readonly notes: string | null;
}

export type LessonPlanDraft = WeeklyDraft | ConversationalDraft;

export interface DraftedPlan {
  readonly title: string | null;
  readonly body: PlanBodyInput;
}

const fromDraft: {
  readonly [K in LessonPlanKind]: (
    draft: Extract<LessonPlanDraft, { kind: K }>,
    start: LocalDate,
  ) => DraftedPlan;
} = {
  weekly: (draft, start) => ({
    title: null,
    body: {
      kind: 'weekly',
      unit: draft.unit,
      weeks: [
        {
          weekStart: start,
          objective: draft.objective,
          skills: draft.skills,
          standards: draft.standards,
          expectations: draft.expectations,
          days: draft.days,
        },
      ],
    },
  }),
  conversational_english: ({ title, kind, ...sections }, start) => ({
    title,
    body: { kind, lessonDate: start, ...sections },
  }),
};

/** A new plan's content from an AI draft; the teacher edits and saves it. */
export const draftedPlan = (draft: LessonPlanDraft, start: LocalDate): DraftedPlan =>
  (fromDraft[draft.kind] as (d: LessonPlanDraft, s: LocalDate) => DraftedPlan)(draft, start);
