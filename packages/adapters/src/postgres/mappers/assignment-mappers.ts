import type { Selectable } from 'kysely';
import type {
  AssignmentId,
  Attachment,
  AttachmentId,
  ClassId,
  ClassroomConnection,
  FormsExport,
  GoogleQuiz,
  GoogleQuizId,
  SchoolId,
  StudentId,
  StudentLink,
  StudentLinkId,
  UserId,
} from '@thp/domain';
import type {
  AssignmentAttachmentsTable,
  ClassroomConnectionsTable,
  FormsExportsTable,
  GoogleQuizzesTable,
  StudentLinksTable,
} from '../schema.ts';
import type { Row, RowMapper } from './columns.ts';

export const attachmentMapper: RowMapper<Attachment, AssignmentAttachmentsTable> = {
  toRow: (attachment) => ({
    id: attachment.id,
    school_id: attachment.schoolId,
    assignment_id: attachment.assignmentId,
    name: attachment.name,
    content_type: attachment.contentType,
    size: attachment.size,
    key: attachment.key,
  }),
  fromRow: (row) => ({
    id: row.id as AttachmentId,
    schoolId: row.school_id as SchoolId,
    assignmentId: row.assignment_id as AssignmentId,
    name: row.name,
    contentType: row.content_type,
    size: row.size,
    key: row.key,
  }),
};

export const studentLinkMapper: RowMapper<StudentLink, StudentLinksTable> = {
  toRow: (link) => ({
    id: link.id,
    school_id: link.schoolId,
    class_id: link.classId,
    student_id: link.studentId,
    token_hash: link.tokenHash,
    expires_at: link.expiresAt,
    revoked_at: link.revokedAt,
  }),
  fromRow: (row) => ({
    id: row.id as StudentLinkId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    studentId: row.student_id as StudentId,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  }),
};

export const classroomConnectionMapper = {
  toRow: (connection: ClassroomConnection): Row<ClassroomConnectionsTable> => ({
    teacher_id: connection.teacherId,
    school_id: connection.schoolId,
    encrypted_refresh_token: connection.encryptedRefreshToken,
    connected_at: connection.connectedAt,
  }),
  fromRow: (row: Selectable<ClassroomConnectionsTable>): ClassroomConnection => ({
    id: row.teacher_id as UserId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    encryptedRefreshToken: row.encrypted_refresh_token,
    connectedAt: row.connected_at,
  }),
};

export const formsExportMapper = {
  toRow: (formsExport: FormsExport): Row<FormsExportsTable> => ({
    assignment_id: formsExport.assignmentId,
    school_id: formsExport.schoolId,
    form_id: formsExport.formId,
    edit_url: formsExport.editUrl,
    responder_url: formsExport.responderUrl,
    made_at: formsExport.createdAt,
  }),
  fromRow: (row: Selectable<FormsExportsTable>): FormsExport => ({
    schoolId: row.school_id as SchoolId,
    assignmentId: row.assignment_id as AssignmentId,
    formId: row.form_id,
    editUrl: row.edit_url,
    responderUrl: row.responder_url,
    createdAt: row.made_at,
  }),
};

export const googleQuizMapper = {
  toRow: (quiz: GoogleQuiz): Row<GoogleQuizzesTable> => ({
    id: quiz.id,
    school_id: quiz.schoolId,
    owner_id: quiz.ownerId,
    title: quiz.title,
    form_id: quiz.formId,
    edit_url: quiz.editUrl,
    responder_url: quiz.responderUrl,
    made_at: quiz.createdAt,
  }),
  fromRow: (row: Selectable<GoogleQuizzesTable>): GoogleQuiz => ({
    id: row.id as GoogleQuizId,
    schoolId: row.school_id as SchoolId,
    ownerId: row.owner_id as UserId,
    title: row.title,
    formId: row.form_id,
    editUrl: row.edit_url,
    responderUrl: row.responder_url,
    createdAt: row.made_at,
  }),
};
