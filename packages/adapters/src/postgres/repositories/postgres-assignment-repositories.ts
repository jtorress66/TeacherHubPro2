import type { Kysely } from 'kysely';
import type {
  AssignmentId,
  Attachment,
  AttachmentId,
  ClassId,
  ClassroomConnection,
  SchoolId,
  StudentLink,
  StudentLinkId,
  UserId,
} from '@thp/domain';
import type {
  AttachmentRepository,
  ClassroomConnectionRepository,
  StudentLinkRepository,
} from '@thp/ports';
import {
  attachmentMapper,
  classroomConnectionMapper,
  studentLinkMapper,
} from '../mappers/assignment-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: AttachmentId): Promise<Attachment | null> {
    const row = await this.db
      .selectFrom('assignment_attachments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : attachmentMapper.fromRow(row);
  }

  save(attachment: Attachment): Promise<void> {
    return upsert(this.db, 'assignment_attachments', attachmentMapper.toRow(attachment));
  }

  async delete(schoolId: SchoolId, id: AttachmentId): Promise<void> {
    await this.db
      .deleteFrom('assignment_attachments')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByAssignment(
    schoolId: SchoolId,
    assignmentId: AssignmentId,
  ): Promise<readonly Attachment[]> {
    const rows = await this.db
      .selectFrom('assignment_attachments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('assignment_id', '=', assignmentId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(attachmentMapper.fromRow);
  }
}

export class PostgresStudentLinkRepository implements StudentLinkRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: StudentLinkId): Promise<StudentLink | null> {
    const row = await this.db
      .selectFrom('student_links')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : studentLinkMapper.fromRow(row);
  }

  save(link: StudentLink): Promise<void> {
    return upsert(this.db, 'student_links', studentLinkMapper.toRow(link));
  }

  async findByTokenHash(tokenHash: string): Promise<StudentLink | null> {
    const row = await this.db
      .selectFrom('student_links')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();
    return row === undefined ? null : studentLinkMapper.fromRow(row);
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly StudentLink[]> {
    const rows = await this.db
      .selectFrom('student_links')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(studentLinkMapper.fromRow);
  }
}

export class PostgresClassroomConnectionRepository implements ClassroomConnectionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(schoolId: SchoolId, teacherId: UserId): Promise<ClassroomConnection | null> {
    const row = await this.db
      .selectFrom('classroom_connections')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .executeTakeFirst();
    return row === undefined ? null : classroomConnectionMapper.fromRow(row);
  }

  async save(connection: ClassroomConnection): Promise<void> {
    const row = classroomConnectionMapper.toRow(connection);
    await this.db
      .insertInto('classroom_connections')
      .values(row)
      .onConflict((conflict) => conflict.column('teacher_id').doUpdateSet(row))
      .execute();
  }

  async delete(schoolId: SchoolId, teacherId: UserId): Promise<void> {
    await this.db
      .deleteFrom('classroom_connections')
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .execute();
  }
}
