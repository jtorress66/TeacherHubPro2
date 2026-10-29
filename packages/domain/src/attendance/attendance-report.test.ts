import { describe, expect, it } from 'vitest';
import {
  type AttendanceSessionId,
  type ClassId,
  type SchoolId,
  type StudentId,
} from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { classAttendanceReport, createDateRange, inRange } from './attendance-report.ts';
import {
  markAll,
  markAttendance,
  openAttendanceSession,
  submitAttendance,
  type AttendanceSession,
  type AttendanceStatus,
} from './attendance-session.ts';

const ana = 'ana' as StudentId;
const ben = 'ben' as StudentId;
const cara = 'cara' as StudentId;

/** A submitted session on `date`; everyone present unless listed in `marks`. */
function day(
  date: string,
  roster: StudentId[],
  marks: Partial<Record<string, AttendanceStatus>> = {},
): AttendanceSession {
  let session = valueOf(
    openAttendanceSession({
      id: `att-${date}` as AttendanceSessionId,
      schoolId: 'school-1' as SchoolId,
      classId: 'class-1' as ClassId,
      date,
      roster,
    }),
  );
  session = valueOf(markAll(session, 'present'));
  for (const [studentId, status] of Object.entries(marks)) {
    if (status) session = valueOf(markAttendance(session, studentId as StudentId, status));
  }
  return valueOf(submitAttendance(session));
}

const september = valueOf(createDateRange('2026-09-01', '2026-09-30'));

describe('createDateRange', () => {
  it('accepts a range whose start is on or before its end', () => {
    expect(valueOf(createDateRange('2026-09-01', '2026-09-01'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-01',
    });
  });

  it('refuses bad dates and a start after the end', () => {
    expect(errorOf(createDateRange('1/9/2026', '2026-09-30'))).toEqual({
      field: 'from',
      code: 'invalid_format',
    });
    expect(errorOf(createDateRange('2026-09-01', 'soon'))).toEqual({
      field: 'to',
      code: 'invalid_format',
    });
    expect(errorOf(createDateRange('2026-09-30', '2026-09-01'))).toEqual({
      field: 'to',
      code: 'invalid_order',
    });
  });

  it('includes both ends of the range', () => {
    const date = (value: string) => day(value, []).date;
    expect(inRange(date('2026-09-01'), september)).toBe(true);
    expect(inRange(date('2026-09-30'), september)).toBe(true);
    expect(inRange(date('2026-08-31'), september)).toBe(false);
    expect(inRange(date('2026-10-01'), september)).toBe(false);
  });
});

describe('classAttendanceReport', () => {
  it('counts each student’s statuses and rate over submitted days', () => {
    const sessions = [
      day('2026-09-14', [ana, ben], { ben: 'absent' }),
      day('2026-09-15', [ana, ben], { ana: 'tardy', ben: 'excused' }),
    ];

    const report = classAttendanceReport(sessions, [ana, ben], september);

    expect(report.students).toEqual([
      {
        studentId: ana,
        summary: { present: 1, absent: 0, tardy: 1, excused: 0, total: 2 },
        rate: 100,
      },
      {
        studentId: ben,
        summary: { present: 0, absent: 1, tardy: 0, excused: 1, total: 2 },
        rate: 0,
      },
    ]);
    expect(report.days).toBe(2);
    expect(report.summary).toEqual({ present: 1, absent: 1, tardy: 1, excused: 1, total: 4 });
    expect(report.rate).toBe(50);
  });

  it('counts a tardy as present in the attendance rate', () => {
    const report = classAttendanceReport(
      [day('2026-09-14', [ana], { ana: 'tardy' })],
      [ana],
      september,
    );
    expect(report.students[0]?.rate).toBe(100);
  });

  it('leaves out days that were not submitted', () => {
    const saved = valueOf(
      markAll(
        valueOf(
          openAttendanceSession({
            id: 'att-open' as AttendanceSessionId,
            schoolId: 'school-1' as SchoolId,
            classId: 'class-1' as ClassId,
            date: '2026-09-16',
            roster: [ana],
          }),
        ),
        'absent',
      ),
    );

    const report = classAttendanceReport([day('2026-09-14', [ana]), saved], [ana], september);

    expect(report.days).toBe(1);
    expect(report.students[0]?.summary.total).toBe(1);
  });

  it('counts only the days a student was on the roster', () => {
    const sessions = [day('2026-09-14', [ana]), day('2026-09-15', [ana, cara], { cara: 'absent' })];

    const report = classAttendanceReport(sessions, [ana, cara], september);

    expect(report.students[1]).toEqual({
      studentId: cara,
      summary: { present: 0, absent: 1, tardy: 0, excused: 0, total: 1 },
      rate: 0,
    });
  });

  it('leaves out days outside the range', () => {
    const sessions = [day('2026-08-31', [ana], { ana: 'absent' }), day('2026-09-01', [ana])];

    const report = classAttendanceReport(sessions, [ana], september);

    expect(report.days).toBe(1);
    expect(report.students[0]?.rate).toBe(100);
  });

  it('has null rates when nothing was submitted in the range', () => {
    const report = classAttendanceReport([], [ana], september);

    expect(report.days).toBe(0);
    expect(report.rate).toBeNull();
    expect(report.students[0]?.rate).toBeNull();
  });
});
