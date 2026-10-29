import { describe, expect, it } from 'vitest';
import {
  type AttendanceSessionId,
  type ClassId,
  type SchoolId,
  type StudentId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { attendanceRate, attendanceSummary, studentStatuses } from './attendance-calculations.ts';
import {
  applyMarks,
  markAll,
  markAttendance,
  openAttendanceSession,
  recordOf,
  syncRoster,
  reopenAttendance,
  statusOf,
  submitAttendance,
  type AttendanceSession,
} from './attendance-session.ts';

const ana = 'ana' as StudentId;
const ben = 'ben' as StudentId;
const base = {
  id: 'att-1' as AttendanceSessionId,
  schoolId: 'school-1' as SchoolId,
  classId: 'class-1' as ClassId,
  date: '2026-09-14',
  roster: [ana, ben],
};
const open = (): AttendanceSession => valueOf(openAttendanceSession(base));

describe('openAttendanceSession', () => {
  it('opens a session for a class and date with nobody marked', () => {
    expect(open()).toEqual({ ...base, status: 'open', records: [] });
  });

  it('rejects a bad date and a student listed twice', () => {
    expect(errorOf(openAttendanceSession({ ...base, date: '14/09/2026' }))).toEqual({
      field: 'date',
      code: 'invalid_format',
    });
    expect(errorOf(openAttendanceSession({ ...base, roster: [ana, ana] }))).toEqual({
      field: 'roster',
      code: 'duplicate',
    });
  });
});

describe('marking and submitting', () => {
  it('marks each student and changes a mark', () => {
    let session = valueOf(markAttendance(open(), ana, 'absent'));
    session = valueOf(markAttendance(session, ana, 'tardy'));

    expect(statusOf(session, ana)).toBe('tardy');
    expect(statusOf(session, ben)).toBeNull();
  });

  it('cannot mark a student who is not on the roster', () => {
    expect(errorOf(markAttendance(open(), 'zed' as StudentId, 'present'))).toEqual({
      code: 'not_in_roster',
      studentId: 'zed',
    });
  });

  it('submit needs every student marked', () => {
    const session = valueOf(markAttendance(open(), ana, 'present'));
    expect(errorOf(submitAttendance(session))).toEqual({ code: 'incomplete', unmarked: [ben] });
  });

  it('submits once everyone is marked', () => {
    let session = valueOf(markAttendance(open(), ana, 'present'));
    session = valueOf(markAttendance(session, ben, 'excused'));

    expect(valueOf(submitAttendance(session)).status).toBe('submitted');
  });

  it('cannot mark after submit, or submit twice', () => {
    const empty = valueOf(openAttendanceSession({ ...base, roster: [] }));
    const submitted = valueOf(submitAttendance(empty));

    expect(errorOf(markAttendance(submitted, ana, 'present'))).toEqual({
      code: 'invalid_transition',
      from: 'submitted',
      action: 'mark',
    });
    expect(errorOf(submitAttendance(submitted))).toEqual({
      code: 'invalid_transition',
      from: 'submitted',
      action: 'submit',
    });
  });

  it('reopen allows marking again', () => {
    let session = valueOf(markAttendance(open(), ana, 'present'));
    session = valueOf(markAttendance(session, ben, 'present'));
    session = valueOf(reopenAttendance(valueOf(submitAttendance(session))));

    expect(session.status).toBe('open');
    expect(statusOf(valueOf(markAttendance(session, ben, 'absent')), ben)).toBe('absent');
  });

  it('cannot reopen a session that is already open', () => {
    expect(errorOf(reopenAttendance(open()))).toEqual({
      code: 'invalid_transition',
      from: 'open',
      action: 'reopen',
    });
  });
});

describe('notes and minutes late', () => {
  it('keeps a trimmed note and the minutes a tardy student was late', () => {
    const session = valueOf(
      markAttendance(open(), ana, 'tardy', { minutesLate: 5, note: '  Bus was late  ' }),
    );
    expect(recordOf(session, ana)).toEqual({
      studentId: ana,
      status: 'tardy',
      minutesLate: 5,
      note: 'Bus was late',
    });
  });

  it('stores a blank note and missing details as null', () => {
    const session = valueOf(markAttendance(open(), ana, 'absent', { note: '   ' }));
    expect(recordOf(session, ana)).toEqual({
      studentId: ana,
      status: 'absent',
      minutesLate: null,
      note: null,
    });
    expect(recordOf(session, ben)).toBeNull();
  });

  it('refuses a note over 200 characters', () => {
    expect(errorOf(markAttendance(open(), ana, 'present', { note: 'x'.repeat(201) }))).toEqual({
      field: 'note',
      code: 'too_long',
    });
  });

  it('allows minutes late only on a tardy, from 1 to 240', () => {
    expect(errorOf(markAttendance(open(), ana, 'present', { minutesLate: 5 }))).toEqual({
      field: 'minutesLate',
      code: 'not_allowed',
    });
    for (const minutesLate of [0, 241, 2.5]) {
      expect(errorOf(markAttendance(open(), ana, 'tardy', { minutesLate }))).toEqual({
        field: 'minutesLate',
        code: 'out_of_range',
      });
    }
    expect(
      recordOf(valueOf(markAttendance(open(), ana, 'tardy', { minutesLate: 240 })), ana),
    ).toMatchObject({ minutesLate: 240 });
  });
});

describe('markAll', () => {
  it('marks every student on the roster, replacing earlier marks and details', () => {
    const marked = valueOf(markAttendance(open(), ana, 'tardy', { minutesLate: 3, note: 'x' }));
    const session = valueOf(markAll(marked, 'present'));

    expect(session.records).toEqual([
      { studentId: ana, status: 'present', minutesLate: null, note: null },
      { studentId: ben, status: 'present', minutesLate: null, note: null },
    ]);
  });

  it('cannot change a submitted session', () => {
    const submitted = valueOf(submitAttendance(valueOf(markAll(open(), 'present'))));
    expect(errorOf(markAll(submitted, 'absent'))).toEqual({
      code: 'invalid_transition',
      from: 'submitted',
      action: 'mark',
    });
  });
});

describe('applyMarks', () => {
  it('applies every mark with its details', () => {
    const session = valueOf(
      applyMarks(open(), [
        { studentId: ana, status: 'tardy', minutesLate: 4 },
        { studentId: ben, status: 'absent', note: 'Sick' },
      ]),
    );
    expect(session.records).toEqual([
      { studentId: ana, status: 'tardy', minutesLate: 4, note: null },
      { studentId: ben, status: 'absent', minutesLate: null, note: 'Sick' },
    ]);
  });

  it('stops at the first bad mark', () => {
    expect(
      errorOf(
        applyMarks(open(), [
          { studentId: ana, status: 'present' },
          { studentId: 'zed' as StudentId, status: 'present' },
        ]),
      ),
    ).toEqual({ code: 'not_in_roster', studentId: 'zed' });
  });

  it('refuses a submitted session even with no marks', () => {
    const submitted = valueOf(submitAttendance(valueOf(markAll(open(), 'present'))));
    expect(errorOf(applyMarks(submitted, []))).toEqual({
      code: 'invalid_transition',
      from: 'submitted',
      action: 'mark',
    });
  });
});

describe('syncRoster', () => {
  const cara = 'cara' as StudentId;

  it('adds new students and drops removed ones while the session is open', () => {
    const marked = valueOf(markAll(open(), 'absent'));
    const synced = syncRoster(marked, [ben, cara]);

    expect(synced.roster).toEqual([ben, cara]);
    expect(synced.records).toEqual([
      { studentId: ben, status: 'absent', minutesLate: null, note: null },
    ]);
  });

  it('leaves a submitted session as it was taken', () => {
    const submitted = valueOf(submitAttendance(valueOf(markAll(open(), 'present'))));
    expect(syncRoster(submitted, [cara])).toBe(submitted);
  });
});

describe('attendance calculations', () => {
  it('counts each status', () => {
    expect(attendanceSummary(['present', 'tardy', 'absent', 'excused', 'present'])).toEqual({
      present: 2,
      tardy: 1,
      absent: 1,
      excused: 1,
      total: 5,
    });
  });

  it('counts a tardy as present in the attendance rate', () => {
    expect(attendanceRate(attendanceSummary(['present', 'tardy', 'absent', 'absent']))).toBe(50);
  });

  it('counts excused days in the total, as the original app did', () => {
    expect(attendanceRate(attendanceSummary(['present', 'excused']))).toBe(50);
  });

  it('is null with no sessions', () => {
    expect(attendanceRate(attendanceSummary([]))).toBeNull();
  });

  it('skips sessions where the student was not on the roster', () => {
    const before = valueOf(openAttendanceSession({ ...base, roster: [ana] }));
    const submitted = valueOf(submitAttendance(valueOf(markAttendance(before, ana, 'present'))));

    expect(studentStatuses([submitted], ben)).toEqual([]);
  });

  it('collects a student’s statuses from submitted sessions only', () => {
    let monday = valueOf(markAttendance(open(), ana, 'present'));
    monday = valueOf(submitAttendance(valueOf(markAttendance(monday, ben, 'absent'))));
    const tuesday = valueOf(
      markAttendance(valueOf(openAttendanceSession({ ...base, date: '2026-09-15' })), ana, 'tardy'),
    );

    expect(studentStatuses([monday, tuesday], ben)).toEqual(['absent']);
    expect(studentStatuses([monday, tuesday], ana)).toEqual(['present']);
  });
});
