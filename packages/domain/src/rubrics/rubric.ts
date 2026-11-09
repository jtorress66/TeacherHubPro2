import { assistantSubjects, type AssistantSubject } from '../assistant/content-request.ts';
import type { RubricId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';
import { isGradeLevel, type GradeLevel } from '../standards/common-core.ts';

export const rubricCriteriaRange = { min: 1, max: 10, default: 4 } as const;
export const rubricLevelRange = { min: 2, max: 6, default: 4 } as const;
export const maxRubricTitleLength = 120;
const maxLabelLength = 60;
const maxCriterionNameLength = 120;
const maxDescriptorLength = 500;
const maxLevelPoints = 100;

/** A column of the grid, highest first: "Excellent (4)". */
export interface RubricLevel {
  readonly label: string;
  readonly points: number;
}

/** A row of the grid: what is assessed, and what each level looks like (one per level). */
export interface RubricCriterion {
  readonly name: string;
  readonly descriptors: readonly string[];
}

/** A teacher's private scoring guide. It holds no student data. */
export interface Rubric {
  readonly id: RubricId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly title: string;
  readonly subject: AssistantSubject | null;
  readonly grade: GradeLevel | null;
  readonly levels: readonly RubricLevel[];
  readonly criteria: readonly RubricCriterion[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RubricDetails {
  readonly title: string;
  readonly subject?: string | null;
  readonly grade?: string | null;
  readonly levels: readonly RubricLevel[];
  readonly criteria: readonly RubricCriterion[];
}

export interface RubricInput extends RubricDetails {
  readonly id: RubricId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly now: Date;
}

type Checked<T> = Result<T, ValidationError>;

type CheckedDetails = Pick<Rubric, 'title' | 'subject' | 'grade' | 'levels' | 'criteria'>;

const inRange = (count: number, range: { min: number; max: number }) =>
  count >= range.min && count <= range.max;

function levels(inputs: readonly RubricLevel[]): Checked<RubricLevel[]> {
  if (!inRange(inputs.length, rubricLevelRange)) return invalid('levels', 'out_of_range');
  const checked: RubricLevel[] = [];
  for (const [index, input] of inputs.entries()) {
    const label = requiredText(`levels.${String(index)}.label`, input.label, maxLabelLength);
    if (!label.ok) return label;
    const { points } = input;
    if (!Number.isInteger(points) || points < 0 || points > maxLevelPoints) {
      return invalid(`levels.${String(index)}.points`, 'out_of_range');
    }
    const previous = checked.at(-1);
    if (previous !== undefined && points >= previous.points) {
      return invalid('levels', 'invalid_order');
    }
    checked.push({ label: label.value, points });
  }
  return ok(checked);
}

function criteria(
  inputs: readonly RubricCriterion[],
  levelCount: number,
): Checked<RubricCriterion[]> {
  if (!inRange(inputs.length, rubricCriteriaRange)) return invalid('criteria', 'out_of_range');
  const checked: RubricCriterion[] = [];
  for (const [index, input] of inputs.entries()) {
    const field = `criteria.${String(index)}`;
    const name = requiredText(`${field}.name`, input.name, maxCriterionNameLength);
    if (!name.ok) return name;
    if (input.descriptors.length !== levelCount) {
      return invalid(`${field}.descriptors`, 'out_of_range');
    }
    const descriptors = input.descriptors.map((text) => text.trim());
    if (descriptors.some((text) => text.length > maxDescriptorLength)) {
      return invalid(`${field}.descriptors`, 'too_long');
    }
    checked.push({ name: name.value, descriptors });
  }
  return ok(checked);
}

function details(input: RubricDetails): Checked<CheckedDetails> {
  const title = requiredText('title', input.title, maxRubricTitleLength);
  if (!title.ok) return title;
  const subject = input.subject?.trim() ?? '';
  if (subject !== '' && !(assistantSubjects as readonly string[]).includes(subject)) {
    return invalid('subject', 'not_allowed');
  }
  const grade = input.grade?.trim() ?? '';
  if (grade !== '' && !isGradeLevel(grade)) return invalid('grade', 'not_allowed');
  const checkedLevels = levels(input.levels);
  if (!checkedLevels.ok) return checkedLevels;
  const checkedCriteria = criteria(input.criteria, checkedLevels.value.length);
  if (!checkedCriteria.ok) return checkedCriteria;
  return ok({
    title: title.value,
    subject: subject === '' ? null : (subject as AssistantSubject),
    grade: grade === '' ? null : grade,
    levels: checkedLevels.value,
    criteria: checkedCriteria.value,
  });
}

export function createRubric(input: RubricInput): Checked<Rubric> {
  const checked = details(input);
  if (!checked.ok) return checked;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    ...checked.value,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function updateRubric(rubric: Rubric, changes: RubricDetails, now: Date): Checked<Rubric> {
  const checked = details(changes);
  return checked.ok ? ok({ ...rubric, ...checked.value, updatedAt: now }) : checked;
}

/** The most points the rubric gives: the top level of every criterion. */
export const maxRubricPoints = (rubric: Pick<Rubric, 'levels' | 'criteria'>): number =>
  (rubric.levels[0]?.points ?? 0) * rubric.criteria.length;

/** An empty grid to fill in: points count down to 1; the names come in the teacher's language. */
export function blankRubricDetails(input: {
  readonly title: string;
  readonly criteriaCount: number;
  readonly levelCount: number;
  readonly levelLabel: (points: number) => string;
  readonly criterionName: (position: number) => string;
}): RubricDetails {
  const levelPoints = Array.from(
    { length: input.levelCount },
    (_, index) => input.levelCount - index,
  );
  return {
    title: input.title,
    levels: levelPoints.map((points) => ({ label: input.levelLabel(points), points })),
    criteria: Array.from({ length: input.criteriaCount }, (_, index) => ({
      name: input.criterionName(index + 1),
      descriptors: levelPoints.map(() => ''),
    })),
  };
}

/** The rubric as plain lines, for an essay question's rubric box (what the AI grader reads). */
export function rubricAsText(rubric: Pick<Rubric, 'levels' | 'criteria'>): string {
  return rubric.criteria
    .map((criterion) => {
      const cells = rubric.levels.map((level, index) => {
        const descriptor = criterion.descriptors[index] ?? '';
        const head = `${level.label} (${String(level.points)})`;
        return descriptor === '' ? head : `${head} ${descriptor}`;
      });
      return `${criterion.name}: ${cells.join('; ')}`;
    })
    .join('\n');
}
