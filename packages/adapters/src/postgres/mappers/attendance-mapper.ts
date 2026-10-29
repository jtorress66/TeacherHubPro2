import type { Selectable } from 'kysely';
import {
  attendanceStatuses,
  sessionStatuses,
  type AttendanceSession,
  type AttendanceSessionId,
  type ClassId,
  type SchoolId,
  type StudentId,
} from '@thp/domain';
import type { AttendanceEntriesTable, AttendanceSessionsTable } from '../schema.ts';
import { localDate, oneOf, type Row } from './columns.ts';

export interface AttendanceRows {
  readonly session: Row<AttendanceSessionsTable>;
  readonly entries: readonly Row<AttendanceEntriesTable>[];
}

/** A session is one row plus one entry per rostered student (in roster order). */
export const attendanceMapper = {
  toRows(session: AttendanceSession): AttendanceRows {
    const statusOf = new Map(session.records.map((record) => [record.studentId, record.status]));
    return {
      session: {
        id: session.id,
        school_id: session.schoolId,
        class_id: session.classId,
        date: session.date,
        status: session.status,
      },
      entries: session.roster.map((studentId, position) => ({
        session_id: session.id,
        student_id: studentId,
        position,
        status: statusOf.get(studentId) ?? null,
      })),
    };
  },

  fromRows(
    row: Selectable<AttendanceSessionsTable>,
    entries: readonly Selectable<AttendanceEntriesTable>[],
  ): AttendanceSession {
    const ordered = [...entries].sort((a, b) => a.position - b.position);
    return {
      id: row.id as AttendanceSessionId,
      schoolId: row.school_id as SchoolId,
      classId: row.class_id as ClassId,
      date: localDate(row.date, 'attendance_sessions.date'),
      status: oneOf(sessionStatuses, row.status, 'attendance_sessions.status'),
      roster: ordered.map((entry) => entry.student_id as StudentId),
      records: ordered.flatMap((entry) =>
        entry.status === null
          ? []
          : [
              {
                studentId: entry.student_id as StudentId,
                status: oneOf(attendanceStatuses, entry.status, 'attendance_entries.status'),
              },
            ],
      ),
    };
  },
};
