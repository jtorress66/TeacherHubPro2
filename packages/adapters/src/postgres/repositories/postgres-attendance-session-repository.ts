import type { Kysely, Selectable } from 'kysely';
import type {
  AttendanceSession,
  AttendanceSessionId,
  ClassId,
  DateRange,
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

  async listByClass(
    schoolId: SchoolId,
    classId: ClassId,
    range?: DateRange,
  ): Promise<readonly AttendanceSession[]> {
    let query = this.db
      .selectFrom('attendance_sessions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('class_id', '=', classId);
    if (range !== undefined)
      query = query.where('date', '>=', range.from).where('date', '<=', range.to);
    const rows = await query.orderBy('date').orderBy('id').execute();
    if (rows.length === 0) return [];
    const entries = await this.db
      .selectFrom('attendance_entries')
      .selectAll()
      .where(
        'session_id',
        'in',
        rows.map((row) => row.id),
      )
      .execute();
    return rows.map((row) =>
      attendanceMapper.fromRows(
        row,
        entries.filter((entry) => entry.session_id === row.id),
      ),
    );
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
