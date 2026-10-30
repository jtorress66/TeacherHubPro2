import {
  activityTypes,
  type ActivityType,
  dokLevels,
  materialTypes,
  maxPlanTextLength,
  maxShortTextLength,
  maxSkills,
  standardsFor,
  type ConversationalDraft,
  type DraftRequest,
  type LessonPlanKind,
  type PlanDayInput,
  type Standard,
  type WeeklyDraft,
} from '@thp/domain';
import { allowed, objects, text, texts, type Json } from '../drafting/json-reply.ts';
import { requestLines } from './prompts.ts';

/** How one kind of plan is asked for and read back. A new kind adds an entry here. */
export interface PlanFormat {
  prompt(request: DraftRequest): string;
  /** The draft, or null when the reply does not have the required shape. */
  parse(reply: Json, request: DraftRequest): WeeklyDraft | ConversationalDraft | null;
}

const descriptionLength = 160;

/** The official codes the model may cite for this request. */
export const allowedStandards = (request: DraftRequest): readonly Standard[] =>
  request.subject === null ? [] : standardsFor(request.subject, request.grade);

function standardsList(standards: readonly Standard[]): string {
  if (standards.length === 0) {
    return 'There are no Common Core codes for this subject and grade: return "standards": [].';
  }
  const lines = standards.map((s) => `${s.code}: ${s.description.slice(0, descriptionLength)}`);
  return `Common Core codes you may cite (choose 1 to 4 that fit the topic):\n${lines.join('\n')}`;
}

const short = `string (at most ${String(maxShortTextLength)} characters)`;
const long = `string (at most ${String(maxPlanTextLength)} characters)`;

const weeklyShape = `{
  "unit": ${short},
  "objective": ${long},
  "skills": [${short}] (at most ${String(maxSkills)}),
  "standards": [code],
  "expectations": ${long},
  "days": [5 objects, Monday to Friday: {
    "theme": ${short},
    "dok": [numbers from 1 to 4],
    "activities": [{ "type": one of ${activityTypes.join(', ')}, "notes": ${long} }] (each type at most once),
    "materials": [any of ${materialTypes.join(', ')}],
    "notes": ${long}: the day's plan (activities with minutes, materials, success criteria)
  }]
}`;

const progression = `Follow this progression across the week:
Monday: introduction (hook, prior knowledge, key vocabulary).
Tuesday: guided practice (teacher modelling, checks for understanding).
Wednesday: independent practice (stations, partners, small groups).
Thursday: mastery and extension (higher-order thinking, real-world application).
Friday: assessment and reflection (formative assessment, self-reflection, closure).`;

/** A day ticks each activity type once, so repeats of a type become one with all their notes. */
function mergedActivities(value: unknown): { type: ActivityType; notes: string | null }[] {
  const notes = new Map<ActivityType, string[]>();
  for (const activity of objects(value)) {
    const [type] = allowed([activity.type], activityTypes);
    if (type === undefined) continue;
    const note = text(activity.notes);
    notes.set(type, [...(notes.get(type) ?? []), ...(note === null ? [] : [note])]);
  }
  return [...notes].map(([type, list]) => ({
    type,
    notes: list.length === 0 ? null : list.join('\n\n'),
  }));
}

function weeklyDay(day: Json): PlanDayInput {
  return {
    theme: text(day.theme),
    dok: allowed(day.dok, dokLevels),
    activities: mergedActivities(day.activities),
    materials: allowed(day.materials, materialTypes),
    notes: text(day.notes),
  };
}

const weekly: PlanFormat = {
  prompt: (request) =>
    [
      'Draft a five-day weekly lesson plan.',
      ...requestLines(request),
      progression,
      standardsList(allowedStandards(request)),
      `Reply with JSON in this shape:\n${weeklyShape}`,
    ].join('\n\n'),

  parse: (reply, request) => {
    const objective = text(reply.objective);
    const days = objects(reply.days);
    if (objective === null || days.length !== 5) return null;
    const codes = new Set(allowedStandards(request).map((s) => s.code));
    return {
      kind: 'weekly',
      unit: text(reply.unit),
      objective,
      skills: texts(reply.skills).slice(0, maxSkills),
      standards: [...new Set(texts(reply.standards))].filter((code) => codes.has(code)),
      expectations: text(reply.expectations),
      days: days.map(weeklyDay),
    };
  },
};

const conversationalShape = `{
  "title": ${short},
  "topic": ${short},
  "learningObjectives": ${long},
  "materials": ${long},
  "hook": ${long}: warm-up / introduction,
  "learningGoal": ${long}: a student-friendly "I can" statement,
  "closure": ${long},
  "notes": ${long}: the lesson's activities with minutes, useful phrases and practice dialogues
}`;

const conversational: PlanFormat = {
  prompt: (request) =>
    [
      'Draft a Conversational English lesson plan for students learning English.',
      'Write the plan in the teacher’s language, but keep the English phrases and dialogues students practise in English.',
      ...requestLines(request),
      `Reply with JSON in this shape:\n${conversationalShape}`,
    ].join('\n\n'),

  parse: (reply) => {
    const title = text(reply.title);
    if (title === null) return null;
    return {
      kind: 'conversational_english',
      title,
      topic: text(reply.topic),
      learningObjectives: text(reply.learningObjectives),
      materials: text(reply.materials),
      hook: text(reply.hook),
      learningGoal: text(reply.learningGoal),
      closure: text(reply.closure),
      notes: text(reply.notes),
    };
  },
};

export const planFormats: Readonly<Record<LessonPlanKind, PlanFormat>> = {
  weekly,
  conversational_english: conversational,
};
