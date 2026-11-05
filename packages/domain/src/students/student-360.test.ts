import { describe, expect, it } from 'vitest';
import type { AttendanceSession } from '../attendance/attendance-session.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import type {
  AssignmentId,
  AttendanceSessionId,
  ClassId,
  GradeCategoryId,
  GradeId,
  SchoolId,
  StudentId,
  StudentNoteId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { buildStudent360 } from './student-360.ts';
import { createStudentNote, type StudentNote } from './student-note.ts';

const studentId = 'st1' as StudentId;
const category = 'cat' as GradeCategoryId;
const today = '2026-11-05' as LocalDate;

const assignment = (n: number, points: number, dueDate: string | null): Assignment => ({
  id: `a${String(n)}` as AssignmentId,
  schoolId: 's1' as SchoolId,
  classId: 'c1' as ClassId,
  categoryId: category,
  title: `Assignment ${String(n)}`,
  points,
  dueDate: dueDate as LocalDate | null,
  instructions: null,
  questions: [],
});

const grade = (n: number, status: GradeStatus, score: number | null): Grade => ({
  id: `g${String(n)}` as GradeId,
  schoolId: 's1' as SchoolId,
  studentId,
  assignmentId: `a${String(n)}` as AssignmentId,
  status,
  score,
  source: 'manual',
  gradedBy: 'u1' as UserId,
  comment: null,
});

const session = (
  date: string,
  status: 'present' | 'absent' | 'tardy' | 'excused',
  submitted = true,
  extra: { minutesLate?: number; note?: string } = {},
): AttendanceSession => ({
  id: `s-${date}` as AttendanceSessionId,
  schoolId: 's1' as SchoolId,
  classId: 'c1' as ClassId,
  date: date as LocalDate,
  status: submitted ? 'submitted' : 'open',
  roster: [studentId],
  records: [
    { studentId, status, minutesLate: extra.minutesLate ?? null, note: extra.note ?? null },
  ],
});

const note = (text: string, at: string): StudentNote => ({
  id: `n-${at}` as StudentNoteId,
  schoolId: 's1' as SchoolId,
  studentId,
  authorId: 'u1' as UserId,
  text,
  createdAt: new Date(at),
});

const build = () =>
  buildStudent360({
    studentId,
    categories: [{ id: category, weightPercent: 100 }],
    assignments: [
      assignment(1, 10, '2026-10-20'),
      assignment(2, 20, '2026-10-28'),
      assignment(3, 10, '2026-11-02'),
      assignment(4, 10, '2026-11-20'),
      assignment(5, 10, null),
    ],
    grades: [grade(1, 'graded', 8), grade(2, 'late', 10), grade(5, 'pending', null)],
    sessions: [
      session('2026-10-21', 'present'),
      session('2026-10-22', 'tardy', true, { minutesLate: 10 }),
      session('2026-10-23', 'absent', true, { note: 'Sick' }),
      session('2026-10-24', 'excused'),
      session('2026-10-27', 'absent', false),
    ],
    notes: [note('Talked with mom.', '2026-10-25T15:00:00Z')],
    today,
    timeZone: 'America/Puerto_Rico',
  });

describe('buildStudent360', () => {
  it('sums up the weighted average, attendance and missing work', () => {
    const view = build();
    expect(view.stats).toEqual({
      average: 60,
      letter: 'D',
      attendanceRate: 50,
      attendance: { present: 1, absent: 1, tardy: 1, excused: 1, total: 4 },
      missing: 1,
    });
    expect(view.missing.map((a) => a.id)).toEqual(['a3']);
  });

  it('lists what happened, newest first, with undated items last', () => {
    const view = build();
    expect(view.timeline.map((event) => [event.kind, event.date])).toEqual([
      ['due', '2026-11-20'],
      ['due', '2026-11-02'],
      ['grade', '2026-10-28'],
      ['due', '2026-10-28'],
      ['note', '2026-10-25'],
      ['attendance', '2026-10-24'],
      ['attendance', '2026-10-23'],
      ['attendance', '2026-10-22'],
      ['grade', '2026-10-20'],
      ['due', '2026-10-20'],
    ]);
    expect(view.timeline).toContainEqual({
      kind: 'grade',
      date: '2026-10-28',
      title: 'Assignment 2',
      status: 'late',
      score: 10,
      maxPoints: 20,
      percentage: 50,
    });
    expect(view.timeline).toContainEqual({
      kind: 'attendance',
      date: '2026-10-22',
      status: 'tardy',
      minutesLate: 10,
      note: null,
    });
    expect(view.timeline).toContainEqual({
      kind: 'due',
      date: '2026-11-02',
      title: 'Assignment 3',
      graded: false,
    });
    expect(view.timeline).toContainEqual({
      kind: 'note',
      date: '2026-10-25',
      noteId: 'n-2026-10-25T15:00:00Z',
      text: 'Talked with mom.',
    });
  });

  it('has no average or rate without grades or sessions', () => {
    const view = buildStudent360({
      studentId,
      categories: [],
      assignments: [],
      grades: [],
      sessions: [],
      notes: [],
      today,
      timeZone: 'UTC',
    });
    expect(view.stats).toEqual({
      average: null,
      letter: null,
      attendanceRate: null,
      attendance: { present: 0, absent: 0, tardy: 0, excused: 0, total: 0 },
      missing: 0,
    });
    expect(view.timeline).toEqual([]);
  });
});

describe('createStudentNote', () => {
  const input = {
    id: 'n1' as StudentNoteId,
    schoolId: 's1' as SchoolId,
    studentId,
    authorId: 'u1' as UserId,
    createdAt: new Date('2026-11-05T12:00:00Z'),
  };

  it('keeps a trimmed note', () => {
    expect(createStudentNote({ ...input, text: '  Needs extra time.  ' })).toEqual({
      ok: true,
      value: { ...input, text: 'Needs extra time.' },
    });
  });

  it('refuses a blank or too long note', () => {
    expect(createStudentNote({ ...input, text: ' ' })).toEqual({
      ok: false,
      error: { field: 'text', code: 'required' },
    });
    expect(createStudentNote({ ...input, text: 'x'.repeat(2001) })).toEqual({
      ok: false,
      error: { field: 'text', code: 'too_long' },
    });
  });
});
