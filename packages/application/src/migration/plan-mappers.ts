import {
  activityTypes,
  addDays,
  createLessonPlan,
  createPlanFolder,
  dokLevels,
  findStandardLoosely,
  maxSkills,
  materialTypes,
  normalizeName,
  parseLocalDate,
  templateFromPlan,
  type FolderColor,
  type LessonPlanId,
  type LocalDate,
  type MigrationTally,
  type PlanBodyInput,
  type PlanDayInput,
  type PlanFolderId,
  type PlanTemplateId,
  type PlanWeekInput,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { day, flag, list, record, records, strings, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper } from './migration-set.ts';

/** The old app's colour picker values, as the new app's named colours. */
const folderColours: Readonly<Record<string, FolderColor>> = {
  '#6366f1': 'indigo',
  '#10b981': 'emerald',
  '#f59e0b': 'amber',
  '#f43f5e': 'rose',
  '#ef4444': 'rose',
  '#ec4899': 'rose',
  '#0ea5e9': 'sky',
  '#3b82f6': 'sky',
  '#8b5cf6': 'violet',
  '#a855f7': 'violet',
  '#64748b': 'slate',
};

export const planFoldersMapper: LegacyMapper = {
  collection: 'plan_folders',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'folder_id');
      const teacher = set.user(text(doc, 'teacher_id'));
      if (id === null || teacher === null) {
        tally.skipped('plan_folders', id === null ? 'missing_id' : 'teacher_not_found');
        continue;
      }
      const colour = folderColours[text(doc, 'color')?.toLowerCase() ?? '#6366f1'];
      if (colour === undefined) tally.noted('plan_folders', 'colour_changed');
      const folder = createPlanFolder({
        id: id as PlanFolderId,
        schoolId: teacher.schoolId,
        teacherId: teacher.id,
        name: text(doc, 'name') ?? '',
        color: colour ?? 'indigo',
      });
      if (!folder.ok) {
        tally.skipped('plan_folders', invalidReason(folder.error));
        continue;
      }
      set.folders.set(id, folder.value);
      tally.imported('plan_folders');
    }
  },
};

/** Old activity names that changed. */
const activityNames: Readonly<Record<string, string>> = {
  comprehension: 'comprehension_questions',
  exercise: 'exercise_practice',
};

/** Subject names in English or Spanish, as the new app's keys. */
const integrations: Readonly<Record<string, string>> = {
  mathematics: 'mathematics',
  math: 'mathematics',
  matematicas: 'mathematics',
  spanish: 'spanish',
  espanol: 'spanish',
  english: 'english',
  ingles: 'english',
  'social studies': 'social_studies',
  'estudios sociales': 'social_studies',
  science: 'science',
  ciencias: 'science',
  health: 'health',
  salud: 'health',
  art: 'art',
  arte: 'art',
  'bellas artes': 'art',
  'physical education': 'physical_education',
  'educacion fisica': 'physical_education',
  religion: 'religion',
};

const pick = <T>(values: readonly T[], allowed: readonly T[]) => ({
  kept: values.filter((value) => allowed.includes(value)),
  dropped: values.filter((value) => !allowed.includes(value)).length,
});

/** Turns old plan details into new ones, noting what had to change. */
class PlanReader {
  constructor(private readonly tally: MigrationTally) {}

  note(note: string, count = 1): void {
    for (let i = 0; i < count; i += 1) this.tally.noted('lesson_plans', note);
  }

  /** Only the boxes the teacher ticked; unknown names are kept as "other". */
  private ticked(items: readonly LegacyDocument[], key: string, allowed: readonly string[]) {
    const result: { type: string; notes: string | null }[] = [];
    for (const item of items.filter((i) => flag(i, 'checked'))) {
      const name = text(item, key) ?? 'other';
      let type = activityNames[name] ?? name;
      if (!allowed.includes(type)) {
        this.note(`unknown_${key === 'activity_type' ? 'activity' : 'material'}_kept_as_other`);
        type = 'other';
      }
      const existing = result.find((r) => r.type === type);
      const notes = text(item, 'notes');
      if (existing === undefined) result.push({ type, notes });
      else if (notes !== null) existing.notes = [existing.notes, notes].filter(Boolean).join('\n');
    }
    return result;
  }

  day(doc: LegacyDocument): PlanDayInput {
    const dok = pick(
      list(doc, 'dok_levels').filter((v): v is number => typeof v === 'number'),
      dokLevels as readonly number[],
    );
    if (dok.dropped > 0) this.note('dok_level_dropped', dok.dropped);
    const eca = record(doc, 'eca');
    return {
      theme: text(doc, 'theme'),
      dok: dok.kept,
      eca:
        eca === null
          ? []
          : (['E', 'C', 'A'] as const).flatMap((mark) =>
              flag(eca, mark) ? [{ E: 'enrichment', C: 'core', A: 'assessment' }[mark]] : [],
            ),
      activities: this.ticked(records(doc, 'activities'), 'activity_type', activityTypes),
      materials: this.ticked(records(doc, 'materials'), 'material_type', materialTypes).map(
        (m) => m.type,
      ),
      notes: text(doc, 'notes'),
    };
  }

  skills(values: readonly string[]): readonly string[] {
    if (values.length > maxSkills) this.note('skills_over_limit');
    return values.slice(0, maxSkills);
  }

  standards(doc: LegacyDocument, week: number): readonly string[] {
    const codes = records(doc, 'standards')
      .filter((s) => (s.week_index ?? 1) === week)
      .flatMap((s) => strings(s, 'codes'));
    const known = codes
      .map((code) => findStandardLoosely(code)?.code)
      .filter((code) => code !== undefined);
    if (known.length < codes.length)
      this.note('unknown_standard_dropped', codes.length - known.length);
    return [...new Set(known)];
  }

  integration(values: readonly string[]): readonly string[] {
    const keys = values.map((value) => integrations[normalizeName(value)]);
    const known = keys.filter((key): key is string => key !== undefined);
    if (known.length < keys.length)
      this.note('subject_integration_dropped', keys.length - known.length);
    return [...new Set(known)];
  }
}

/** The Monday of the week a date falls in (old plans sometimes started on another day). */
function monday(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date as LocalDate, weekday === 0 ? -6 : 1 - weekday);
}

function weeklyBody(doc: LegacyDocument, reader: PlanReader): PlanBodyInput | null {
  const start = day(doc, 'week_start');
  if (start === null || !parseLocalDate('weekStart', start).ok) return null;
  const firstMonday = monday(start);
  const secondStart = day(doc, 'week2_start');
  const starts = [firstMonday, ...(secondStart === null ? [] : [monday(secondStart)])];
  if (starts.some((s, i) => s !== [start, secondStart][i])) reader.note('week_moved_to_monday');
  const oldDays = records(doc, 'days');
  const weeks = starts.map((weekStart, index): PlanWeekInput => {
    const days = [0, 1, 2, 3, 4].map((offset) => {
      const date = addDays(weekStart as LocalDate, offset);
      const old = oldDays.find((d) => day(d, 'date') === date);
      return old === undefined ? {} : reader.day(old);
    });
    const expectations = records(doc, 'expectations')
      .filter((e) => (e.week_index ?? 1) === index + 1)
      .map((e) => text(e, 'text'))
      .filter((t) => t !== null);
    return {
      weekStart,
      objective: text(doc, index === 0 ? 'objective' : 'objective_week2'),
      skills: reader.skills(strings(doc, index === 0 ? 'skills' : 'skills_week2')),
      standards: reader.standards(doc, index + 1),
      expectations: expectations.length > 0 ? expectations.join('\n') : null,
      days,
    };
  });
  const placed = weeks.length * 5;
  const outside = oldDays.filter((d) => {
    const date = day(d, 'date');
    return (
      date === null ||
      !starts.some((s) => [0, 1, 2, 3, 4].some((o) => addDays(s as LocalDate, o) === date))
    );
  }).length;
  if (outside > 0 && placed > 0) reader.note('day_outside_week_dropped', outside);
  return {
    kind: 'weekly',
    unit: text(doc, 'unit'),
    story: text(doc, 'story'),
    teacherName: text(doc, 'teacher_name'),
    subjectIntegration: reader.integration(strings(doc, 'subject_integration')),
    weeks,
  };
}

function conversationalBody(doc: LegacyDocument): PlanBodyInput {
  return {
    kind: 'conversational_english',
    subject: text(doc, 'subject'),
    lessonDate: day(doc, 'lesson_date') ?? day(doc, 'week_start') ?? '',
    lessonDateEnd: day(doc, 'lesson_date_end'),
    topic: text(doc, 'lesson_topic'),
    learningObjectives: text(doc, 'learning_objectives'),
    materials: text(doc, 'materials_text'),
    hook: text(doc, 'hook_intro'),
    learningGoal: text(doc, 'learning_goal'),
    closure: text(doc, 'closure'),
    testQuizDate: day(doc, 'test_quiz_date'),
    notes: text(doc, 'additional_notes'),
  };
}

/** Weekly and Conversational English plans; a plan saved as a template becomes a template. */
export const lessonPlansMapper: LegacyMapper = {
  collection: 'lesson_plans',
  map(docs, { set, tally }) {
    const reader = new PlanReader(tally);
    for (const doc of docs) {
      const id = text(doc, 'plan_id');
      const teacher = set.user(text(doc, 'teacher_id'));
      if (id === null || teacher === null) {
        tally.skipped('lesson_plans', id === null ? 'missing_id' : 'teacher_not_found');
        continue;
      }
      const conversational = text(doc, 'plan_type') === 'conversational_english';
      const body = conversational ? conversationalBody(doc) : weeklyBody(doc, reader);
      if (body === null) {
        tally.skipped('lesson_plans', 'invalid_week_start');
        continue;
      }
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      const folder = set.folders.get(text(doc, 'folder_id') ?? '');
      const plan = createLessonPlan({
        id: id as LessonPlanId,
        schoolId: teacher.schoolId,
        teacherId: teacher.id,
        title: conversational
          ? (text(doc, 'title') ?? text(doc, 'lesson_topic') ?? 'Conversational English')
          : text(doc, 'title'),
        classId: cls?.id ?? null,
        folderId: folder?.id ?? null,
        body,
      });
      if (!plan.ok) {
        tally.skipped('lesson_plans', invalidReason(plan.error));
        continue;
      }
      if (flag(doc, 'is_template')) {
        const name = text(doc, 'template_name') ?? text(doc, 'unit') ?? 'Template';
        const template = templateFromPlan(plan.value, id as PlanTemplateId, name.slice(0, 100));
        if (!template.ok) {
          tally.skipped('lesson_plans', invalidReason(template.error));
          continue;
        }
        set.templates.push(template.value);
      } else {
        set.plans.push(plan.value);
      }
      tally.imported('lesson_plans');
    }
  },
};
