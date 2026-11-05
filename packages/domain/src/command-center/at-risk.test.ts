import { describe, expect, it } from 'vitest';
import type { AttendanceStatus } from '../attendance/attendance-session.ts';
import type { Assignment } from '../gradebook/assignment.ts';
import type { Grade, GradeStatus } from '../gradebook/grade.ts';
import type {
  AssignmentId,
  ClassId,
  GradeCategoryId,
  GradeId,
  SchoolId,
  StudentId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { atRiskList, missingAssignments, riskOf, type RiskInput } from './at-risk.ts';

const category = 'cat-1' as GradeCategoryId;
const today = '2026-11-05' as LocalDate;

const assignment = (
  n: number,
  points = 100,
  dueDate: string | null = '2026-11-01',
): Assignment => ({
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

const grade = (n: number, status: GradeStatus, score: number | null = null): Grade => ({
  id: `g${String(n)}` as GradeId,
  schoolId: 's1' as SchoolId,
  studentId: 'st1' as StudentId,
  assignmentId: `a${String(n)}` as AssignmentId,
  status,
  score,
  source: 'manual',
  gradedBy: 'u1' as UserId,
  comment: null,
});

const input = (overrides: Partial<RiskInput> = {}): RiskInput => ({
  categories: [{ id: category, weightPercent: 100 }],
  assignments: [assignment(1)],
  grades: [grade(1, 'graded', 90)],
  statuses: [],
  today,
  ...overrides,
});

const statuses = (counts: Partial<Record<AttendanceStatus, number>>): AttendanceStatus[] =>
  (Object.entries(counts) as [AttendanceStatus, number][]).flatMap(([status, count]) =>
    Array.from({ length: count }, () => status),
  );

describe('riskOf', () => {
  it('gives a student doing well no risk', () => {
    expect(riskOf(input())).toEqual({ score: 0, factors: [] });
  });

  it('scores a failing average 3 and a low one 2, at the 60 and 70 boundaries', () => {
    const at = (score: number) => riskOf(input({ grades: [grade(1, 'graded', score)] }));
    expect(at(59.9)).toEqual({ score: 3, factors: [{ kind: 'failing', value: 59.9 }] });
    expect(at(60)).toEqual({ score: 2, factors: [{ kind: 'low', value: 60 }] });
    expect(at(69.9).score).toBe(2);
    expect(at(70)).toEqual({ score: 0, factors: [] });
  });

  it("uses each assignment's real maximum, not 100", () => {
    const risk = riskOf(
      input({ assignments: [assignment(1, 10)], grades: [grade(1, 'graded', 5)] }),
    );
    expect(risk.factors).toEqual([{ kind: 'failing', value: 50 }]);
  });

  it('scores 1 or 2 missing as 1 and 3 or more as 2; only past-due or marked work is missing', () => {
    const work = [assignment(1), assignment(2), assignment(3), assignment(4, 100, '2026-11-20')];
    const done = (n: number) => grade(n, 'graded', 100);
    const two = riskOf(input({ assignments: work, grades: [done(1)] }));
    expect(two.factors).toContainEqual({ kind: 'missing', value: 2 });
    expect(two.factors.find((f) => f.kind === 'missing')).toBeDefined();

    const three = riskOf(
      input({ assignments: work, grades: [done(1), grade(2, 'missing'), grade(3, 'missing')] }),
    );
    expect(three.factors).toContainEqual({ kind: 'missing', value: 2 });

    const marked = riskOf(
      input({
        assignments: work,
        grades: [grade(1, 'missing'), grade(2, 'missing'), grade(3, 'missing'), done(4)],
      }),
    );
    expect(marked.factors).toContainEqual({ kind: 'missing', value: 3 });
  });

  it('scores absences of 20% or more 3, otherwise 3 or more absences 1, and 5 tardies 1', () => {
    const at = (counts: Partial<Record<AttendanceStatus, number>>) =>
      riskOf(input({ statuses: statuses(counts) }));
    expect(at({ present: 4, absent: 1 })).toEqual({
      score: 3,
      factors: [{ kind: 'high_absences', value: 1 }],
    });
    expect(at({ present: 13, absent: 3 })).toEqual({
      score: 1,
      factors: [{ kind: 'absences', value: 3 }],
    });
    expect(at({ present: 100, absent: 2 })).toEqual({ score: 0, factors: [] });
    expect(at({ present: 100, tardy: 5 })).toEqual({
      score: 1,
      factors: [{ kind: 'tardies', value: 5 }],
    });
    expect(at({ present: 100, tardy: 4 })).toEqual({ score: 0, factors: [] });
    expect(at({})).toEqual({ score: 0, factors: [] });
  });

  it('adds the factors up', () => {
    const risk = riskOf(
      input({
        assignments: [assignment(1), assignment(2), assignment(3)],
        grades: [grade(1, 'graded', 40), grade(2, 'missing'), grade(3, 'missing')],
        statuses: statuses({ present: 7, absent: 3, tardy: 5 }),
      }),
    );
    expect(risk).toEqual({
      score: 3 + 1 + 3 + 1,
      factors: [
        { kind: 'failing', value: 13.3 },
        { kind: 'missing', value: 2 },
        { kind: 'high_absences', value: 3 },
        { kind: 'tardies', value: 5 },
      ],
    });
  });
});

describe('missingAssignments', () => {
  it('lists marked-missing work and past-due work without a grade, but not excused or future work', () => {
    const work = [
      assignment(1),
      assignment(2),
      assignment(3),
      assignment(4, 100, '2026-11-20'),
      assignment(5, 100, null),
      assignment(6, 100, today),
    ];
    const missing = missingAssignments(work, [grade(1, 'missing'), grade(3, 'excused')], today);
    expect(missing.map((a) => a.id)).toEqual(['a1', 'a2']);
  });
});

describe('atRiskList', () => {
  const row = (id: string, score: number) => ({ id, risk: { score, factors: [] } });

  it('keeps scores of 2 or more, highest first, at most 10', () => {
    const rows = [
      row('one', 1),
      row('two', 2),
      row('six', 6),
      ...Array.from({ length: 12 }, (_, i) => row(`x${String(i)}`, 3)),
    ];
    const list = atRiskList(rows);
    expect(list).toHaveLength(10);
    expect(list[0]?.id).toBe('six');
    expect(list.map((r) => r.id)).not.toContain('one');
  });
});
