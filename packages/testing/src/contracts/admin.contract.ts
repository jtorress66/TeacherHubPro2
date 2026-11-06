import { describe, expect, it } from 'vitest';
import {
  issuePasswordToken,
  type ClassId,
  type StudentId,
  type LessonPlanId,
  type PasswordTokenId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type {
  ClassRepository,
  LessonPlanRepository,
  PasswordTokenRepository,
  PlatformStats,
  SchoolDirectory,
  SchoolRepository,
  StudentRepository,
  SubscriptionRepository,
  UserDirectory,
  UserRepository,
} from '@thp/ports';
import { aClass, aLessonPlan, aSchool, aStudent, aSubscription, aUser } from '../fixtures.ts';

/** The admin ports with the repositories a test writes its own rows through. */
export interface AdminSetup {
  readonly schoolDirectory: SchoolDirectory;
  readonly userDirectory: UserDirectory;
  readonly platformStats: PlatformStats;
  readonly passwordTokens: PasswordTokenRepository;
  readonly schools: SchoolRepository;
  readonly users: UserRepository;
  readonly classes: ClassRepository;
  readonly students: StudentRepository;
  readonly lessonPlans: LessonPlanRepository;
  readonly subscriptions: SubscriptionRepository;
}

const schoolA = 'adm-school-a' as SchoolId;
const schoolB = 'adm-school-b' as SchoolId;

async function seed(setup: AdminSetup) {
  await setup.schools.save(aSchool({ id: schoolA, name: 'Alpha School' }));
  await setup.schools.save(aSchool({ id: schoolB, name: 'Beta School' }));
  const ana = aUser({
    id: 'adm-ana' as UserId,
    schoolId: schoolA,
    email: 'ana@alpha.edu',
    name: 'Ana Rivera',
  });
  const ben = aUser({
    id: 'adm-ben' as UserId,
    schoolId: schoolA,
    email: 'ben@alpha.edu',
    name: 'Ben Ortiz',
    role: 'school_admin',
  });
  const cruz = aUser({
    id: 'adm-cruz' as UserId,
    schoolId: schoolB,
    email: 'cruz@beta.edu',
    name: 'Cruz Vega',
    role: 'super_admin',
  });
  for (const user of [ana, ben, cruz]) await setup.users.save(user);
  return { ana, ben, cruz };
}

/** Shared suites for the super admin ports. Each test writes its own rows (no parents needed). */
export function adminContract(name: string, make: () => AdminSetup): void {
  describe(`${name} (SchoolDirectory)`, () => {
    it('lists every school by name', async () => {
      const setup = make();
      await seed(setup);
      expect((await setup.schoolDirectory.listAll()).map((s) => s.name)).toEqual([
        'Alpha School',
        'Beta School',
      ]);
    });

    it('deletes only a school nobody belongs to', async () => {
      const setup = make();
      await seed(setup);
      const empty = 'adm-school-c' as SchoolId;
      await setup.schools.save(aSchool({ id: empty, name: 'Empty' }));
      expect(await setup.schoolDirectory.delete(schoolA)).toBe('in_use');
      expect(await setup.schoolDirectory.delete(empty)).toBe('deleted');
      expect(await setup.schools.findById(empty)).toBeNull();
      expect(await setup.schoolDirectory.delete(empty)).toBe('not_found');
    });
  });

  describe(`${name} (UserDirectory)`, () => {
    it('finds users across schools by school and by part of a name or email', async () => {
      const setup = make();
      const { ana, ben, cruz } = await seed(setup);
      const ids = async (query: Parameters<UserDirectory['search']>[0]) =>
        (await setup.userDirectory.search(query)).map((u) => u.id).sort();
      expect(await ids({ limit: 10 })).toEqual([ana.id, ben.id, cruz.id].sort());
      expect(await ids({ schoolId: schoolA, limit: 10 })).toEqual([ana.id, ben.id].sort());
      expect(await ids({ text: 'RIVERA', limit: 10 })).toEqual([ana.id]);
      expect(await ids({ text: '@beta', limit: 10 })).toEqual([cruz.id]);
      expect(await setup.userDirectory.search({ limit: 1 })).toHaveLength(1);
    });

    it('counts users by role', async () => {
      const setup = make();
      await seed(setup);
      expect(await setup.userDirectory.countByRole('super_admin')).toBe(1);
      expect(await setup.userDirectory.countByRole('teacher')).toBe(1);
    });

    it('deletes a user with their own plans, but not one a class or subscription names', async () => {
      const setup = make();
      const { ana, ben } = await seed(setup);
      await setup.lessonPlans.save(
        aLessonPlan({ id: 'adm-plan' as LessonPlanId, schoolId: schoolA, teacherId: ana.id }),
      );
      await setup.classes.save(
        aClass({ id: 'adm-class' as ClassId, schoolId: schoolA, teacherId: ben.id }),
      );

      expect(await setup.userDirectory.delete(ben.id)).toBe('in_use');
      expect(await setup.users.findById(schoolA, ben.id)).not.toBeNull();
      expect(await setup.userDirectory.delete(ana.id)).toBe('deleted');
      expect(await setup.users.findById(schoolA, ana.id)).toBeNull();
      expect(await setup.lessonPlans.findById(schoolA, 'adm-plan' as LessonPlanId)).toBeNull();
      expect(await setup.userDirectory.delete(ana.id)).toBe('not_found');

      const owner = aUser({ id: 'adm-owner' as UserId, schoolId: schoolB, email: 'o@beta.edu' });
      await setup.users.save(owner);
      await setup.subscriptions.save(aSubscription({ schoolId: schoolB, ownerId: owner.id }));
      expect(await setup.userDirectory.delete(owner.id)).toBe('in_use');
    });

    it('moves a user to another school with their own plans', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      await setup.lessonPlans.save(
        aLessonPlan({ id: 'adm-plan-2' as LessonPlanId, schoolId: schoolA, teacherId: ana.id }),
      );
      await setup.userDirectory.moveToSchool(ana.id, schoolB);
      expect((await setup.users.findById(schoolB, ana.id))?.schoolId).toBe(schoolB);
      expect(
        await setup.lessonPlans.findById(schoolB, 'adm-plan-2' as LessonPlanId),
      ).not.toBeNull();
      expect(await setup.lessonPlans.findById(schoolA, 'adm-plan-2' as LessonPlanId)).toBeNull();
    });
  });

  describe(`${name} (PlatformStats)`, () => {
    it('counts schools, users by role, classes and students, also per school', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      const cls = aClass({ id: 'adm-class-2' as ClassId, schoolId: schoolA, teacherId: ana.id });
      await setup.classes.save(cls);
      await setup.students.save(
        aStudent({ id: 'adm-st' as StudentId, schoolId: schoolA, classId: cls.id }),
      );

      const counts = await setup.platformStats.counts();
      expect(counts).toMatchObject({
        schools: 2,
        users: { teacher: 1, school_admin: 1, super_admin: 1 },
        classes: 1,
        students: 1,
        lessonPlans: 0,
      });
      expect(counts.perSchool).toEqual(
        expect.arrayContaining([
          { schoolId: schoolA, users: 2, classes: 1, students: 1 },
          { schoolId: schoolB, users: 1, classes: 0, students: 0 },
        ]),
      );
    });
  });

  describe(`${name} (PasswordTokenRepository)`, () => {
    it('finds a link by its hash, and keeps only the newest one usable', async () => {
      const setup = make();
      const { ana } = await seed(setup);
      const now = new Date('2026-11-05T12:00:00Z');
      const first = issuePasswordToken({
        id: 'adm-t1' as PasswordTokenId,
        userId: ana.id,
        schoolId: ana.schoolId,
        tokenHash: 'hash-1',
        purpose: 'welcome',
        now,
      });
      await setup.passwordTokens.save(first);
      expect(await setup.passwordTokens.findByHash('hash-1')).toEqual(first);
      expect(await setup.passwordTokens.findByHash('nope')).toBeNull();

      const later = new Date('2026-11-05T13:00:00Z');
      await setup.passwordTokens.revokeFor(ana.id, later);
      expect((await setup.passwordTokens.findByHash('hash-1'))?.usedAt).toEqual(later);
    });
  });
}
