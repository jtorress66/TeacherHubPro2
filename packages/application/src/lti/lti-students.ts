import type { ClassId, LtiLaunch, LtiPlacedItem, LtiPlatform, SchoolId } from '@thp/domain';
import type {
  AssignmentRepository,
  AttachmentRepository,
  GameRepository,
  LtiPlacementRepository,
  LtiStudentLinkRepository,
  StudentRepository,
  TicketSigner,
} from '@thp/ports';
import { issueStudentPass } from '../assignments/student-pass.ts';
import { isReady } from '../assignments/student-portal.ts';

// Students who open a placed assignment or game from their course system: the course system
// vouches for who they are (its signed launch), the class list import tied them to a roster
// student, and they get a pass for that one item. They never get an account or a session.

export interface LtiLearnerDeps {
  readonly ltiPlacements: LtiPlacementRepository;
  readonly ltiStudentLinks: LtiStudentLinkRepository;
  readonly students: StudentRepository;
  readonly assignments: AssignmentRepository;
  readonly attachments: AttachmentRepository;
  readonly games: GameRepository;
  readonly ticketSigner: TicketSigner;
}

export type LtiLearnerOutcome =
  | {
      readonly kind: 'studentItem';
      /** Signed and short-lived: opens this item, for this roster student only. */
      readonly pass: string;
      readonly item: LtiPlacedItem;
      readonly locale: string | null;
    }
  /** Not linked, not on the item's class list, or the item is not there: ask the teacher. */
  | { readonly kind: 'learnerNotOnList'; readonly locale: string | null }
  /** A launch that opens no placed item: nothing for students there yet. */
  | { readonly kind: 'learnerNotYet'; readonly locale: string | null };

/** The class whose students may open the item: a ready assignment's, or a shared game's. */
async function classOf(
  deps: LtiLearnerDeps,
  schoolId: SchoolId,
  item: LtiPlacedItem,
): Promise<ClassId | null> {
  if (item.kind === 'game') return (await deps.games.findById(schoolId, item.id))?.classId ?? null;
  const assignment = await deps.assignments.findById(schoolId, item.id);
  return assignment !== null && (await isReady(deps, assignment)) ? assignment.classId : null;
}

/**
 * A learner's launch: a pass when it opens an item placed in this course, of this school, whose
 * class list has the roster student linked to the learner; the ask-your-teacher page when not.
 * Nothing about other students is looked at or told.
 */
export async function admitLearner(
  deps: LtiLearnerDeps,
  platform: LtiPlatform,
  launch: LtiLaunch,
  now: Date,
): Promise<LtiLearnerOutcome> {
  const { placedItem: item, contextId, locale } = launch;
  if (item === null) return { kind: 'learnerNotYet', locale };
  const schoolId = platform.schoolId;
  const notOnList = { kind: 'learnerNotOnList', locale } as const;
  if (contextId === null) return notOnList;
  const placed = await deps.ltiPlacements.find(schoolId, platform.id, contextId, item);
  const classId = placed === null ? null : await classOf(deps, schoolId, item);
  if (classId === null) return notOnList;
  for (const id of await deps.ltiStudentLinks.listStudentIds(
    schoolId,
    platform.id,
    launch.subject,
  )) {
    const student = await deps.students.findById(schoolId, id);
    if (student?.classId === classId) {
      return {
        kind: 'studentItem',
        pass: issueStudentPass(deps, student, item, now),
        item,
        locale,
      };
    }
  }
  return notOnList;
}
