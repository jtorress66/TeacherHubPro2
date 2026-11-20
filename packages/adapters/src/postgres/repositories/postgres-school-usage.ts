import { sql, type Kysely } from 'kysely';
import type { TeacherUsage, UserId } from '@thp/domain';
import type { SchoolUsageQuery, SchoolUsageReport } from '@thp/ports';
import type { Database } from '../schema.ts';

/** The overview's counts, one row per person in the school, in a single query. */
export class PostgresSchoolUsageReport implements SchoolUsageReport {
  constructor(private readonly db: Kysely<Database>) {}

  async forSchool({
    schoolId,
    since,
    aiJobKinds,
  }: SchoolUsageQuery): Promise<readonly TeacherUsage[]> {
    const sinceDay = since.toISOString().slice(0, 10);
    // Real classes only: sample classes are made up, archived ones are put away.
    const ownClasses = sql`select c.id from classes c
      where c.teacher_id = u.id and c.school_id = u.school_id
        and not c.sample and c.archived_at is null`;
    const aiKinds = aiJobKinds.length > 0 ? aiJobKinds : [''];
    const rows = await this.db
      .selectFrom('users as u')
      .where('u.school_id', '=', schoolId)
      .select([
        'u.id',
        'u.name',
        sql<Date | null>`(select max(s.last_seen_at) from sessions s where s.user_id = u.id)`.as(
          'last_active_at',
        ),
        sql<string>`(select count(*) from (${ownClasses}) own)`.as('classes'),
        sql<string>`(select count(*) from students st
          where st.class_id in (${ownClasses}))`.as('students'),
        sql<string>`(select count(*) from jobs j
          where j.owner_id = u.id and j.school_id = u.school_id and j.created_at >= ${since}
            and j.kind in (${sql.join(aiKinds)}))`.as('ai_drafts'),
        sql<string>`(select count(*) from attendance_sessions a
          where a.class_id in (${ownClasses}) and a.date >= ${sinceDay})`.as('attendance_days'),
        sql<string>`(select count(*) from assignments a
          where a.class_id in (${ownClasses}) and a.created_at >= ${since})`.as('assignments'),
      ])
      .orderBy('u.name')
      .execute();
    return rows.map((row) => ({
      teacherId: row.id as UserId,
      name: row.name,
      lastActiveAt: row.last_active_at,
      classes: Number(row.classes),
      students: Number(row.students),
      aiDrafts: Number(row.ai_drafts),
      attendanceDays: Number(row.attendance_days),
      assignments: Number(row.assignments),
    }));
  }
}
