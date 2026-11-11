import type { Result } from '@thp/domain';
import type { MicrosoftError } from './microsoft.ts';

/** A Microsoft Teams class the teacher belongs to. */
export interface TeamsClass {
  readonly id: string;
  readonly name: string;
}

/** A student of a Teams class: first and last name only. */
export interface TeamsStudent {
  readonly firstName: string;
  readonly lastName: string;
}

/** Reads a teacher's Microsoft Teams classes and their students. */
export interface TeamsClasses {
  listClasses(accessToken: string): Promise<Result<readonly TeamsClass[], MicrosoftError>>;
  /** The class's students (its teachers left out), names only. */
  listStudents(
    accessToken: string,
    classId: string,
  ): Promise<Result<readonly TeamsStudent[], MicrosoftError>>;
}

/**
 * What students open: a link, or a Word document that each student gets their own copy of to
 * type in.
 */
export type TeamsResource =
  | { readonly kind: 'link'; readonly name: string; readonly url: string }
  | { readonly kind: 'wordCopy'; readonly fileName: string; readonly bytes: Uint8Array };

export interface TeamsAssignmentRequest {
  readonly title: string;
  readonly instructions: string;
  readonly resource: TeamsResource;
  /** When the work is due; null for no due date. */
  readonly dueAt: Date | null;
  /** Teams shows the assignment to students at this moment; null shows it now. */
  readonly assignAt: Date | null;
}

/** Posts assignments to a Microsoft Teams class (Teams Assignments). */
export interface TeamsAssignments {
  /** Creates, adds the resource and publishes; a half-made assignment is not left behind. */
  createAssignment(
    accessToken: string,
    classId: string,
    request: TeamsAssignmentRequest,
  ): Promise<Result<{ readonly id: string; readonly url: string }, MicrosoftError>>;
}
