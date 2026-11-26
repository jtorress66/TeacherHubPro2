import { describe, expect, it } from 'vitest';
import type { AssignmentId, StudentId } from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import {
  coverageStatuses,
  onTrackPercent,
  standardsCoverage,
  summarizeCoverage,
  watchPercent,
  type CoverageAssignment,
  type CoverageGrade,
} from './standards-coverage.ts';

const ana = 'student-ana' as StudentId;
const ben = 'student-ben' as StudentId;
const cleo = 'student-cleo' as StudentId;
const week = (date: string) => date as LocalDate;

const assignment = (id: string, standards: readonly string[], points = 10): CoverageAssignment => ({
  id: id as AssignmentId,
  points,
  standards,
});

const grade = (
  studentId: StudentId,
  assignmentId: string,
  score: number | null,
  status: CoverageGrade['status'] = 'graded',
): CoverageGrade => ({ studentId, assignmentId: assignmentId as AssignmentId, status, score });

describe('standardsCoverage', () => {
  it('lists planned codes first, by the week they are planned, then codes only assignments test', () => {
    const rows = standardsCoverage({
      plannedWeeks: [
        { weekStart: week('2026-11-09'), codes: ['4.N.1.1'] },
        { weekStart: week('2026-11-02'), codes: ['CCSS.Math.Content.4.NF.A.1', '4.N.1.1'] },
      ],
      assignments: [assignment('a1', ['ESCUELA.7', '4.N.1.1'])],
      grades: [],
      studentIds: [ana],
    });

    expect(rows.map((row) => row.standard.code)).toEqual([
      'CCSS.Math.Content.4.NF.A.1',
      '4.N.1.1',
      'ESCUELA.7',
    ]);
    expect(rows[1]?.plannedWeeks).toEqual(['2026-11-02', '2026-11-09']);
    expect(rows[1]?.standard.source).toBe('puerto_rico');
    expect(rows[2]?.plannedWeeks).toEqual([]);
    expect(rows[2]?.assignments).toBe(1);
  });

  it('marks a planned standard no assignment tests as not tested yet', () => {
    const [row] = standardsCoverage({
      plannedWeeks: [{ weekStart: week('2026-11-02'), codes: ['4.N.1.1'] }],
      assignments: [],
      grades: [],
      studentIds: [ana],
    });

    expect(row).toMatchObject({
      assignments: 0,
      average: null,
      studentsScored: 0,
      studentsBelow: 0,
      status: 'not_tested',
    });
  });

  it('averages each student over every assignment that tests the standard', () => {
    const [row] = standardsCoverage({
      plannedWeeks: [],
      assignments: [assignment('a1', ['4.N.1.1'], 10), assignment('a2', ['4.N.1.1'], 30)],
      grades: [
        // Ana: 38 of 40 = 95%. Ben: 22 of 40 = 55%.
        grade(ana, 'a1', 8),
        grade(ana, 'a2', 30),
        grade(ben, 'a1', 7, 'late'),
        grade(ben, 'a2', 15),
      ],
      studentIds: [ana, ben],
    });

    expect(row).toMatchObject({
      assignments: 2,
      average: 75,
      studentsScored: 2,
      studentsBelow: 1,
      status: 'watch',
    });
  });

  it('counts only teacher-confirmed scores from students still on the roster', () => {
    const [row] = standardsCoverage({
      plannedWeeks: [],
      assignments: [assignment('a1', ['4.N.1.1'])],
      grades: [
        grade(ana, 'a1', 9),
        grade(ben, 'a1', null, 'missing'),
        grade(cleo, 'a1', 1),
        grade(ana, 'other', 0),
      ],
      studentIds: [ana, ben],
    });

    expect(row).toMatchObject({ average: 90, studentsScored: 1, studentsBelow: 0 });
  });

  it('sorts each standard into on track, watch or reteach by the class average', () => {
    const statusFor = (score: number) =>
      standardsCoverage({
        plannedWeeks: [],
        assignments: [assignment('a1', ['X.1'], 100)],
        grades: [grade(ana, 'a1', score)],
        studentIds: [ana],
      })[0]?.status;

    expect(onTrackPercent).toBe(80);
    expect(watchPercent).toBe(70);
    expect(statusFor(80)).toBe('on_track');
    expect(statusFor(79)).toBe('watch');
    expect(statusFor(70)).toBe('watch');
    expect(statusFor(69)).toBe('reteach');
  });

  it('counts the games that practise each standard, after the codes plans and assignments name', () => {
    const rows = standardsCoverage({
      plannedWeeks: [{ weekStart: week('2026-11-02'), codes: ['4.N.1.1'] }],
      assignments: [assignment('a1', ['4.N.1.1'])],
      grades: [grade(ana, 'a1', 9)],
      studentIds: [ana],
      games: [{ standards: ['4.N.1.1', 'GAME.ONLY'] }, { standards: ['GAME.ONLY'] }],
    });

    expect(rows.map((row) => [row.standard.code, row.games, row.status])).toEqual([
      ['4.N.1.1', 1, 'on_track'],
      ['GAME.ONLY', 2, 'practised'],
    ]);
  });

  it('has nothing to report for a class with no plans or tagged assignments', () => {
    expect(
      standardsCoverage({
        plannedWeeks: [],
        assignments: [assignment('a1', [])],
        grades: [grade(ana, 'a1', 5)],
        studentIds: [ana],
      }),
    ).toEqual([]);
  });
});

describe('summarizeCoverage', () => {
  it('counts the standards in each status', () => {
    const rows = standardsCoverage({
      plannedWeeks: [{ weekStart: week('2026-11-02'), codes: ['P.1'] }],
      assignments: [assignment('a1', ['G.1']), assignment('a2', ['B.1'])],
      grades: [grade(ana, 'a1', 9), grade(ana, 'a2', 3)],
      studentIds: [ana],
    });

    expect(coverageStatuses).toEqual(['reteach', 'watch', 'on_track', 'practised', 'not_tested']);
    expect(summarizeCoverage(rows)).toEqual({
      reteach: 1,
      watch: 0,
      on_track: 1,
      practised: 0,
      not_tested: 1,
    });
  });
});
