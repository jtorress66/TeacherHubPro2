import { describe, expect, it } from 'vitest';
import type { Student, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  AddStudent,
  ArchiveClass,
  CreateClass,
  DeleteStudent,
  GetAttendanceOverview,
  GetAttendanceReport,
  GetAttendanceSheet,
  ListAttendanceDays,
  ReopenAttendance,
  SaveAttendance,
  SubmitAttendance,
} from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const colleagueOf = (user: User, role: User['role'] = 'teacher') =>
  aUser({
    id: `colleague-${role}` as UserId,
    schoolId: user.schoolId,
    email: `${role}@x.edu`,
    role,
  });

/** A teacher with a class of three students: Zayas, Acosta and Morales. */
async function classroom(world: World) {
  const account = await signedUp(world);
  const created = await new CreateClass(world).execute({
    actor: account.user,
    details: { name: 'Matemáticas 7' },
  });
  if (!created.ok) throw new Error('class');
  const cls = created.value;
  const add = async (firstName: string, lastName: string): Promise<Student> => {
    const added = await new AddStudent(world).execute({
      actor: account.user,
      classId: cls.id,
      details: { firstName, lastName },
    });
    if (!added.ok) throw new Error('student');
    return added.value;
  };
  const ana = await add('Ana', 'Zayas');
  const ben = await add('Ben', 'Acosta');
  const cara = await add('Cara', 'Morales');
  return { ...account, cls, ana, ben, cara };
}

type Classroom = Awaited<ReturnType<typeof classroom>>;

const allPresent = ({ ana, ben, cara }: Classroom) =>
  [ana, ben, cara].map((student) => ({ studentId: student.id, status: 'present' as const }));

async function submitDay(
  world: World,
  room: Classroom,
  date: string,
  changes: { studentId: Student['id']; status: 'absent' | 'tardy' | 'excused' }[] = [],
) {
  const result = await new SubmitAttendance(world).execute({
    actor: room.user,
    classId: room.cls.id,
    date,
    marks: [...allPresent(room), ...changes],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

describe('GetAttendanceSheet', () => {
  it('starts a new day with every student present, in name order', async () => {
    const world = makeWorld();
    const room = await classroom(world);

    const sheet = await new GetAttendanceSheet(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
    });

    expect(sheet.ok && sheet.value.status).toBe('new');
    expect(sheet.ok && sheet.value.editable).toBe(true);
    expect(sheet.ok && sheet.value.rows.map((row) => [row.student.lastName, row.status])).toEqual([
      ['Acosta', 'present'],
      ['Morales', 'present'],
      ['Zayas', 'present'],
    ]);
  });

  it('shows saved marks and adds a student who joined after the day was saved', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await new SaveAttendance(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
      marks: [{ studentId: room.ana.id, status: 'tardy', minutesLate: 5, note: 'Bus' }],
    });
    await new AddStudent(world).execute({
      actor: room.user,
      classId: room.cls.id,
      details: { firstName: 'Dani', lastName: 'Bravo' },
    });

    const sheet = await new GetAttendanceSheet(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
    });

    expect(sheet.ok && sheet.value.status).toBe('open');
    expect(
      sheet.ok &&
        sheet.value.rows.map((row) => [
          row.student.lastName,
          row.status,
          row.minutesLate,
          row.note,
        ]),
    ).toEqual([
      ['Acosta', 'present', null, null],
      ['Bravo', 'present', null, null],
      ['Morales', 'present', null, null],
      ['Zayas', 'tardy', 5, 'Bus'],
    ]);
  });

  it('keeps a submitted day as it was taken, read-only', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await submitDay(world, room, '2026-09-14');
    await new DeleteStudent(world).execute({ actor: room.user, studentId: room.cara.id });

    const sheet = await new GetAttendanceSheet(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
    });

    expect(sheet.ok && sheet.value.status).toBe('submitted');
    expect(sheet.ok && sheet.value.editable).toBe(false);
    expect(sheet.ok && sheet.value.rows.map((row) => row.student.lastName)).toEqual([
      'Acosta',
      'Zayas',
    ]);
  });

  it('shows an archived class read-only', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await new ArchiveClass(world).execute({ actor: room.user, classId: room.cls.id });

    const sheet = await new GetAttendanceSheet(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
    });

    expect(sheet.ok && sheet.value.editable).toBe(false);
  });

  it('refuses a bad date', async () => {
    const world = makeWorld();
    const room = await classroom(world);

    expect(
      await new GetAttendanceSheet(world).execute({
        actor: room.user,
        classId: room.cls.id,
        date: '14/09/2026',
      }),
    ).toEqual({ ok: false, error: { field: 'date', code: 'invalid_format' } });
  });
});

describe('SaveAttendance, SubmitAttendance, ReopenAttendance', () => {
  it('keeps one session per class and date: saving again updates it', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    const save = new SaveAttendance(world);
    const input = { actor: room.user, classId: room.cls.id, date: '2026-09-14' };

    const first = await save.execute({ ...input, marks: allPresent(room) });
    const second = await save.execute({
      ...input,
      marks: [{ studentId: room.ben.id, status: 'absent' }],
    });

    expect(first.ok && second.ok && first.value.id === second.value.id).toBe(true);
    expect(
      await world.attendanceSessions.listByClass(room.user.schoolId, room.cls.id),
    ).toHaveLength(1);
    expect(second.ok && second.value.records.find((r) => r.studentId === room.ben.id)?.status).toBe(
      'absent',
    );
  });

  it('submits a day and refuses changes until it is reopened', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    const input = { actor: room.user, classId: room.cls.id, date: '2026-09-14' };
    await submitDay(world, room, '2026-09-14');

    const refused = await new SaveAttendance(world).execute({
      ...input,
      marks: [{ studentId: room.ben.id, status: 'absent' }],
    });
    expect(refused).toEqual({
      ok: false,
      error: { code: 'invalid_transition', from: 'submitted', action: 'mark' },
    });

    const reopened = await new ReopenAttendance(world).execute(input);
    expect(reopened.ok && reopened.value.status).toBe('open');
    const saved = await new SaveAttendance(world).execute({
      ...input,
      marks: [{ studentId: room.ben.id, status: 'absent' }],
    });
    expect(saved.ok).toBe(true);
  });

  it('refuses to submit a day with a student left unmarked, and saves nothing', async () => {
    const world = makeWorld();
    const room = await classroom(world);

    const result = await new SubmitAttendance(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-14',
      marks: [{ studentId: room.ana.id, status: 'present' }],
    });

    expect(result.ok || result.error.code).toBe('incomplete');
    expect(await world.attendanceSessions.listByClass(room.user.schoolId, room.cls.id)).toEqual([]);
  });

  it('refuses a student from another class, bad details, a bad date and an archived class', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    const save = new SaveAttendance(world);
    const input = { actor: room.user, classId: room.cls.id, date: '2026-09-14' };
    const other = await new CreateClass(world).execute({
      actor: room.user,
      details: { name: 'Ciencias' },
    });
    if (!other.ok) throw new Error('class');
    const stranger = await new AddStudent(world).execute({
      actor: room.user,
      classId: other.value.id,
      details: { firstName: 'Eva', lastName: 'Ruiz' },
    });
    if (!stranger.ok) throw new Error('student');

    expect(
      await save.execute({
        ...input,
        marks: [{ studentId: stranger.value.id, status: 'present' }],
      }),
    ).toEqual({ ok: false, error: { code: 'not_in_roster', studentId: stranger.value.id } });
    expect(
      await save.execute({
        ...input,
        marks: [{ studentId: room.ana.id, status: 'present', minutesLate: 3 }],
      }),
    ).toEqual({ ok: false, error: { field: 'minutesLate', code: 'not_allowed' } });
    expect(await save.execute({ ...input, date: 'today', marks: [] })).toEqual({
      ok: false,
      error: { field: 'date', code: 'invalid_format' },
    });

    await new ArchiveClass(world).execute({ actor: room.user, classId: room.cls.id });
    expect(await save.execute({ ...input, marks: allPresent(room) })).toEqual({
      ok: false,
      error: { code: 'class_archived' },
    });
  });

  it('cannot reopen a day that was never taken, or one that is still open', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    const input = { actor: room.user, classId: room.cls.id, date: '2026-09-14' };

    expect(await new ReopenAttendance(world).execute(input)).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    await new SaveAttendance(world).execute({ ...input, marks: allPresent(room) });
    expect(await new ReopenAttendance(world).execute(input)).toEqual({
      ok: false,
      error: { code: 'invalid_transition', from: 'open', action: 'reopen' },
    });
  });
});

describe('ListAttendanceDays and GetAttendanceOverview', () => {
  it('lists the days taken for a class, latest first', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await submitDay(world, room, '2026-09-14');
    await new SaveAttendance(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-15',
      marks: allPresent(room),
    });

    const days = await new ListAttendanceDays(world).execute({
      actor: room.user,
      classId: room.cls.id,
    });

    expect(days.ok && days.value).toEqual([
      { date: '2026-09-15', status: 'open' },
      { date: '2026-09-14', status: 'submitted' },
    ]);
  });

  it("shows each of the teacher's classes with the day's status", async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await new CreateClass(world).execute({ actor: room.user, details: { name: 'Ciencias' } });
    await submitDay(world, room, '2026-09-14');

    const overview = await new GetAttendanceOverview(world).execute({
      actor: room.user,
      date: '2026-09-14',
    });

    expect(overview.ok && overview.value.map(({ cls, status }) => [cls.name, status])).toEqual([
      ['Ciencias', 'not_taken'],
      ['Matemáticas 7', 'submitted'],
    ]);
  });
});

describe('GetAttendanceReport', () => {
  it('reports each student’s days and rate over submitted days only', async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await submitDay(world, room, '2026-09-14', [{ studentId: room.ana.id, status: 'absent' }]);
    await submitDay(world, room, '2026-09-15', [{ studentId: room.ben.id, status: 'tardy' }]);
    await new SaveAttendance(world).execute({
      actor: room.user,
      classId: room.cls.id,
      date: '2026-09-16',
      marks: [{ studentId: room.cara.id, status: 'absent' }],
    });

    const report = await new GetAttendanceReport(world).execute({
      actor: room.user,
      classId: room.cls.id,
      from: '2026-09-01',
      to: '2026-09-30',
      timeZone: 'UTC',
    });

    expect(report.ok && report.value.range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(report.ok && report.value.days).toBe(2);
    expect(
      report.ok &&
        report.value.rows.map((row) => [row.student.lastName, row.summary.total, row.rate]),
    ).toEqual([
      ['Acosta', 2, 100],
      ['Morales', 2, 100],
      ['Zayas', 2, 50],
    ]);
    expect(report.ok && report.value.rate).toBeCloseTo((5 / 6) * 100);
  });

  it('defaults to the last 30 days, ending today in the teacher’s time zone', async () => {
    const world = makeWorld(); // the clock reads 2026-09-01T08:00Z
    const room = await classroom(world);

    const report = await new GetAttendanceReport(world).execute({
      actor: room.user,
      classId: room.cls.id,
      timeZone: 'Pacific/Honolulu',
    });

    expect(report.ok && report.value.range).toEqual({ from: '2026-08-02', to: '2026-08-31' });
  });

  it('refuses a range that ends before it starts', async () => {
    const world = makeWorld();
    const room = await classroom(world);

    expect(
      await new GetAttendanceReport(world).execute({
        actor: room.user,
        classId: room.cls.id,
        from: '2026-09-30',
        to: '2026-09-01',
        timeZone: 'UTC',
      }),
    ).toEqual({ ok: false, error: { field: 'to', code: 'invalid_order' } });
  });
});

describe('who may take attendance', () => {
  const date = '2026-09-14';

  it('lets an admin of the school take attendance for any class', async () => {
    const world = makeWorld();
    const room = await classroom(world);

    const result = await new SubmitAttendance(world).execute({
      actor: colleagueOf(room.user, 'school_admin'),
      classId: room.cls.id,
      date,
      marks: allPresent(room),
    });

    expect(result.ok).toBe(true);
  });

  it("refuses another teacher, and another school's class is unreachable, for every use case", async () => {
    const world = makeWorld();
    const room = await classroom(world);
    await submitDay(world, room, date);
    const other = await signedUp(world, 'ben@other.edu');
    const classId = room.cls.id;
    const attempts = (actor: User) => [
      new GetAttendanceSheet(world).execute({ actor, classId, date }),
      new SaveAttendance(world).execute({ actor, classId, date, marks: [] }),
      new SubmitAttendance(world).execute({ actor, classId, date, marks: [] }),
      new ReopenAttendance(world).execute({ actor, classId, date }),
      new ListAttendanceDays(world).execute({ actor, classId }),
      new GetAttendanceReport(world).execute({ actor, classId, timeZone: 'UTC' }),
    ];

    for (const result of await Promise.all(attempts(colleagueOf(room.user)))) {
      expect(result).toEqual({ ok: false, error: { code: 'forbidden' } });
    }
    for (const result of await Promise.all(attempts(other.user))) {
      expect(result).toEqual({ ok: false, error: { code: 'not_found' } });
    }
    const overview = await new GetAttendanceOverview(world).execute({ actor: other.user, date });
    expect(overview.ok && overview.value).toEqual([]);
  });
});
