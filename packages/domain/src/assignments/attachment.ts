import type { AssignmentId, AttachmentId, SchoolId } from '../shared/ids.ts';
import { ok, type Result } from '../shared/result.ts';
import { invalid, requiredText, type ValidationError } from '../shared/validation.ts';

export const maxAttachmentBytes = 10 * 1024 * 1024;
export const maxAttachmentsPerAssignment = 10;

/** The files students may open from an assignment. */
export const attachmentTypes: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

/** A file on an assignment. Its bytes live in file storage under `key`. */
export interface Attachment {
  readonly id: AttachmentId;
  readonly schoolId: SchoolId;
  readonly assignmentId: AssignmentId;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
  readonly key: string;
}

export type AttachmentInput = Omit<Attachment, 'key'>;

export function createAttachment(input: AttachmentInput): Result<Attachment, ValidationError> {
  const name = requiredText('name', input.name);
  if (!name.ok) return name;
  if (!Object.hasOwn(attachmentTypes, input.contentType)) {
    return invalid('contentType', 'not_allowed');
  }
  if (!Number.isInteger(input.size) || input.size <= 0) return invalid('size', 'out_of_range');
  if (input.size > maxAttachmentBytes) return invalid('size', 'too_large');
  return ok({
    ...input,
    name: name.value,
    key: `attachments/${input.schoolId}/${input.assignmentId}/${input.id}`,
  });
}
