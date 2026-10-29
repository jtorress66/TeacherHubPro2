import { describe, expect, it } from 'vitest';
import {
  createDateRange,
  markAttendance,
  type AssignmentId,
  type AttendanceSessionId,
  type ClassId,
  type Grade,
  type SchoolId,
  type StudentId,
} from '@thp/domain';
import type {
  AttendanceSessionRepository,
  GradeRepository,
  SchoolRepository,
  SubscriptionRepository,
  UserRepository,
} from '@thp/ports';
import { aGrade, anAttendanceSession, aSchool, aSubscription, aUser } from '../fixtures.ts';
import { unwrap } from '../unwrap.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export function schoolRepositoryContract(name: string, make: () => SchoolRepository): void {
  describe(`${name} (SchoolRepository contract)`, () => {
    it('saves, replaces and finds a school by id', async () => {
      const repository = make();
      const school = aSchool({ id: schoolA });
      await repository.save(school);
      await repository.save({ ...school, name: 'Renamed' });

      expect(await repository.findById(schoolA)).toEqual({ ...school, name: 'Renamed' });
      expect(await repository.findById(schoolB)).toBeNull();
    });
  });
}

export function userLookupContract(name: string, make: () => UserRepository): void {
  describe(`${name} (UserRepository lookups)`, () => {
    it('finds a user by email for sign-in', async () => {
      const repository = make();
      const user = aUser({ schoolId: schoolA, email: 'ana@mail.com' });
      await repository.save(user);

      expect(await repository.findByEmail(user.email)).toEqual(user);
      expect(await repository.findByEmail(aUser({ email: 'nobody@mail.com' }).email)).toBeNull();
    });
  });
}

export function subscriptionLookupContract(name: string, make: () => SubscriptionRepository): void {
  describe(`${name} (SubscriptionRepository lookups)`, () => {
    it('finds a subscription by the payment provider id', async () => {
      const repository = make();
      const subscription = { ...aSubscription({ schoolId: schoolA }), externalId: 'ext-9' };
      await repository.save(subscription);

      expect(await repository.findByExternalId('ext-9')).toEqual(subscription);
      expect(await repository.findByExternalId('ext-0')).toBeNull();
    });
  });
}

export function attendanceLookupContract(
  name: string,
  make: () => AttendanceSessionRepository,
): void {
  describe(`${name} (AttendanceSessionRepository lookups)`, () => {
    it('finds the session for a class and date within the school', async () => {
      const repository = make();
      const session = anAttendanceSession({ schoolId: schoolA, date: '2026-09-14' });
      await repository.save(session);

      expect(await repository.findByClassAndDate(schoolA, session.classId, session.date)).toEqual(
        session,
      );
      expect(
        await repository.findByClassAndDate(schoolB, session.classId, session.date),
      ).toBeNull();
      const otherDay = anAttendanceSession({ date: '2026-09-15' }).date;
      expect(await repository.findByClassAndDate(schoolA, session.classId, otherDay)).toBeNull();
    });

    it('keeps each mark’s minutes late and note', async () => {
      const repository = make();
      const studentId = 'student-1' as StudentId;
      const session = unwrap(
        markAttendance(anAttendanceSession({ schoolId: schoolA }), studentId, 'tardy', {
          minutesLate: 12,
          note: 'Doctor visit',
        }),
      );
      await repository.save(session);

      expect(await repository.findById(schoolA, session.id)).toEqual(session);
    });

    it('lists a class’s sessions by date, optionally within a date range', async () => {
      const repository = make();
      const classId = 'class-1' as ClassId;
      const on = (date: string, overrides: { classId?: ClassId; schoolId?: SchoolId } = {}) =>
        anAttendanceSession({
          id: `att-${date}-${overrides.classId ?? classId}-${overrides.schoolId ?? schoolA}` as AttendanceSessionId,
          schoolId: schoolA,
          classId,
          date,
          ...overrides,
        });
      for (const session of [
        on('2026-09-30'),
        on('2026-08-31'),
        on('2026-09-01'),
        on('2026-10-01'),
        on('2026-09-15', { classId: 'class-2' as ClassId }),
      ])
        await repository.save(session);

      const dates = (sessions: readonly { date: string }[]) => sessions.map(({ date }) => date);
      expect(dates(await repository.listByClass(schoolA, classId))).toEqual([
        '2026-08-31',
        '2026-09-01',
        '2026-09-30',
        '2026-10-01',
      ]);
      const september = unwrap(createDateRange('2026-09-01', '2026-09-30'));
      expect(dates(await repository.listByClass(schoolA, classId, september))).toEqual([
        '2026-09-01',
        '2026-09-30',
      ]);
    });
  });
}

export function gradeRepositoryContract(name: string, make: () => GradeRepository): void {
  describe(`${name} (GradeRepository contract)`, () => {
    const studentId = 'student-1' as StudentId;
    const assignmentId = 'a1' as AssignmentId;
    const grade = (id: string, score: number): Grade =>
      aGrade({
        id: id as Grade['id'],
        schoolId: schoolA,
        studentId,
        assignmentId,
        status: 'graded',
        score,
      });

    it('keeps one grade per student and assignment: saving another replaces it', async () => {
      const repository = make();
      await repository.save(grade('g1', 5));
      await repository.save(grade('g2', 9));

      expect(await repository.findFor(schoolA, studentId, assignmentId)).toEqual(grade('g2', 9));
      expect(await repository.listByStudent(schoolA, studentId)).toEqual([grade('g2', 9)]);
    });

    it("never returns another school's grade", async () => {
      const repository = make();
      await repository.save(grade('g1', 5));

      expect(await repository.findFor(schoolB, studentId, assignmentId)).toBeNull();
    });
  });
}
