import type { Kysely } from 'kysely';
import type {
  SchoolId,
  StudentId,
  StudentInsight,
  StudentNote,
  StudentNoteId,
  UserId,
} from '@thp/domain';
import type { StudentInsightRepository, StudentNoteRepository } from '@thp/ports';
import { studentInsightMapper, studentNoteMapper } from '../mappers/student-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresStudentNoteRepository implements StudentNoteRepository {
  constructor(private readonly db: Kysely<Database>) {}

  save(note: StudentNote): Promise<void> {
    return upsert(this.db, 'student_notes', studentNoteMapper.toRow(note));
  }

  async listFor(
    schoolId: SchoolId,
    studentId: StudentId,
    authorId: UserId,
  ): Promise<readonly StudentNote[]> {
    const rows = await this.db
      .selectFrom('student_notes')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('student_id', '=', studentId)
      .where('author_id', '=', authorId)
      .orderBy('written_at', 'desc')
      .orderBy('id')
      .execute();
    return rows.map(studentNoteMapper.fromRow);
  }

  async delete(schoolId: SchoolId, id: StudentNoteId, authorId: UserId): Promise<boolean> {
    const result = await this.db
      .deleteFrom('student_notes')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .where('author_id', '=', authorId)
      .executeTakeFirst();
    return result.numDeletedRows > 0n;
  }
}

export class PostgresStudentInsightRepository implements StudentInsightRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async find(
    schoolId: SchoolId,
    studentId: StudentId,
    teacherId: UserId,
  ): Promise<StudentInsight | null> {
    const row = await this.db
      .selectFrom('student_insights')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('student_id', '=', studentId)
      .where('teacher_id', '=', teacherId)
      .executeTakeFirst();
    return row === undefined ? null : studentInsightMapper.fromRow(row);
  }

  async save(insight: StudentInsight): Promise<void> {
    const row = studentInsightMapper.toRow(insight);
    await this.db
      .insertInto('student_insights')
      .values(row)
      .onConflict((conflict) =>
        conflict.columns(['school_id', 'student_id', 'teacher_id']).doUpdateSet(row),
      )
      .execute();
  }
}
