import {
  attendanceRate,
  attendanceSummary,
  type AttendanceSummary,
} from '../attendance/attendance-calculations.ts';
import type { AttendanceSession, AttendanceStatus } from '../attendance/attendance-session.ts';
import { missingAssignments } from '../command-center/at-risk.ts';
import { maxPoints, type Assignment } from '../gradebook/assignment.ts';
import type { WeightedCategory } from '../gradebook/grade-calculations.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import type { LetterGrade } from '../gradebook/letter-grade.ts';
import { studentGradeSummary } from '../gradebook/student-grades.ts';
import type { StudentId, StudentNoteId } from '../shared/ids.ts';
import { localDateIn, type LocalDate } from '../shared/local-date.ts';
import type { StudentNote } from './student-note.ts';

export type TimelineEvent =
  | {
      readonly kind: 'grade';
      readonly date: LocalDate | null;
      readonly title: string;
      readonly status: Exclude<GradeStatus, 'pending'>;
      readonly score: number | null;
      readonly maxPoints: number;
      readonly percentage: number | null;
    }
  | {
      readonly kind: 'attendance';
      readonly date: LocalDate;
      readonly status: Exclude<AttendanceStatus, 'present'>;
      readonly minutesLate: number | null;
      readonly note: string | null;
    }
  | {
      readonly kind: 'due';
      readonly date: LocalDate;
      readonly title: string;
      readonly graded: boolean;
    }
  | {
      readonly kind: 'note';
      readonly date: LocalDate;
      readonly noteId: StudentNoteId;
      readonly text: string;
    };

export interface Student360 {
  readonly stats: {
    readonly average: number | null;
    readonly letter: LetterGrade | null;
    readonly attendanceRate: number | null;
    readonly attendance: AttendanceSummary;
    readonly missing: number;
  };
  readonly missing: readonly Assignment[];
  /** Newest first; events without a date last. */
  readonly timeline: readonly TimelineEvent[];
}

const oneDecimal = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

/**
 * One student at a glance: the gradebook's weighted average, attendance from submitted sessions,
 * missing work, and a timeline of grades, absences, due dates and the teacher's notes.
 */
export function buildStudent360(input: {
  readonly studentId: StudentId;
  readonly categories: readonly WeightedCategory[];
  readonly assignments: readonly Assignment[];
  /** This student's grades. */
  readonly grades: readonly Grade[];
  readonly sessions: readonly AttendanceSession[];
  /** The viewer's notes about this student. */
  readonly notes: readonly StudentNote[];
  readonly today: LocalDate;
  readonly timeZone: string;
}): Student360 {
  const byId = new Map(input.assignments.map((a) => [a.id, a]));
  const gradeOf = new Map(input.grades.map((g) => [g.assignmentId, g]));
  const marks = input.sessions
    .filter((session) => session.status === 'submitted')
    .flatMap((session) => {
      const record = session.records.find((r) => r.studentId === input.studentId);
      return record === undefined ? [] : [{ date: session.date, ...record }];
    });
  const summary = studentGradeSummary(input.categories, input.assignments, input.grades);
  const attendance = attendanceSummary(marks.map((mark) => mark.status));
  const missing = missingAssignments(input.assignments, input.grades, input.today);

  const events: TimelineEvent[] = [
    ...input.grades.flatMap((grade): TimelineEvent[] => {
      const assignment = byId.get(grade.assignmentId);
      if (assignment === undefined || grade.status === 'pending') return [];
      const max = maxPoints(assignment);
      return [
        {
          kind: 'grade',
          date: assignment.dueDate,
          title: assignment.title,
          status: grade.status,
          score: grade.score,
          maxPoints: max,
          percentage:
            grade.score === null || max === 0 ? null : oneDecimal((grade.score / max) * 100),
        },
      ];
    }),
    ...marks.flatMap((mark): TimelineEvent[] =>
      mark.status === 'present'
        ? []
        : [
            {
              kind: 'attendance',
              date: mark.date,
              status: mark.status,
              minutesLate: mark.minutesLate,
              note: mark.note,
            },
          ],
    ),
    ...input.assignments.flatMap((assignment): TimelineEvent[] => {
      if (assignment.dueDate === null) return [];
      const grade = gradeOf.get(assignment.id);
      const graded = grade !== undefined && grade.status !== 'pending';
      return [{ kind: 'due', date: assignment.dueDate, title: assignment.title, graded }];
    }),
    ...input.notes.map((note): TimelineEvent => ({
      kind: 'note',
      date: localDateIn(note.createdAt, input.timeZone),
      noteId: note.id,
      text: note.text,
    })),
  ];

  return {
    stats: {
      average: oneDecimal(summary.overall),
      letter: summary.letter,
      attendanceRate: oneDecimal(attendanceRate(attendance)),
      attendance,
      missing: missing.length,
    },
    missing,
    timeline: events.sort((a, b) =>
      a.date === b.date
        ? 0
        : a.date === null
          ? 1
          : b.date === null
            ? -1
            : b.date.localeCompare(a.date),
    ),
  };
}
