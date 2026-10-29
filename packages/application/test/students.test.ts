import { describe, expect, it } from 'vitest';
import type { StudentId, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  AddStudent,
  ArchiveClass,
  CreateClass,
  DeleteStudent,
  ImportStudents,
  ListStudents,
  UpdateStudent,
} from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

async function classroom(world: World) {
  const account = await signedUp(world);
  const created = await new CreateClass(world).execute({
    actor: account.user,
    details: { name: 'Matemáticas 7' },
  });
  if (!created.ok) throw new Error('class');
  return { ...account, cls: created.value };
}

const colleagueOf = (user: User) =>
  aUser({ id: 'colleague' as UserId, schoolId: user.schoolId, email: 'c@x.edu' });

const csv = (count: number) =>
  [
    'Nombre,Apellidos,Número de estudiante',
    ...Array.from(
      { length: count },
      (_, i) => `Est${String(i + 1)},Apellido${String(i + 1)},N${String(i + 1)}`,
    ),
  ].join('\n');

describe('AddStudent, UpdateStudent, DeleteStudent, ListStudents', () => {
  it('adds, edits, lists in name order and deletes a student', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    const add = new AddStudent(world);

    const ana = await add.execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'Ana', lastName: 'Zayas' },
    });
    await add.execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'Ben', lastName: 'Acosta' },
    });
    expect(ana.ok).toBe(true);
    if (!ana.ok) return;

    const edited = await new UpdateStudent(world).execute({
      actor: user,
      studentId: ana.value.id,
      details: { firstName: 'Ana', lastName: 'Aguilar', parentEmail: 'mom@x.com' },
    });
    expect(edited.ok && edited.value).toMatchObject({
      lastName: 'Aguilar',
      parentEmail: 'mom@x.com',
    });

    const listed = await new ListStudents(world).execute({ actor: user, classId: cls.id });
    expect(listed.ok && listed.value.map((s) => s.lastName)).toEqual(['Acosta', 'Aguilar']);

    expect(
      (await new DeleteStudent(world).execute({ actor: user, studentId: ana.value.id })).ok,
    ).toBe(true);
    const after = await new ListStudents(world).execute({ actor: user, classId: cls.id });
    expect(after.ok && after.value.map((s) => s.lastName)).toEqual(['Acosta']);
  });

  it('refuses invalid details and a student number already used in the class', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    const add = new AddStudent(world);
    await add.execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'Ana', lastName: 'Zayas', studentNumber: 'S1' },
    });

    expect(
      await add.execute({
        actor: user,
        classId: cls.id,
        details: { firstName: '', lastName: 'X' },
      }),
    ).toEqual({
      ok: false,
      error: { field: 'firstName', code: 'required' },
    });
    expect(
      await add.execute({
        actor: user,
        classId: cls.id,
        details: { firstName: 'B', lastName: 'C', studentNumber: 'S1' },
      }),
    ).toEqual({ ok: false, error: { code: 'duplicate_student_number' } });
  });

  it('lets a student keep their own number when edited', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    const ana = await new AddStudent(world).execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'Ana', lastName: 'Zayas', studentNumber: 'S1' },
    });
    if (!ana.ok) return;

    const edited = await new UpdateStudent(world).execute({
      actor: user,
      studentId: ana.value.id,
      details: {
        firstName: 'Ana',
        lastName: 'Zayas',
        studentNumber: 'S1',
        accommodations: 'Extra time',
      },
    });
    expect(edited.ok).toBe(true);
  });

  it('refuses new students in an archived class', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    await new ArchiveClass(world).execute({ actor: user, classId: cls.id });

    expect(
      await new AddStudent(world).execute({
        actor: user,
        classId: cls.id,
        details: { firstName: 'A', lastName: 'B' },
      }),
    ).toEqual({
      ok: false,
      error: { code: 'class_archived' },
    });
  });

  it("refuses another teacher, and another school's students are unreachable", async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    const ana = await new AddStudent(world).execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'Ana', lastName: 'Z' },
    });
    if (!ana.ok) return;
    const other = await signedUp(world, 'ben@other.edu');
    const details = { firstName: 'X', lastName: 'Y' };

    expect(
      await new ListStudents(world).execute({ actor: colleagueOf(user), classId: cls.id }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await new UpdateStudent(world).execute({
        actor: other.user,
        studentId: ana.value.id,
        details,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await new DeleteStudent(world).execute({ actor: other.user, studentId: ana.value.id }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await new DeleteStudent(world).execute({ actor: colleagueOf(user), studentId: ana.value.id }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(
      await new UpdateStudent(world).execute({
        actor: user,
        studentId: 'missing' as StudentId,
        details,
      }),
    ).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('ImportStudents', () => {
  it('imports 25 students from a CSV file', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);

    const result = await new ImportStudents(world).execute({
      actor: user,
      classId: cls.id,
      csv: csv(25),
    });

    expect(result).toEqual({ ok: true, value: { imported: 25 } });
    const listed = await new ListStudents(world).execute({ actor: user, classId: cls.id });
    expect(listed.ok && listed.value).toHaveLength(25);
  });

  it('imports nothing when any row is invalid, and reports each bad row with its line', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    const text = 'first name,last name,parent email\nAna,López,\nBen,,\nCarla,Ruiz,not-an-email\n';

    expect(
      await new ImportStudents(world).execute({ actor: user, classId: cls.id, csv: text }),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_rows',
        rows: [
          { line: 3, field: 'lastName', code: 'required' },
          { line: 4, field: 'parentEmail', code: 'invalid_format' },
        ],
      },
    });
    const listed = await new ListStudents(world).execute({ actor: user, classId: cls.id });
    expect(listed.ok && listed.value).toHaveLength(0);
  });

  it('refuses student numbers repeated in the file or already in the class', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);
    await new AddStudent(world).execute({
      actor: user,
      classId: cls.id,
      details: { firstName: 'A', lastName: 'B', studentNumber: 'N1' },
    });
    const text = 'nombre,apellido,numero\nEva,Paz,N1\nLuz,Rey,N2\nSol,Mar,N2\n';

    expect(
      await new ImportStudents(world).execute({ actor: user, classId: cls.id, csv: text }),
    ).toEqual({
      ok: false,
      error: {
        code: 'invalid_rows',
        rows: [
          { line: 2, field: 'studentNumber', code: 'duplicate' },
          { line: 4, field: 'studentNumber', code: 'duplicate' },
        ],
      },
    });
  });

  it('passes on file-level problems, and refuses an archived or unmanaged class', async () => {
    const world = makeWorld();
    const { user, cls } = await classroom(world);

    expect(
      await new ImportStudents(world).execute({ actor: user, classId: cls.id, csv: 'email\nx' }),
    ).toEqual({
      ok: false,
      error: { code: 'csv_missing_columns', columns: ['firstName', 'lastName'] },
    });
    expect(
      await new ImportStudents(world).execute({
        actor: colleagueOf(user),
        classId: cls.id,
        csv: csv(1),
      }),
    ).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    await new ArchiveClass(world).execute({ actor: user, classId: cls.id });
    expect(
      await new ImportStudents(world).execute({ actor: user, classId: cls.id, csv: csv(1) }),
    ).toEqual({
      ok: false,
      error: { code: 'class_archived' },
    });
  });
});
