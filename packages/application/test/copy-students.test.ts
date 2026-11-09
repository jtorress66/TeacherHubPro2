import { describe, expect, it } from 'vitest';
import type { ClassId, User, UserId } from '@thp/domain';
import { aUser } from '@thp/testing';
import { AddStudent, ArchiveClass, CopyStudents, CreateClass, ListStudents } from '../src/index.ts';
import { makeWorld, signedUp, type World } from './world.ts';

async function newClass(world: World, actor: User, name: string): Promise<ClassId> {
  const created = await new CreateClass(world).execute({ actor, details: { name } });
  if (!created.ok) throw new Error('class');
  return created.value.id;
}

async function add(
  world: World,
  actor: User,
  classId: ClassId,
  firstName: string,
  studentNumber = '',
) {
  const added = await new AddStudent(world).execute({
    actor,
    classId,
    details: {
      firstName,
      lastName: 'Rivera',
      studentNumber,
      parentEmail: 'mama@mail.com',
      accommodations: 'Front seat',
    },
  });
  if (!added.ok) throw new Error('student');
  return added.value;
}

async function twoClasses(world: World) {
  const { user } = await signedUp(world);
  const from = await newClass(world, user, 'Inglés 7A');
  const to = await newClass(world, user, 'Inglés 7B');
  return { user, from, to };
}

describe('CopyStudents', () => {
  it("copies another class's roster as new students, keeping their details", async () => {
    const world = makeWorld();
    const { user, from, to } = await twoClasses(world);
    const ana = await add(world, user, from, 'Ana', 'N1');
    await add(world, user, from, 'Ben');

    const copied = await new CopyStudents(world).execute({
      actor: user,
      fromClassId: from,
      toClassId: to,
    });

    expect(copied).toEqual({ ok: true, value: { copied: 2, skipped: 0 } });
    const listed = await new ListStudents(world).execute({ actor: user, classId: to });
    const roster = listed.ok ? listed.value : [];
    expect(roster.map((student) => student.firstName).sort()).toEqual(['Ana', 'Ben']);
    const copy = roster.find((student) => student.firstName === 'Ana');
    expect(copy).toMatchObject({
      classId: to,
      lastName: 'Rivera',
      studentNumber: 'N1',
      parentEmail: 'mama@mail.com',
      accommodations: 'Front seat',
    });
    expect(copy?.id).not.toBe(ana.id);
  });

  it('skips students already in the class, by student number or by name', async () => {
    const world = makeWorld();
    const { user, from, to } = await twoClasses(world);
    await add(world, user, from, 'Ana', 'N1');
    await add(world, user, from, 'Ben');
    await add(world, user, from, 'Cara');
    await add(world, user, to, 'Anita', 'N1');
    await add(world, user, to, 'BEN');

    const copied = await new CopyStudents(world).execute({
      actor: user,
      fromClassId: from,
      toClassId: to,
    });

    expect(copied).toEqual({ ok: true, value: { copied: 1, skipped: 2 } });
  });

  it('refuses copying a class into itself and into an archived class', async () => {
    const world = makeWorld();
    const { user, from, to } = await twoClasses(world);
    await new ArchiveClass(world).execute({ actor: user, classId: to });
    const copy = new CopyStudents(world);

    expect(await copy.execute({ actor: user, fromClassId: from, toClassId: from })).toEqual({
      ok: false,
      error: { field: 'fromClassId', code: 'not_allowed' },
    });
    expect(await copy.execute({ actor: user, fromClassId: from, toClassId: to })).toEqual({
      ok: false,
      error: { code: 'class_archived' },
    });
  });

  it("refuses a colleague's class and another school's class", async () => {
    const world = makeWorld();
    const { user, to } = await twoClasses(world);
    const colleague = aUser({ id: 'colleague' as UserId, schoolId: user.schoolId });
    const theirs = await newClass(world, colleague, 'Their class');
    const stranger = aUser({ id: 'stranger' as UserId });
    const elsewhere = await newClass(world, stranger, 'Other school');
    const copy = new CopyStudents(world);

    expect(await copy.execute({ actor: user, fromClassId: theirs, toClassId: to })).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await copy.execute({ actor: user, fromClassId: elsewhere, toClassId: to })).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});
