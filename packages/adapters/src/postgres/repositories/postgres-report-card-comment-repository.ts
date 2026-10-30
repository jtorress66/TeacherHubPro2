import type { Kysely } from 'kysely';
import type {
  ClassId,
  ReportCardComment,
  ReportCardCommentId,
  SchoolId,
  StudentId,
} from '@thp/domain';
import type { ReportCardCommentRepository } from '@thp/ports';
import { reportCardCommentMapper } from '../mappers/gradebook-mappers.ts';
import type { Database } from '../schema.ts';

/** One comment per student and class: saving another replaces it (a unique key enforces it too). */
export class PostgresReportCardCommentRepository implements ReportCardCommentRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: ReportCardCommentId): Promise<ReportCardComment | null> {
    const row = await this.db
      .selectFrom('report_card_comments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : reportCardCommentMapper.fromRow(row);
  }

  async save(comment: ReportCardComment): Promise<void> {
    const row = reportCardCommentMapper.toRow(comment);
    await this.db.transaction().execute(async (trx) => {
      await trx
        .deleteFrom('report_card_comments')
        .where('class_id', '=', comment.classId)
        .where('student_id', '=', comment.studentId)
        .where('id', '<>', comment.id)
        .execute();
      await trx
        .insertInto('report_card_comments')
        .values(row)
        .onConflict((conflict) => conflict.column('id').doUpdateSet(row))
        .execute();
    });
  }

  async findFor(
    schoolId: SchoolId,
    classId: ClassId,
    studentId: StudentId,
  ): Promise<ReportCardComment | null> {
    const row = await this.db
      .selectFrom('report_card_comments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .where('student_id', '=', studentId)
      .executeTakeFirst();
    return row === undefined ? null : reportCardCommentMapper.fromRow(row);
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly ReportCardComment[]> {
    const rows = await this.db
      .selectFrom('report_card_comments')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(reportCardCommentMapper.fromRow);
  }

  async deleteFor(schoolId: SchoolId, classId: ClassId, studentId: StudentId): Promise<void> {
    await this.db
      .deleteFrom('report_card_comments')
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .where('student_id', '=', studentId)
      .execute();
  }
}
