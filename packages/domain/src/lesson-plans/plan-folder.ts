import type { PlanFolderId, SchoolId, UserId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

/** The colours a folder may take; the UI maps each name to its own shade. */
export const folderColors = [
  'indigo',
  'emerald',
  'amber',
  'rose',
  'sky',
  'violet',
  'slate',
] as const;

export type FolderColor = (typeof folderColors)[number];

export const maxFolderNameLength = 60;

/** A teacher's own folder of lesson plans. */
export interface PlanFolder {
  readonly id: PlanFolderId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly name: string;
  readonly color: FolderColor;
}

export interface PlanFolderDetails {
  readonly name: string;
  /** Missing means the first colour. */
  readonly color?: string;
}

const isFolderColor = (value: string): value is FolderColor =>
  (folderColors as readonly string[]).includes(value);

function folderDetails(
  details: PlanFolderDetails,
): Result<Pick<PlanFolder, 'name' | 'color'>, ValidationError> {
  const name = requiredText('name', details.name, maxFolderNameLength);
  if (!name.ok) return name;
  const color = details.color ?? folderColors[0];
  if (!isFolderColor(color)) return invalid('color', 'not_allowed');
  return ok({ name: name.value, color });
}

export function createPlanFolder(
  input: Omit<PlanFolder, 'name' | 'color'> & PlanFolderDetails,
): Result<PlanFolder, ValidationError> {
  const details = folderDetails(input);
  if (!details.ok) return details;
  return ok({
    id: input.id,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    ...details.value,
  });
}

export function updatePlanFolder(
  folder: PlanFolder,
  details: PlanFolderDetails,
): Result<PlanFolder, ValidationError> {
  const checked = folderDetails(details);
  return checked.ok ? ok({ ...folder, ...checked.value }) : checked;
}
