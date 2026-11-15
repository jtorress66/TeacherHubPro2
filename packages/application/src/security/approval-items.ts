import {
  isApprovalAction,
  type ApprovalAction,
  type AssignmentId,
  type AssistantSubject,
  type AuditEvent,
  type GameId,
  type LearningPathId,
  type LocalDate,
  type PrepBatchId,
  type SchoolId,
  type SubmissionId,
  type UserId,
} from '@thp/domain';
import type {
  AssignmentRepository,
  GameRepository,
  LearningPathRepository,
  PrepBatchRepository,
  SubmissionRepository,
} from '@thp/ports';

/**
 * What an approval was about, for a reader: a teacher-typed title, the week a prep batch
 * covered, or a path's subject. Never a student. `deleted` when the item is gone.
 */
export type ApprovalItem =
  | { readonly kind: 'title'; readonly text: string }
  | { readonly kind: 'week'; readonly start: LocalDate }
  | { readonly kind: 'subject'; readonly subject: AssistantSubject }
  | { readonly kind: 'deleted' };

export interface ApprovalItemDeps {
  readonly submissions: Pick<SubmissionRepository, 'findByIds'>;
  readonly assignments: Pick<AssignmentRepository, 'findByIds'>;
  readonly games: Pick<GameRepository, 'findByIds'>;
  readonly prepBatches: Pick<PrepBatchRepository, 'find'>;
  readonly learningPaths: Pick<LearningPathRepository, 'findByIds'>;
}

type Items = ReadonlyMap<string, ApprovalItem>;

/** Looks up the items of one kind of approval, in batches, within the school. */
type ItemResolver = (
  deps: ApprovalItemDeps,
  schoolId: SchoolId,
  events: readonly AuditEvent[],
) => Promise<Items>;

const targetIds = <T extends string>(events: readonly AuditEvent[]): T[] => [
  ...new Set(events.flatMap((event) => (event.targetId === null ? [] : [event.targetId as T]))),
];

const title = (text: string): ApprovalItem => ({ kind: 'title', text });

const resolvers: Readonly<Record<ApprovalAction, ItemResolver>> = {
  ai_grade_approved: async (deps, schoolId, events) => {
    const submissions = await deps.submissions.findByIds(schoolId, targetIds<SubmissionId>(events));
    const assignmentIds = [...new Set(submissions.map((s) => s.assignmentId))];
    const assignments = await deps.assignments.findByIds(schoolId, assignmentIds);
    const titles = new Map<AssignmentId, string>(assignments.map((a) => [a.id, a.title]));
    return new Map(
      submissions.flatMap((s) => {
        const text = titles.get(s.assignmentId);
        return text === undefined ? [] : [[s.id, title(text)] as const];
      }),
    );
  },
  game_grades_approved: async (deps, schoolId, events) => {
    const games = await deps.games.findByIds(schoolId, targetIds<GameId>(events));
    return new Map(games.map((game) => [game.id, title(game.title)]));
  },
  // A prep batch belongs to the teacher who approved it, so it is read as theirs. One read per
  // batch: a teacher approves about one a week, and the list stops at 500 rows.
  prep_approved: async (deps, schoolId, events) => {
    const owners = new Map<string, UserId>(
      events.flatMap((event) =>
        event.targetId === null ? [] : [[event.targetId, event.actorId] as const],
      ),
    );
    const batches = await Promise.all(
      [...owners].map(([id, teacherId]) =>
        deps.prepBatches.find(schoolId, teacherId, id as PrepBatchId),
      ),
    );
    return new Map(
      batches.flatMap((batch) =>
        batch === null
          ? []
          : [[batch.id, { kind: 'week', start: batch.request.weekStart }] as const],
      ),
    );
  },
  grades_sent_to_course: async (deps, schoolId, events) => {
    const assignments = await deps.assignments.findByIds(schoolId, targetIds<AssignmentId>(events));
    return new Map(assignments.map((a) => [a.id, title(a.title)]));
  },
  learning_path_assigned: async (deps, schoolId, events) => {
    const paths = await deps.learningPaths.findByIds(schoolId, targetIds<LearningPathId>(events));
    return new Map(paths.map((path) => [path.id, { kind: 'subject', subject: path.subject }]));
  },
};

const deleted: ApprovalItem = { kind: 'deleted' };

/** Each approval's item, looked up per kind in a few batched reads. */
export async function approvalItems(
  deps: ApprovalItemDeps,
  schoolId: SchoolId,
  events: readonly AuditEvent[],
): Promise<(event: AuditEvent) => ApprovalItem> {
  const actions = [...new Set(events.map((event) => event.action))].filter(isApprovalAction);
  const found = await Promise.all(
    actions.map(async (action): Promise<readonly [string, Items]> => {
      const ofKind = events.filter((event) => event.action === action);
      return [action, await resolvers[action](deps, schoolId, ofKind)];
    }),
  );
  const byAction = new Map<string, Items>(found);
  return (event) =>
    (event.targetId === null ? undefined : byAction.get(event.action)?.get(event.targetId)) ??
    deleted;
}
