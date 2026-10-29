import type { Kysely, Selectable } from 'kysely';
import type {
  AttendanceSession,
  AttendanceSessionId,
  ClassId,
  LocalDate,
  SchoolId,
} from '@thp/domain';
import type { AttendanceSessionRepository } from '@thp/ports';
import { attendanceMapper } from '../mappers/attendance-mapper.ts';
import type { AttendanceSessionsTable, Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

/** A session row plus one entry per rostered student, saved together. */
export class PostgresAttendanceSessionRepository implements AttendanceSessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: AttendanceSessionId): Promise<AttendanceSession | null> {
    const row = await this.db
      .selectFrom('attendance_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : this.withEntries(row);
  }

  async save(session: AttendanceSession): Promise<void> {
    const { session: row, entries } = attendanceMapper.toRows(session);
    await this.db.transaction().execute(async (trx) => {
      await upsert(trx, 'attendance_sessions', row);
      await trx.deleteFrom('attendance_entries').where('session_id', '=', session.id).execute();
      if (entries.length > 0)
        await trx
          .insertInto('attendance_entries')
          .values([...entries])
          .execute();
    });
  }

  async findByClassAndDate(
    schoolId: SchoolId,
    classId: ClassId,
    date: LocalDate,
  ): Promise<AttendanceSession | null> {
    const row = await this.db
      .selectFrom('attendance_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .where('date', '=', date)
      .executeTakeFirst();
    return row === undefined ? null : this.withEntries(row);
  }

  async listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly AttendanceSession[]> {
    const rows = await this.db
      .selectFrom('attendance_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId)
      .orderBy('date')
      .orderBy('id')
      .execute();
    return Promise.all(rows.map((row) => this.withEntries(row)));
  }

  private async withEntries(row: Selectable<AttendanceSessionsTable>): Promise<AttendanceSession> {
    const entries = await this.db
      .selectFrom('attendance_entries')
      .selectAll()
      .where('session_id', '=', row.id)
      .orderBy('position')
      .execute();
    return attendanceMapper.fromRows(row, entries);
  }
}
