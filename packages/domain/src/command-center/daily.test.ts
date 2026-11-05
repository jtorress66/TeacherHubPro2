import { describe, expect, it } from 'vitest';
import type { Class } from '../classes/class.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import type { LessonPlan } from '../lesson-plans/lesson-plan.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  GradeId,
  LessonPlanId,
  SchoolId,
  StudentId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import type { TimeOfDay } from '../shared/time-of-day.ts';
import type { Weekday } from '../shared/weekday.ts';
import type { SubmissionStatus } from '../submissions/submission.ts';
import { classesToday, weekdayOf } from './today.ts';
import { toGrade } from './to-grade.ts';
import { upcomingLessons } from './upcoming.ts';
import { recommendations } from './recommendations.ts';

const today = '2026-11-05' as LocalDate; // a Thursday

const aClass = (
  id: string,
  schedule: { period?: number; startTime?: string; days?: Weekday[] } | null = {},
): Class => ({
  id: id as ClassId,
  schoolId: 's1' as SchoolId,
  teacherId: 'u1' as UserId,
  name: `Class ${id}`,
  subject: null,
  grade: null,
  section: null,
  schoolYear: null,
  semesterId: null,
  schedule:
    schedule === null
      ? null
      : {
          period: schedule.period ?? null,
          startTime: (schedule.startTime ?? null) as TimeOfDay | null,
          endTime: null,
          days: schedule.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        },
  archivedAt: null,
});

describe('weekdayOf', () => {
  it('names the day of a date', () => {
    expect(weekdayOf(today)).toBe('Thu');
    expect(weekdayOf('2026-11-08' as LocalDate)).toBe('Sun');
  });
});

describe('classesToday', () => {
  it('keeps the classes that meet today, by period and then start time', () => {
    const classes = [
      aClass('late', { period: 3 }),
      aClass('weekend', { days: ['Sat', 'Sun'] }),
      aClass('no-period', { startTime: '13:00' }),
      aClass('early', { period: 1, startTime: '08:00' }),
      aClass('same-period-later', { period: 1, startTime: '09:00' }),
      aClass('no-schedule', null),
    ];
    expect(classesToday(classes, 'Thu').map((c) => c.id)).toEqual([
      'early',
      'same-period-later',
      'late',
      'no-period',
      'no-schedule',
    ]);
    expect(classesToday(classes, 'Sat').map((c) => c.id)).toEqual(['weekend']);
  });
});

const assignment = (n: number, dueDate: string | null): Assignment => ({
  id: `a${String(n)}` as AssignmentId,
  schoolId: 's1' as SchoolId,
  classId: 'c1' as ClassId,
  categoryId: 'cat' as GradeCategoryId,
  title: `Assignment ${String(n)}`,
  points: 10,
  dueDate: dueDate as LocalDate | null,
  instructions: null,
  questions: [],
});
const student = (n: number) => `st${String(n)}` as StudentId;
const grade = (a: number, s: number, status: GradeStatus = 'graded'): Grade => ({
  id: `g${String(a)}-${String(s)}` as GradeId,
  schoolId: 's1' as SchoolId,
  studentId: student(s),
  assignmentId: `a${String(a)}` as AssignmentId,
  status,
  score: status === 'graded' ? 5 : null,
  source: 'manual',
  gradedBy: 'u1' as UserId,
  comment: null,
});
const submission = (a: number, s: number, status: SubmissionStatus) => ({
  assignmentId: `a${String(a)}` as AssignmentId,
  studentId: student(s),
  status,
});

describe('toGrade', () => {
  const roster = [student(1), student(2), student(3)];

  it('counts handed-in work waiting for the teacher, and past-due students with no grade', () => {
    const items = toGrade({
      assignments: [assignment(1, '2026-11-01'), assignment(2, '2026-11-20'), assignment(3, null)],
      roster,
      grades: [grade(1, 1), grade(1, 2, 'excused')],
      submissions: [
        submission(2, 1, 'submitted'),
        submission(2, 2, 'ai_graded'),
        submission(2, 3, 'confirmed'),
      ],
      today,
    });
    expect(items).toEqual([
      { assignment: assignment(1, '2026-11-01'), waiting: 0, ungraded: 1, overdue: true },
      { assignment: assignment(2, '2026-11-20'), waiting: 2, ungraded: 0, overdue: false },
    ]);
  });

  it('puts overdue work first, then by due date, at most ten', () => {
    const assignments = Array.from({ length: 12 }, (_, i) =>
      assignment(i + 1, `2026-11-${String(10 + i)}`),
    );
    const late = assignment(99, '2026-10-01');
    const items = toGrade({
      assignments: [...assignments, late],
      roster,
      grades: [],
      submissions: assignments.map((a, i) => submission(i + 1, 1, 'submitted')),
      today,
    });
    expect(items).toHaveLength(10);
    expect(items[0]?.assignment.id).toBe('a99');
    expect(items[1]?.assignment.id).toBe('a1');
  });
});

const plan = (id: string, start: string, end: string, classId: string | null = 'c1') =>
  ({
    id: id as LessonPlanId,
    classId: classId as ClassId | null,
    span: { start: start as LocalDate, end: end as LocalDate },
  }) as unknown as Pick<LessonPlan, 'id' | 'classId'> & {
    span: { start: LocalDate; end: LocalDate };
  };

describe('upcomingLessons', () => {
  it('keeps plans that overlap the next seven days, soonest first', () => {
    const plans = [
      plan('next-week', '2026-11-09', '2026-11-13'),
      plan('this-week', '2026-11-02', '2026-11-06'),
      plan('later', '2026-11-16', '2026-11-20'),
      plan('past', '2026-10-26', '2026-10-30'),
    ];
    expect(upcomingLessons(plans, today).map((p) => p.id)).toEqual(['this-week', 'next-week']);
  });
});

describe('recommendations', () => {
  it('suggests what to do next, most urgent first', () => {
    expect(
      recommendations({
        attendanceToTake: 2,
        highRisk: 1,
        overdueGrading: 3,
        classesWithoutPlans: 1,
      }),
    ).toEqual([
      { kind: 'attendance', priority: 'high', count: 2 },
      { kind: 'intervention', priority: 'high', count: 1 },
      { kind: 'grading', priority: 'medium', count: 3 },
      { kind: 'planning', priority: 'low', count: 1 },
    ]);
  });

  it('suggests nothing when everything is done', () => {
    expect(
      recommendations({
        attendanceToTake: 0,
        highRisk: 0,
        overdueGrading: 0,
        classesWithoutPlans: 0,
      }),
    ).toEqual([]);
  });
});
