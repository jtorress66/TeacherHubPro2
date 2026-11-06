import {
  markAttendance,
  maxMinutesLate,
  openAttendanceSession,
  submitAttendance,
  type AttendanceSession,
  type AttendanceSessionId,
  type AttendanceStatus,
} from '@thp/domain';
import { day, number, records, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper } from './migration-set.ts';

const oldStatuses: Readonly<Record<string, AttendanceStatus>> = {
  present: 'present',
  absent: 'absent',
  tardy: 'tardy',
  late: 'tardy',
  excused: 'excused',
};

/**
 * A submitted session keeps the students who were marked that day; an open one also lists the
 * class's current roster, as the new app does. One session per class and date (the latest wins).
 */
export const attendanceMapper: LegacyMapper = {
  collection: 'attendance_sessions',
  map(docs, { set, tally }) {
    const note = (reason: string) => {
      tally.noted('attendance_sessions', reason);
    };
    for (const doc of docs) {
      const id = text(doc, 'session_id');
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      const date = day(doc, 'date');
      if (id === null || cls === undefined || date === null) {
        tally.skipped(
          'attendance_sessions',
          id === null ? 'missing_id' : cls === undefined ? 'class_not_found' : 'missing_date',
        );
        continue;
      }
      const marks = records(doc, 'records').flatMap((record) => {
        const student = set.student(text(record, 'student_id'), cls.id);
        const status = oldStatuses[text(record, 'status') ?? ''];
        if (student === null) note('record_student_not_found');
        else if (status === undefined) note('record_status_unknown');
        if (student === null || status === undefined) return [];
        const minutes = status === 'tardy' ? number(record, 'minutes_late') : null;
        const fits = minutes !== null && minutes >= 1 && minutes <= maxMinutesLate;
        return [
          {
            studentId: student.id,
            status,
            minutesLate: fits ? Math.round(minutes) : null,
            note: text(record, 'note')?.slice(0, 200) ?? null,
          },
        ];
      });
      const submitted = text(doc, 'status') === 'submitted';
      const marked = marks.map((mark) => mark.studentId);
      const roster = submitted
        ? marked
        : [...new Set([...set.roster(cls.id).map((s) => s.id), ...marked])];
      const opened = openAttendanceSession({
        id: id as AttendanceSessionId,
        schoolId: cls.schoolId,
        classId: cls.id,
        date,
        roster: [...new Set(roster)],
      });
      if (!opened.ok) {
        tally.skipped('attendance_sessions', invalidReason(opened.error));
        continue;
      }
      let session: AttendanceSession = opened.value;
      for (const { studentId, status, ...details } of marks) {
        const next = markAttendance(session, studentId, status, details);
        if (next.ok) session = next.value;
        else note('record_dropped');
      }
      if (submitted && session.roster.length > 0) {
        const done = submitAttendance(session);
        if (done.ok) session = done.value;
      }
      const key = `${cls.id}|${date}`;
      if (set.attendance.has(key)) note('replaced_same_day_session');
      set.attendance.set(key, session);
      tally.imported('attendance_sessions');
    }
  },
};
