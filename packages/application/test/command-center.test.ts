import { describe, expect, it } from 'vitest';
import type { SchoolId, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { GetCommandCenter, SubmitAttendance } from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, type World } from './world.ts';

const timeZone = 'America/Puerto_Rico';

/**
 * Today is Tuesday 2026-09-01. Ana fails the quiz and misses the essay; Ben has handed in
 * nothing; Cara is doing well. Nobody has taken attendance today.
 */
async function struggling(world: World) {
  const setup = await gradedClass(world);
  const quiz = await setup.assign('Quiz', 'Pruebas cortas', 10, '2026-08-25');
  const essay = await setup.assign('Essay', 'Pruebas cortas', 20, '2026-08-28');
  await setup.grade(quiz.id, [
    { studentId: setup.ana.id, status: 'graded', score: 2 },
    { studentId: setup.cara.id, status: 'graded', score: 9 },
  ]);
  await setup.grade(essay.id, [
    { studentId: setup.ana.id, status: 'missing' },
    { studentId: setup.cara.id, status: 'graded', score: 18 },
  ]);
  return { ...setup, quiz, essay };
}

describe('GetCommandCenter', () => {
  it("shows today's classes, what to grade, who is at risk, and what to do next", async () => {
    const world = makeWorld();
    const { actor, cls, ana, quiz, essay } = await struggling(world);

    const center = valueOf(await new GetCommandCenter(world).execute({ actor, timeZone }));

    expect(center.today).toBe('2026-09-01');
    expect(center.classesToday).toEqual([{ cls, students: 3, attendance: 'not_taken' }]);
    expect(center.toGrade.map((item) => [item.assignment.id, item.ungraded, item.overdue])).toEqual(
      [
        [quiz.id, 1, true],
        [essay.id, 1, true],
      ],
    );
    expect(center.toGrade[0]?.className).toBe(cls.name);
    expect(center.atRisk).toEqual([
      {
        student: ana,
        cls: { id: cls.id, name: cls.name },
        risk: {
          score: 4,
          factors: [
            { kind: 'failing', value: 6.7 },
            { kind: 'missing', value: 1 },
          ],
        },
      },
    ]);
    expect(center.recommendations).toEqual([
      { kind: 'attendance', priority: 'high', count: 1 },
      { kind: 'intervention', priority: 'high', count: 1 },
      { kind: 'grading', priority: 'medium', count: 2 },
      { kind: 'planning', priority: 'low', count: 1 },
    ]);
    expect(center.stats).toEqual({ classesToday: 1, attendanceDone: 0, toGrade: 2, atRisk: 1 });
    expect(center.upcoming).toEqual([]);
  });

  it('counts attendance taken today, and absences in the last 30 days toward risk', async () => {
    const world = makeWorld();
    const { actor, cls, ana, ben, cara } = await struggling(world);
    const day = (date: string, absent: boolean) =>
      new SubmitAttendance(world).execute({
        actor,
        classId: cls.id,
        date,
        marks: [
          { studentId: ana.id, status: 'present' as const },
          { studentId: ben.id, status: absent ? ('absent' as const) : ('present' as const) },
          { studentId: cara.id, status: 'present' as const },
        ],
      });
    valueOf(await day('2026-07-01', true));
    valueOf(await day('2026-08-20', true));
    valueOf(await day('2026-09-01', false));

    const center = valueOf(await new GetCommandCenter(world).execute({ actor, timeZone }));

    expect(center.classesToday[0]?.attendance).toBe('done');
    expect(center.stats.attendanceDone).toBe(1);
    expect(center.recommendations.map((r) => r.kind)).not.toContain('attendance');
    // One absence in the two sessions of the last 30 days (50%) plus two missing: at risk.
    expect(center.atRisk.find((row) => row.student.id === ben.id)?.risk).toEqual({
      score: 4,
      factors: [
        { kind: 'missing', value: 2 },
        { kind: 'high_absences', value: 1 },
      ],
    });
  });

  it("never shows another teacher's or another school's classes", async () => {
    const world = makeWorld();
    const { actor } = await struggling(world);
    const outsider = aUser({
      id: 'u-9' as UserId,
      schoolId: 'school-9' as SchoolId,
      email: 'o@x.edu',
    });
    for (const someone of [colleagueOf(actor), outsider]) {
      const center = valueOf(
        await new GetCommandCenter(world).execute({ actor: someone, timeZone }),
      );
      expect(center.classesToday).toEqual([]);
      expect(center.atRisk).toEqual([]);
      expect(center.toGrade).toEqual([]);
    }
  });
});
