import { sql, type Kysely } from 'kysely';
import type { SchoolDeletionRequest, SchoolId, UserId } from '@thp/domain';
import type { SchoolDeletionRepository, SchoolEraser } from '@thp/ports';
import type { Database, SchoolDeletionRequestsTable } from '../schema.ts';

const toRequest = (row: SchoolDeletionRequestsTable): SchoolDeletionRequest => ({
  schoolId: row.school_id as SchoolId,
  requestedBy: row.requested_by as UserId,
  requestedAt: row.requested_at,
  deleteAfter: row.delete_after,
});

export class PostgresSchoolDeletionRepository implements SchoolDeletionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findBySchool(schoolId: SchoolId): Promise<SchoolDeletionRequest | null> {
    const row = await this.db
      .selectFrom('school_deletion_requests')
      .selectAll()
      .where('school_id', '=', schoolId)
      .executeTakeFirst();
    return row === undefined ? null : toRequest(row);
  }

  async save(request: SchoolDeletionRequest): Promise<void> {
    const row = {
      school_id: request.schoolId,
      requested_by: request.requestedBy,
      requested_at: request.requestedAt,
      delete_after: request.deleteAfter,
    };
    await this.db
      .insertInto('school_deletion_requests')
      .values(row)
      .onConflict((conflict) => conflict.column('school_id').doUpdateSet(row))
      .execute();
  }

  async remove(schoolId: SchoolId): Promise<void> {
    await this.db
      .deleteFrom('school_deletion_requests')
      .where('school_id', '=', schoolId)
      .execute();
  }

  async listDue(now: Date): Promise<readonly SchoolDeletionRequest[]> {
    const rows = await this.db
      .selectFrom('school_deletion_requests')
      .selectAll()
      .where('delete_after', '<=', now)
      .orderBy('delete_after')
      .execute();
    return rows.map(toRequest);
  }
}

/**
 * Every table with a school_id column, in an order that never breaks a foreign key: work before
 * what it belongs to, students before classes, people last. A test checks no such table is
 * missing, so a new table cannot keep a deleted school's data.
 */
export const schoolTables = [
  'live_answers',
  'live_players',
  'live_sessions',
  'lesson_attempts',
  'learning_paths',
  'game_plays',
  'games',
  'forms_exports',
  'assignment_attachments',
  'submissions',
  'grades',
  'report_card_comments',
  'assignments',
  'grade_categories',
  'attendance_sessions',
  'portal_links',
  'student_links',
  'student_notes',
  'student_insights',
  'prep_batches',
  'sub_packets',
  'lti_courses',
  'lti_placements',
  'lti_platforms',
  'lesson_plans',
  'plan_folders',
  'plan_templates',
  'ai_generations',
  'presentations',
  'rubrics',
  'students',
  'classes',
  'semesters',
  'jobs',
  'sessions',
  'calendar_feeds',
  'canva_connections',
  'classroom_connections',
  'microsoft_connections',
  'trial_reminders',
  'subscriptions',
  'password_tokens',
  'referral_codes',
  'audit_events',
  'school_deletion_requests',
  'users',
] as const satisfies readonly (keyof Database)[];

/**
 * Deletes a school in one transaction: the rows above (rows that hang off them, like attendance
 * entries and passwords, go with them), its stored files, whose keys all read
 * `<kind>/<schoolId>/...`, its invites, and the school itself. Only the ID-only proof stays.
 */
export class PostgresSchoolEraser implements SchoolEraser {
  constructor(private readonly db: Kysely<Database>) {}

  async erase(request: SchoolDeletionRequest, deletedAt: Date): Promise<void> {
    const { schoolId } = request;
    await this.db.transaction().execute(async (trx) => {
      for (const table of schoolTables) {
        await sql`DELETE FROM ${sql.table(table)} WHERE school_id = ${schoolId}`.execute(trx);
      }
      await trx
        .deleteFrom('referrals')
        .where((eb) =>
          eb.or([eb('referrer_school_id', '=', schoolId), eb('invited_school_id', '=', schoolId)]),
        )
        .execute();
      await trx
        .deleteFrom('stored_files')
        .where(sql<string>`split_part(key, '/', 2)`, '=', schoolId)
        .execute();
      await trx.deleteFrom('schools').where('id', '=', schoolId).execute();
      await trx
        .insertInto('school_deletions')
        .values({
          school_id: schoolId,
          requested_by: request.requestedBy,
          requested_at: request.requestedAt,
          deleted_at: deletedAt,
        })
        .onConflict((conflict) => conflict.column('school_id').doNothing())
        .execute();
    });
  }
}
