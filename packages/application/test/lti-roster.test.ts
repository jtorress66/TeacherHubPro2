import { describe, expect, it } from 'vitest';
import type { ClassId, LtiCourse, LtiPlatformId, SchoolId, User, UserId } from '@thp/domain';
import {
  aUser,
  anLtiPlatform,
  FakeLtiMemberships,
  InMemoryLtiCourseRepository,
  InMemoryLtiPlatformRepository,
  InMemoryLtiStudentLinkRepository,
} from '@thp/testing';
import { ArchiveClass, CreateClass, ImportLtiRoster, ListLtiCourses } from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const lis = 'http://purl.imsglobal.org/vocab/lis/v2/membership';
const membershipsUrl = 'https://lms.lincoln.edu/api/lti/courses/9/names_and_roles';
const platformId = 'lti-platform-1' as LtiPlatformId;

const member = (userId: string, name: string, overrides: Record<string, unknown> = {}) => {
  const [given = '', ...family] = name.split(' ');
  return {
    user_id: userId,
    status: 'Active',
    given_name: given,
    family_name: family.join(' '),
    email: `${userId}@student.lincoln.edu`,
    roles: [`${lis}#Learner`],
    ...overrides,
  };
};

/** Science 5's class list: two new learners, one already on the roster, and others left out. */
const classList = [
  member('lms-ana', 'Ana Zayas'),
  member('lms-diego', 'Diego Ruiz'),
  member('lms-eva', 'Eva Soto'),
  member('lms-teacher', 'Ms Rivera', { roles: [`${lis}#Instructor`] }),
  member('lms-left', 'Fran Gil', { status: 'Inactive' }),
  member('lms-anon', '', { given_name: undefined, family_name: undefined }),
];

function rosterWorld(world: World) {
  const ltiPlatforms = new InMemoryLtiPlatformRepository();
  const ltiMemberships = new FakeLtiMemberships();
  ltiMemberships.setMembers(membershipsUrl, classList);
  return {
    ...world,
    ltiPlatforms,
    ltiCourses: new InMemoryLtiCourseRepository(ltiPlatforms),
    ltiStudentLinks: new InMemoryLtiStudentLinkRepository(ltiPlatforms, world.students),
    ltiMemberships,
  };
}
type RosterWorld = ReturnType<typeof rosterWorld>;

const courseOf = (actor: User, overrides: Partial<LtiCourse> = {}): LtiCourse => ({
  platformId,
  schoolId: actor.schoolId,
  teacherId: actor.id,
  contextId: 'course-9',
  title: 'Science 5',
  membershipsUrl,
  lastLaunchedAt: new Date('2026-09-01T08:00:00Z'),
  ...overrides,
});

/** A teacher with a class (Ana Zayas, Ben Acosta, Cara Morales) who opened Science 5 once. */
async function teacherWithCourse(world: World) {
  const graded = await gradedClass(world);
  const deps = rosterWorld(world);
  await deps.ltiPlatforms.save(anLtiPlatform({ id: platformId, schoolId: graded.actor.schoolId }));
  await deps.ltiCourses.save(courseOf(graded.actor));
  return { ...graded, deps };
}

const importInto = (deps: RosterWorld, actor: User, classId: ClassId, contextId = 'course-9') =>
  new ImportLtiRoster(deps).execute({ actor, classId, platformId, contextId });

const names = async (world: World, actor: User, classId: ClassId) =>
  (await world.students.listByClass(actor.schoolId, classId))
    .map((student) => `${student.firstName} ${student.lastName}`)
    .sort();

describe('ListLtiCourses', () => {
  it('lists the courses the teacher opened TeacherHubPro from, and no one else’s', async () => {
    const world = makeWorld();
    const { actor, deps } = await teacherWithCourse(world);
    const colleague = colleagueOf(actor);
    await deps.ltiCourses.save(courseOf(colleague, { contextId: 'course-2' }));

    expect(valueOf(await new ListLtiCourses(deps).execute({ actor }))).toEqual([courseOf(actor)]);
    expect(valueOf(await new ListLtiCourses(deps).execute({ actor: colleague }))).toHaveLength(1);
    const outsider = aUser({ id: actor.id, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });
    expect(valueOf(await new ListLtiCourses(deps).execute({ actor: outsider }))).toEqual([]);
  });
});

describe('ImportLtiRoster', () => {
  it('adds the course’s active learners, first and last name only', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);

    expect(valueOf(await importInto(deps, actor, cls.id))).toEqual({
      added: 2,
      alreadyThere: 1,
      noName: 1,
    });

    expect(await names(world, actor, cls.id)).toEqual([
      'Ana Zayas',
      'Ben Acosta',
      'Cara Morales',
      'Diego Ruiz',
      'Eva Soto',
    ]);
    const roster = await world.students.listByClass(actor.schoolId, cls.id);
    expect(roster.find((student) => student.firstName === 'Diego')).toMatchObject({
      studentNumber: null,
      parentEmail: null,
      accommodations: null,
    });
    expect(deps.ltiMemberships.calls).toEqual([membershipsUrl]);
  });

  it('links each learner to their roster student, matching a name already there', async () => {
    const world = makeWorld();
    const { actor, cls, ana, deps } = await teacherWithCourse(world);

    valueOf(await importInto(deps, actor, cls.id));

    const links = await deps.ltiStudentLinks.listForClass(actor.schoolId, cls.id, platformId);
    expect(links.map((link) => link.subject).sort()).toEqual(['lms-ana', 'lms-diego', 'lms-eva']);
    expect(links.find((link) => link.subject === 'lms-ana')?.studentId).toBe(ana.id);
  });

  it('adds only new learners when imported again, and never removes anyone', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    valueOf(await importInto(deps, actor, cls.id));
    deps.ltiMemberships.setMembers(membershipsUrl, [
      member('lms-ana', 'Ana Zayas'),
      member('lms-diego', 'Diego Ruiz-Lopez'),
      member('lms-gus', 'Gus Vega'),
    ]);

    expect(valueOf(await importInto(deps, actor, cls.id))).toEqual({
      added: 1,
      alreadyThere: 2,
      noName: 0,
    });
    expect(await names(world, actor, cls.id)).toEqual([
      'Ana Zayas',
      'Ben Acosta',
      'Cara Morales',
      'Diego Ruiz',
      'Eva Soto',
      'Gus Vega',
    ]);

    expect(valueOf(await importInto(deps, actor, cls.id))).toMatchObject({ added: 0 });
  });

  it('adds two learners with the same name as two students', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    deps.ltiMemberships.setMembers(membershipsUrl, [
      member('lms-1', 'Ana Zayas'),
      member('lms-2', 'Ana Zayas'),
      member('lms-3', 'Ana Zayas'),
    ]);

    expect(valueOf(await importInto(deps, actor, cls.id))).toEqual({
      added: 2,
      alreadyThere: 1,
      noName: 0,
    });
    expect((await names(world, actor, cls.id)).filter((name) => name === 'Ana Zayas')).toHaveLength(
      3,
    );
  });

  it('imports one course into several classes, a student in each', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    const other = valueOf(
      await new CreateClass(world).execute({ actor, details: { name: 'Science 5B' } }),
    );

    valueOf(await importInto(deps, actor, cls.id));
    expect(valueOf(await importInto(deps, actor, other.id))).toEqual({
      added: 3,
      alreadyThere: 0,
      noName: 1,
    });
    expect(await names(world, actor, other.id)).toEqual(['Ana Zayas', 'Diego Ruiz', 'Eva Soto']);
  });

  it('never imports into another school’s class or another teacher’s class', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId });
    await deps.ltiCourses.save(courseOf(outsider));
    const colleague = colleagueOf(actor);
    await deps.ltiCourses.save(courseOf(colleague));

    expect(await importInto(deps, outsider, cls.id)).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(await importInto(deps, colleague, cls.id)).toEqual({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(deps.ltiMemberships.calls).toEqual([]);
    expect(await world.students.listByClass(actor.schoolId, cls.id)).toHaveLength(3);
  });

  it('imports only a course the teacher opened themselves', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    const colleague = colleagueOf(actor);
    await deps.ltiCourses.save(courseOf(colleague, { contextId: 'course-2' }));

    for (const contextId of ['course-2', 'missing']) {
      expect(await importInto(deps, actor, cls.id, contextId)).toEqual({
        ok: false,
        error: { code: 'not_found' },
      });
    }
    expect(deps.ltiMemberships.calls).toEqual([]);
  });

  it('refuses an archived class', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    valueOf(await new ArchiveClass(world).execute({ actor, classId: cls.id }));

    expect(await importInto(deps, actor, cls.id)).toEqual({
      ok: false,
      error: { code: 'class_archived' },
    });
  });

  it('refuses once the school removed the course system', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    await deps.ltiPlatforms.delete(actor.schoolId, platformId);

    expect(await importInto(deps, actor, cls.id)).toEqual({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('explains a course whose course system shares no class list', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    await deps.ltiCourses.save(courseOf(actor, { membershipsUrl: null }));

    expect(await importInto(deps, actor, cls.id)).toEqual({
      ok: false,
      error: { code: 'course_system_refused' },
    });
    expect(deps.ltiMemberships.calls).toEqual([]);
  });

  it.each([
    ['not_allowed', 'course_system_refused'],
    ['unavailable', 'course_system_unavailable'],
  ] as const)('reports a course system that answers %s, adding no one', async (error, code) => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacherWithCourse(world);
    deps.ltiMemberships.failWith(error);

    expect(await importInto(deps, actor, cls.id)).toEqual({ ok: false, error: { code } });
    expect(await world.students.listByClass(actor.schoolId, cls.id)).toHaveLength(3);
  });

  it('adds learners to an empty class', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    const deps = rosterWorld(world);
    await deps.ltiPlatforms.save(anLtiPlatform({ id: platformId, schoolId: actor.schoolId }));
    await deps.ltiCourses.save(courseOf(actor));
    const cls = valueOf(await new CreateClass(world).execute({ actor, details: { name: 'Art' } }));

    expect(valueOf(await importInto(deps, actor, cls.id))).toEqual({
      added: 3,
      alreadyThere: 0,
      noName: 1,
    });
  });
});
