import type { SchoolId, UserId } from '../shared/ids.ts';
import type { Role } from '../users/roles.ts';
import { canExportSchoolData } from './school-export.ts';

/** Days between asking to delete a school's data and deleting it; the request can be canceled. */
export const deletionHoldDays = 30;

const dayInMs = 24 * 60 * 60 * 1000;

/** A school's request to have all of its data deleted once the hold is over. */
export interface SchoolDeletionRequest {
  readonly schoolId: SchoolId;
  readonly requestedBy: UserId;
  readonly requestedAt: Date;
  readonly deleteAfter: Date;
}

export function requestSchoolDeletion(input: {
  readonly schoolId: SchoolId;
  readonly requestedBy: UserId;
  readonly now: Date;
}): SchoolDeletionRequest {
  return {
    schoolId: input.schoolId,
    requestedBy: input.requestedBy,
    requestedAt: input.now,
    deleteAfter: new Date(input.now.getTime() + deletionHoldDays * dayInMs),
  };
}

export const isDueForDeletion = (request: SchoolDeletionRequest, now: Date): boolean =>
  now.getTime() >= request.deleteAfter.getTime();

const normalized = (name: string): string =>
  name.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();

/** The typed confirmation: the school's name, ignoring case and extra spaces. */
export function matchesSchoolName(typed: string, name: string): boolean {
  const wanted = normalized(name);
  return wanted !== '' && normalized(typed) === wanted;
}

interface Person {
  readonly id: UserId;
  readonly schoolId: SchoolId;
  readonly role: Role;
}

/**
 * Who may ask to delete all of a school's data: whoever may download it (its admins and the
 * account owner). Never a school with a super admin in it, so the platform owner is never deleted.
 */
export function canDeleteSchoolData(
  actor: Person,
  subscription: { readonly ownerId: UserId } | null,
  members: readonly { readonly role: Role }[],
): boolean {
  if (actor.role === 'super_admin') return false;
  if (members.some((member) => member.role === 'super_admin')) return false;
  return canExportSchoolData(actor, subscription);
}
