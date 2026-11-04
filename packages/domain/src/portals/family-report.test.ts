import { describe, expect, it } from 'vitest';
import type { AttendanceSession, AttendanceStatus } from '../attendance/attendance-session.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import type { GamePlay } from '../games/game-play.ts';
import type { AssignmentId, GradeCategoryId, SchoolId, StudentId, UserId } from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { buildFamilyReport, type FamilyReportInput } from './family-report.ts';
import { isUsable, revokeLink } from '../assignments/student-link.ts';
import { createPortalLink, type PortalLink } from './portal-link.ts';

const ana = 'student-ana' as StudentId;
const homework = 'cat-homework' as GradeCategoryId;
const tests = 'cat-tests' as GradeCategoryId;

const assignment = (
  id: string,
  title: string,
  points: number,
  dueDate: string | null,
  categoryId = homework,
): Assignment =>
  ({
    id: id as AssignmentId,
    categoryId,
    title,
    points,
    dueDate: dueDate as LocalDate | null,
    questions: [],
  }) as unknown as Assignment;

const grade = (assignmentId: string, status: GradeStatus, score: number | null): Grade => ({
  id: `grade-${assignmentId}` as Grade['id'],
  schoolId: 'school-1' as SchoolId,
  studentId: ana,
  assignmentId: assignmentId as AssignmentId,
  status,
  score,
  source: 'manual',
  gradedBy: 'teacher-1' as UserId,
  comment: null,
});

const session = (date: string, status: AttendanceStatus, submitted = true): AttendanceSession =>
  ({
    date: date as LocalDate,
    status: submitted ? 'submitted' : 'open',
    roster: [ana],
    records: [{ studentId: ana, status }],
  }) as unknown as AttendanceSession;

const play = (score: number, total: number): GamePlay =>
  ({ studentId: ana, score, total, playedAt: new Date('2026-11-03T10:00:00Z') }) as GamePlay;

const input = (overrides: Partial<FamilyReportInput> = {}): FamilyReportInput => ({
  studentId: ana,
  today: '2026-11-04' as LocalDate,
  categories: [
    { id: homework, weightPercent: 50 },
    { id: tests, weightPercent: 50 },
  ],
  assignments: [
    assignment('a1', 'Fractions worksheet', 10, '2026-10-20'),
    assignment('a2', 'Unit test', 50, '2026-10-28', tests),
    assignment('a3', 'Reading log', 10, '2026-10-30'),
    assignment('a4', 'Poster', 20, '2026-11-06'),
    assignment('a5', 'Lab report', 20, '2026-11-20'),
  ],
  grades: [
    grade('a1', 'graded', 8),
    grade('a2', 'late', 40),
    grade('a3', 'pending', 9),
    grade('a4', 'pending', null),
  ],
  sessions: [
    session('2026-11-02', 'present'),
    session('2026-11-03', 'tardy'),
    session('2026-11-04', 'absent'),
    session('2026-11-05', 'present', false),
  ],
  paths: [],
  attempts: [],
  plays: [play(3, 4), play(4, 4)],
  ...overrides,
});

describe('buildFamilyReport', () => {
  it('shows only confirmed grades: a pending score is never shown', () => {
    const report = buildFamilyReport(input());
    expect(report.assignments).toEqual([
      {
        title: 'Fractions worksheet',
        dueDate: '2026-10-20',
        points: 10,
        status: 'graded',
        score: 8,
      },
      { title: 'Unit test', dueDate: '2026-10-28', points: 50, status: 'late', score: 40 },
      {
        title: 'Reading log',
        dueDate: '2026-10-30',
        points: 10,
        status: 'not_graded',
        score: null,
      },
      { title: 'Poster', dueDate: '2026-11-06', points: 20, status: 'not_graded', score: null },
      { title: 'Lab report', dueDate: '2026-11-20', points: 20, status: 'not_graded', score: null },
    ]);
    expect(JSON.stringify(report)).not.toContain('"score":9');
  });

  it('uses the gradebook’s weighted average, ignoring pending work', () => {
    // Homework 8/10 = 80%, tests 40/50 = 80%: 80% overall.
    expect(buildFamilyReport(input()).overall).toBe(80);
    expect(buildFamilyReport(input({ grades: [] })).overall).toBeNull();
  });

  it('lists work due in the next 7 days that has no confirmed grade', () => {
    expect(buildFamilyReport(input()).upcoming).toEqual([
      { title: 'Poster', dueDate: '2026-11-06' },
    ]);
  });

  it('counts submitted attendance only, with a tardy as present in the rate', () => {
    const { attendance } = buildFamilyReport(input());
    expect(attendance.summary).toEqual({ present: 1, absent: 1, tardy: 1, excused: 0, total: 3 });
    expect(attendance.rate).toBe(67);
    expect(attendance.recent).toEqual([
      { date: '2026-11-04', status: 'absent' },
      { date: '2026-11-03', status: 'tardy' },
      { date: '2026-11-02', status: 'present' },
    ]);
  });

  it('sums the student’s games by roster ID', () => {
    expect(buildFamilyReport(input()).games).toEqual({ plays: 2, best: 100, average: 88 });
    expect(buildFamilyReport(input({ plays: [] })).games).toEqual({
      plays: 0,
      best: null,
      average: null,
    });
  });
});

describe('PortalLink', () => {
  const link: PortalLink = createPortalLink({
    id: 'portal-1' as PortalLink['id'],
    schoolId: 'school-1' as SchoolId,
    classId: 'class-1' as PortalLink['classId'],
    studentId: ana,
    tokenHash: 'hash',
    sentTo: null,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
  });

  it('works until it expires or is revoked', () => {
    const now = new Date('2026-11-04T10:00:00Z');
    expect(isUsable(link, now)).toBe(true);
    expect(isUsable(link, new Date('2027-01-01T00:00:00Z'))).toBe(false);
    const revoked = revokeLink(link, now);
    expect(isUsable(revoked, now)).toBe(false);
    expect(revokeLink(revoked, new Date('2026-12-01')).revokedAt).toEqual(now);
  });
});
