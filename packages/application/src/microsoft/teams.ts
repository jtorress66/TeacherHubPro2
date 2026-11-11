import {
  checkSchedule,
  instantIn,
  ok,
  optionalText,
  parseLocalDate,
  parseWordDocument,
  requiredText,
  type ClassId,
  type Err,
  type LocalDate,
  type Result,
  type User,
} from '@thp/domain';
import type {
  AttachmentRepository,
  Clock,
  IdGenerator,
  MicrosoftError,
  StudentRepository,
  TeamsAssignmentRequest,
  TeamsAssignments,
  TeamsClass,
  TeamsClasses,
} from '@thp/ports';
import {
  editableAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from '../assignments/assignment-access.ts';
import { addToRoster } from '../assignments/roster-import.ts';
import { fail, type ApplicationErrorCode, type UseCaseError } from '../errors.ts';
import { findEditableClass } from '../gradebook/gradebook-access.ts';
import { microsoftAccess, type MicrosoftConnectionDeps } from './microsoft.ts';

/**
 * What the teacher can do about a Teams refusal: allow Teams again (a refused permission also
 * forgets Teams, so Settings offers it again; OneDrive stays), connect again, pick another class,
 * or try again.
 */
async function teamsFailed(
  deps: MicrosoftConnectionDeps,
  actor: User,
  error: MicrosoftError,
): Promise<Err<{ readonly code: ApplicationErrorCode }>> {
  if (error.code === 'insufficient_scope') {
    const connection = await deps.microsoftConnections.find(actor.schoolId, actor.id);
    if (connection !== null) await deps.microsoftConnections.save({ ...connection, teams: false });
    return fail('teams_not_allowed');
  }
  return fail(
    error.code === 'unauthorized'
      ? 'microsoft_not_connected'
      : error.code === 'not_found'
        ? 'not_found'
        : 'teams_failed',
  );
}

/** Work is due at the end of the due date, in the teacher's time zone. */
const dueAt = (date: LocalDate | null, timeZone: string): Date | null =>
  date === null ? null : instantIn(date, 23, 59, timeZone);

/** An access token that carries Teams. */
const teamsAccess = (deps: MicrosoftConnectionDeps, actor: User) =>
  microsoftAccess(deps, actor, { teams: true });

type TeamsDeps = MicrosoftConnectionDeps;

async function post(
  deps: TeamsDeps & { readonly teamsAssignments: TeamsAssignments },
  actor: User,
  teamsClassId: string,
  request: TeamsAssignmentRequest,
): Promise<Result<{ readonly url: string }, UseCaseError>> {
  const token = await teamsAccess(deps, actor);
  if (!token.ok) return token;
  const posted = await deps.teamsAssignments.createAssignment(token.value, teamsClassId, request);
  return posted.ok ? ok({ url: posted.value.url }) : teamsFailed(deps, actor, posted.error);
}

/** The teacher's Microsoft Teams classes. */
export class ListTeamsClasses {
  constructor(private readonly deps: TeamsDeps & { readonly teamsClasses: TeamsClasses }) {}

  async execute(input: {
    readonly actor: User;
  }): Promise<Result<readonly TeamsClass[], UseCaseError>> {
    const token = await teamsAccess(this.deps, input.actor);
    if (!token.ok) return token;
    const classes = await this.deps.teamsClasses.listClasses(token.value);
    return classes.ok ? classes : teamsFailed(this.deps, input.actor, classes.error);
  }
}

/**
 * Adds a Teams class's students to a class (first and last name only), skipping names already on
 * the roster.
 */
export class ImportTeamsRoster {
  constructor(
    private readonly deps: TeamsDeps & {
      readonly teamsClasses: TeamsClasses;
      readonly classes: AssignmentAccessDeps['classes'];
      readonly students: StudentRepository;
      readonly ids: IdGenerator;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly classId: ClassId;
    readonly teamsClassId: string;
  }): Promise<Result<{ added: number; skipped: number }, UseCaseError>> {
    const cls = await findEditableClass(this.deps.classes, input.actor, input.classId);
    if (!cls.ok) return cls;
    const token = await teamsAccess(this.deps, input.actor);
    if (!token.ok) return token;
    const roster = await this.deps.teamsClasses.listStudents(token.value, input.teamsClassId);
    if (!roster.ok) return teamsFailed(this.deps, input.actor, roster.error);
    return ok(await addToRoster(this.deps, cls.value, roster.value));
  }
}

/**
 * Posts an assignment to a Teams class (only one with questions or files). It links to the app,
 * never to a student's personal link: each student keeps their own.
 */
export class ShareAssignmentToTeams {
  constructor(
    private readonly deps: TeamsDeps &
      AssignmentAccessDeps & {
        readonly teamsAssignments: TeamsAssignments;
        readonly attachments: AttachmentRepository;
        readonly appUrl: string;
      },
  ) {}

  async execute(
    input: AssignmentRef & { readonly teamsClassId: string; readonly timeZone: string },
  ): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    const files = await this.deps.attachments.listByAssignment(assignment.schoolId, assignment.id);
    if (assignment.questions.length === 0 && files.length === 0) return fail('not_shareable');
    return post(this.deps, input.actor, input.teamsClassId, {
      title: assignment.title,
      instructions: assignment.instructions ?? '',
      resource: { kind: 'link', name: 'TeacherHubPro', url: this.deps.appUrl },
      dueAt: dueAt(assignment.dueDate, input.timeZone),
      assignAt: null,
    });
  }
}

/**
 * Posts the teacher's own Word document to a Teams class, unchanged: each student gets their own
 * copy to type in. No AI; nothing is kept in TeacherHubPro.
 */
export class PostWordToTeams {
  constructor(
    private readonly deps: TeamsDeps & {
      readonly teamsAssignments: TeamsAssignments;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    readonly actor: User;
    readonly teamsClassId: string;
    readonly title: string;
    readonly instructions: string | null;
    readonly dueDate: string | null;
    readonly fileName: string;
    readonly bytes: Uint8Array;
    /** The teacher's time zone: work is due at the end of the due date there. */
    readonly timeZone: string;
    /** Show it to students later, at this moment; missing or null shows it now. */
    readonly scheduledAt?: Date | null;
  }): Promise<Result<{ readonly url: string }, UseCaseError>> {
    const teamsClass = requiredText('teamsClassId', input.teamsClassId);
    if (!teamsClass.ok) return teamsClass;
    const title = requiredText('title', input.title);
    if (!title.ok) return title;
    const instructions = optionalText('instructions', input.instructions, 5000);
    if (!instructions.ok) return instructions;
    const document = parseWordDocument(input.fileName, input.bytes);
    if (!document.ok) return document;
    let dueDate: LocalDate | null = null;
    if (input.dueDate !== null) {
      const parsed = parseLocalDate('dueDate', input.dueDate);
      if (!parsed.ok) return parsed;
      dueDate = parsed.value;
    }
    let assignAt: Date | null = null;
    if (input.scheduledAt != null) {
      const checked = checkSchedule('scheduledAt', input.scheduledAt, this.deps.clock.now());
      if (!checked.ok) return checked;
      assignAt = checked.value;
    }
    return post(this.deps, input.actor, teamsClass.value, {
      title: title.value,
      instructions: instructions.value ?? '',
      resource: {
        kind: 'wordCopy',
        fileName: document.value.name,
        bytes: document.value.bytes,
      },
      dueAt: dueAt(dueDate, input.timeZone),
      assignAt,
    });
  }
}
