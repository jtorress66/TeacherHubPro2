import type { Grade } from '../gradebook/grade.ts';
import type { AssignmentId, StudentId } from '../shared/ids.ts';
import { isSecureAddress } from './lti-platform.ts';

// Assignment and Grade Services (AGS): a course's gradebook, where TeacherHubPro sends the grades
// a teacher confirmed. Only scores go out, each under the course system's own id for the student.

const agsBase = 'https://purl.imsglobal.org/spec/lti-ags/scope';

/** The AGS scopes TeacherHubPro knows: reading or managing line items, and posting scores. */
export const ltiAgsScope = {
  lineItem: `${agsBase}/lineitem`,
  lineItemReadOnly: `${agsBase}/lineitem.readonly`,
  resultReadOnly: `${agsBase}/result.readonly`,
  score: `${agsBase}/score`,
} as const;

const knownScopes: ReadonlySet<string> = new Set(Object.values(ltiAgsScope));

/** What a launch says about the course's gradebook. */
export interface LtiGradeService {
  /** The course's line items (its gradebook columns); null when not offered or not https. */
  readonly lineItemsUrl: string | null;
  /** The launched link's own line item, when the course system made one; null otherwise. */
  readonly lineItemUrl: string | null;
  /** The AGS scopes the course system granted TeacherHubPro. */
  readonly scopes: readonly string[];
}

type Claims = Readonly<Record<string, unknown>>;

const isClaims = (value: unknown): value is Claims =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const secureUrl = (value: unknown): string | null =>
  typeof value === 'string' && isSecureAddress(value) ? value : null;

/** The gradebook of a launch's AGS endpoint claim; null when the course system offers none. */
export function gradeServiceOf(claim: unknown): LtiGradeService | null {
  if (!isClaims(claim)) return null;
  const lineItemsUrl = secureUrl(claim.lineitems);
  const lineItemUrl = secureUrl(claim.lineitem);
  if (claim.lineitems === undefined && claim.lineitem === undefined) return null;
  const scope = claim.scope;
  const scopes = Array.isArray(scope)
    ? scope.filter((item): item is string => typeof item === 'string' && knownScopes.has(item))
    : [];
  return { lineItemsUrl, lineItemUrl, scopes: [...new Set(scopes)] };
}

/** Grades can be sent to a course whose gradebook TeacherHubPro may add columns to and score. */
export function canSendGrades(course: {
  readonly lineItemsUrl: string | null;
  readonly gradeScopes: readonly string[];
}): boolean {
  return (
    course.lineItemsUrl !== null &&
    course.gradeScopes.includes(ltiAgsScope.lineItem) &&
    course.gradeScopes.includes(ltiAgsScope.score)
  );
}

const scoredStatuses: ReadonlySet<Grade['status']> = new Set(['graded', 'late']);

/**
 * The score a teacher confirmed (a grade, on time or late); null for no grade or one without a
 * score. Every Grade is a teacher decision: AI suggestions and game plays never are one.
 */
export function confirmedScore(grade: Pick<Grade, 'status' | 'score'> | null): number | null {
  if (grade === null || !scoredStatuses.has(grade.status)) return null;
  return grade.score;
}

/** The line item (gradebook column) TeacherHubPro makes for an assignment. */
export interface LtiNewLineItem {
  readonly scoreMaximum: number;
  readonly label: string;
  /** The assignment's id: how TeacherHubPro finds its column again. */
  readonly resourceId: string;
  readonly tag: string;
}

const maxLabelLength = 255;

export function newLineItem(assignment: {
  readonly id: AssignmentId;
  readonly title: string;
  readonly maxPoints: number;
}): LtiNewLineItem {
  return {
    scoreMaximum: assignment.maxPoints,
    label: assignment.title.slice(0, maxLabelLength),
    resourceId: assignment.id,
    tag: 'teacherhubpro',
  };
}

const sameOrigin = (url: string, other: string): boolean =>
  URL.canParse(url) && new URL(url).origin === new URL(other).origin;

/**
 * The address of the line item made for the assignment, among those a course system listed: it
 * must name the assignment and be on the gradebook's own site. Null when there is none.
 */
export function matchingLineItem(
  items: unknown,
  resourceId: string,
  lineItemsUrl: string,
): string | null {
  if (!Array.isArray(items)) return null;
  for (const item of items) {
    if (!isClaims(item) || item.resourceId !== resourceId) continue;
    const id = secureUrl(item.id);
    if (id !== null && sameOrigin(id, lineItemsUrl)) return id;
  }
  return null;
}

/** One score as AGS takes it (`application/vnd.ims.lis.v1.score+json`). */
export interface LtiScore {
  /** The course system's id for the student (their launches' `sub`). */
  readonly userId: string;
  readonly scoreGiven: number;
  readonly scoreMaximum: number;
  readonly activityProgress: 'Completed';
  readonly gradingProgress: 'FullyGraded';
  readonly timestamp: string;
}

export interface GradeSendPlan {
  readonly scores: readonly LtiScore[];
  /** Students without a grade the teacher confirmed (none yet, pending, missing or excused). */
  readonly notConfirmed: number;
  /** Students the course system does not know: not linked through a class list import. */
  readonly notLinked: number;
}

/**
 * The scores to send for an assignment: each linked student's confirmed grade. A student who is
 * not linked counts as such, whatever their grade; nothing else about them is sent.
 */
export function planGradeSend(input: {
  readonly studentIds: readonly StudentId[];
  readonly subjects: ReadonlyMap<StudentId, string>;
  readonly grades: ReadonlyMap<StudentId, Pick<Grade, 'status' | 'score'>>;
  readonly maxPoints: number;
  readonly now: Date;
}): GradeSendPlan {
  const scores: LtiScore[] = [];
  let notConfirmed = 0;
  let notLinked = 0;
  for (const studentId of input.studentIds) {
    const userId = input.subjects.get(studentId);
    if (userId === undefined) {
      notLinked += 1;
      continue;
    }
    const score = confirmedScore(input.grades.get(studentId) ?? null);
    if (score === null) {
      notConfirmed += 1;
      continue;
    }
    scores.push({
      userId,
      scoreGiven: score,
      scoreMaximum: input.maxPoints,
      activityProgress: 'Completed',
      gradingProgress: 'FullyGraded',
      timestamp: input.now.toISOString(),
    });
  }
  return { scores, notConfirmed, notLinked };
}
