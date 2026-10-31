import {
  createAttachment,
  maxAttachmentsPerAssignment,
  ok,
  type Attachment,
  type AttachmentId,
  type Result,
} from '@thp/domain';
import type { AttachmentRepository, FileStore, IdGenerator } from '@thp/ports';
import { fail, type UseCaseError } from '../errors.ts';
import {
  editableAssignment,
  managedAssignment,
  type AssignmentAccessDeps,
  type AssignmentRef,
} from './assignment-access.ts';

type Deps = AssignmentAccessDeps & {
  readonly attachments: AttachmentRepository;
  readonly files: FileStore;
};

/** Adds a file to an assignment (at most ten); the bytes go to file storage first. */
export class UploadAttachment {
  constructor(private readonly deps: Deps & { readonly ids: IdGenerator }) {}

  async execute(
    input: AssignmentRef & {
      readonly name: string;
      readonly contentType: string;
      readonly bytes: Uint8Array;
    },
  ): Promise<Result<Attachment, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    const attachment = createAttachment({
      id: this.deps.ids.next() as AttachmentId,
      schoolId: assignment.schoolId,
      assignmentId: assignment.id,
      name: input.name,
      contentType: input.contentType,
      size: input.bytes.length,
    });
    if (!attachment.ok) return attachment;
    const existing = await this.deps.attachments.listByAssignment(
      assignment.schoolId,
      assignment.id,
    );
    if (existing.length >= maxAttachmentsPerAssignment) return fail('too_many_attachments');
    const stored = await this.deps.files.put(attachment.value.key, {
      bytes: input.bytes,
      contentType: input.contentType,
    });
    if (!stored.ok) return fail('storage_unavailable');
    await this.deps.attachments.save(attachment.value);
    return attachment;
  }
}

/** Removes a file from an assignment and from storage. */
export class DeleteAttachment {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: AssignmentRef & { readonly attachmentId: AttachmentId },
  ): Promise<Result<true, UseCaseError>> {
    const found = await editableAssignment(this.deps, input);
    if (!found.ok) return found;
    const attachment = await this.deps.attachments.findById(
      found.value.assignment.schoolId,
      input.attachmentId,
    );
    if (attachment?.assignmentId !== found.value.assignment.id) return fail('not_found');
    await this.deps.attachments.delete(attachment.schoolId, attachment.id);
    await this.deps.files.delete(attachment.key);
    return ok(true);
  }
}

export class ListAttachments {
  constructor(private readonly deps: Deps) {}

  async execute(input: AssignmentRef): Promise<Result<readonly Attachment[], UseCaseError>> {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    const { assignment } = found.value;
    return ok(await this.deps.attachments.listByAssignment(assignment.schoolId, assignment.id));
  }
}

/** A file the teacher attached, with its bytes, for the teacher's own download. */
export class GetAttachmentFile {
  constructor(private readonly deps: Deps) {}

  async execute(
    input: AssignmentRef & { readonly attachmentId: AttachmentId },
  ): Promise<Result<{ attachment: Attachment; bytes: Uint8Array }, UseCaseError>> {
    const found = await managedAssignment(this.deps, input);
    if (!found.ok) return found;
    const attachment = await this.deps.attachments.findById(
      found.value.assignment.schoolId,
      input.attachmentId,
    );
    if (attachment?.assignmentId !== found.value.assignment.id) return fail('not_found');
    const file = await this.deps.files.get(attachment.key);
    return file.ok ? ok({ attachment, bytes: file.value.bytes }) : fail('not_found');
  }
}
