import { describe, expect, it } from 'vitest';
import type { StudentId, User } from '@thp/domain';
import {
  CreateSemester,
  GetReportCards,
  GetSchoolLogo,
  RemoveSchoolLogo,
  SaveReportCardComment,
  SubmitAttendance,
  SaveAttendance,
  UpdateClass,
  UploadSchoolLogo,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

type Room = Awaited<ReturnType<typeof gradedClass>>;

async function takeDay(world: World, room: Room, date: string, submit = true) {
  const marks = [room.ana, room.ben, room.cara].map((s) => ({
    studentId: s.id,
    status: s.id === room.ana.id ? ('absent' as const) : ('present' as const),
  }));
  const UseCase = submit ? SubmitAttendance : SaveAttendance;
  valueOf(
    await new UseCase(world).execute({ actor: room.actor, classId: room.cls.id, date, marks }),
  );
}

describe('SaveReportCardComment', () => {
  it('saves, replaces and clears a student’s comment', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const save = (text: string) =>
      new SaveReportCardComment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        studentId: room.ana.id,
        text,
      });

    const first = valueOf(await save(' Buen trabajo. '));
    const second = valueOf(await save('Excelente progreso.'));
    expect(second?.id).toBe(first?.id);
    expect(
      (await world.reportCardComments.findFor(room.cls.schoolId, room.cls.id, room.ana.id))?.text,
    ).toBe('Excelente progreso.');

    expect(await save('   ')).toEqual({ ok: true, value: null });
    expect(
      await world.reportCardComments.findFor(room.cls.schoolId, room.cls.id, room.ana.id),
    ).toBeNull();
    expect(await save('x'.repeat(1001))).toEqual({
      ok: false,
      error: { field: 'comment', code: 'too_long' },
    });
  });

  it('refuses a student who is not in the class', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);

    expect(
      await new SaveReportCardComment(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        studentId: 'stranger' as StudentId,
        text: 'Hola',
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });
});

describe('GetReportCards', () => {
  async function semesterClass(world: World) {
    const room = await gradedClass(world);
    const semester = valueOf(
      await new CreateSemester(world).execute({
        actor: room.actor,
        details: { name: 'Otoño 2026', startDate: '2026-09-01', endDate: '2026-12-18' },
      }),
    );
    valueOf(
      await new UpdateClass(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        details: { name: room.cls.name, semesterId: semester.id },
      }),
    );
    return { ...room, semester };
  }

  it('gives each student their categories, overall, attendance in the semester and comment', async () => {
    const world = makeWorld();
    const room = await semesterClass(world);
    const test = await room.assign('Examen', 'Exámenes', 50);
    const hw = await room.assign('Tarea', 'Tareas', 10);
    await room.grade(test.id, [{ studentId: room.ana.id, status: 'graded', score: 45 }]);
    await room.grade(hw.id, [{ studentId: room.ana.id, status: 'graded', score: 8 }]);
    await takeDay(world, room, '2026-08-31'); // before the semester
    await takeDay(world, room, '2026-09-14');
    await takeDay(world, room, '2026-09-15');
    await takeDay(world, room, '2026-09-16', false); // saved, not submitted
    await new SaveReportCardComment(world).execute({
      actor: room.actor,
      classId: room.cls.id,
      studentId: room.ana.id,
      text: 'Muy aplicada.',
    });

    const cards = valueOf(
      await new GetReportCards(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(cards.school.name).toBe('Mi escuela');
    expect(cards.semester?.name).toBe('Otoño 2026');
    expect(cards.teacher?.name).toBe('Ana López');
    expect(cards.cards.map((c) => c.student.lastName)).toEqual(['Acosta', 'Morales', 'Zayas']);
    const ana = cards.cards[2];
    expect(ana?.categories.map((c) => [c.category.name, c.result.percentage])).toEqual([
      ['Tareas', 80],
      ['Exámenes', 90],
    ]);
    expect(ana?.summary.overall).toBeCloseTo((25 * 80 + 30 * 90) / 55, 10);
    expect(ana?.attendance).toMatchObject({
      days: 2,
      rate: 0,
      summary: { present: 0, absent: 2, tardy: 0, excused: 0, total: 2 },
    });
    expect(ana?.comment).toBe('Muy aplicada.');
    expect(cards.cards[0]?.comment).toBeNull();
  });

  it('counts every submitted day when the class has no semester, and can pick students', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    await takeDay(world, room, '2026-08-31');
    await takeDay(world, room, '2026-09-14');

    const cards = valueOf(
      await new GetReportCards(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        studentIds: [room.ben.id],
      }),
    );
    expect(cards.semester).toBeNull();
    expect(cards.cards).toHaveLength(1);
    expect(cards.cards[0]?.attendance).toMatchObject({ days: 2, rate: 100 });
    expect(cards.cards[0]?.summary.overall).toBeNull();
  });

  it('includes the school logo when there is one', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    valueOf(await new UploadSchoolLogo(world).execute({ actor: room.actor, bytes: png }));

    const cards = valueOf(
      await new GetReportCards(world).execute({ actor: room.actor, classId: room.cls.id }),
    );
    expect(cards.logo?.contentType).toBe('image/png');
    expect(Array.from(cards.logo?.bytes ?? [])).toEqual(Array.from(png));
  });

  it('refuses a student outside the class', async () => {
    const world = makeWorld();
    const room = await gradedClass(world);

    expect(
      await new GetReportCards(world).execute({
        actor: room.actor,
        classId: room.cls.id,
        studentIds: ['stranger' as StudentId],
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it("refuses another teacher, and another school's class is unreachable", async () => {
    const world = makeWorld();
    const room = await gradedClass(world);
    const other = await signedUp(world, 'ben@other.edu');
    const attempts = (actor: User) => [
      new GetReportCards(world).execute({ actor, classId: room.cls.id }),
      new SaveReportCardComment(world).execute({
        actor,
        classId: room.cls.id,
        studentId: room.ana.id,
        text: 'x',
      }),
    ];

    for (const result of await Promise.all(attempts(colleagueOf(room.actor)))) {
      expect(result).toEqual({ ok: false, error: { code: 'forbidden' } });
    }
    for (const result of await Promise.all(attempts(other.user))) {
      expect(result).toEqual({ ok: false, error: { code: 'not_found' } });
    }
    expect(
      (
        await new GetReportCards(world).execute({
          actor: colleagueOf(room.actor, 'school_admin'),
          classId: room.cls.id,
        })
      ).ok,
    ).toBe(true);
  });
});

describe('school logo', () => {
  it('uploads, shows and removes the logo of the actor’s school', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    const school = valueOf(await new UploadSchoolLogo(world).execute({ actor: user, bytes: png }));
    expect(school.logoKey).toBe(`schools/${user.schoolId}/logo`);
    const shown = valueOf(await new GetSchoolLogo(world).execute({ actor: user }));
    expect(shown?.contentType).toBe('image/png');

    valueOf(await new RemoveSchoolLogo(world).execute({ actor: user }));
    expect(await new GetSchoolLogo(world).execute({ actor: user })).toEqual({
      ok: true,
      value: null,
    });
    expect((await world.files.get(`schools/${user.schoolId}/logo`)).ok).toBe(false);
  });

  it('refuses a file that is not a PNG or JPEG, and a teacher who does not manage the school', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    expect(
      await new UploadSchoolLogo(world).execute({
        actor: user,
        bytes: new TextEncoder().encode('<svg/>'),
      }),
    ).toEqual({ ok: false, error: { field: 'logo', code: 'invalid_format' } });
    expect(
      await new UploadSchoolLogo(world).execute({ actor: colleagueOf(user), bytes: png }),
    ).toEqual({ ok: false, error: { code: 'forbidden' } });
    expect(await new RemoveSchoolLogo(world).execute({ actor: colleagueOf(user) })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
  });

  it('reports when the file store is unavailable', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const files = {
      put: () => Promise.resolve({ ok: false as const, error: { code: 'unavailable' as const } }),
      get: () => Promise.resolve({ ok: false as const, error: { code: 'unavailable' as const } }),
      delete: () => Promise.resolve({ ok: true as const, value: true as const }),
    };

    expect(
      await new UploadSchoolLogo({ ...world, files }).execute({ actor: user, bytes: png }),
    ).toEqual({ ok: false, error: { code: 'storage_unavailable' } });
  });
});
