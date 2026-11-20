import { afterAll } from 'vitest';
import type { ClassId, StudentId } from '@thp/domain';
import { aClass, aSchool, aStudent, aUser, schoolUsageReportContract } from '@thp/testing';
import { createPostgresRepositories } from '../../src/postgres/index.ts';
import { PostgresSchoolUsageReport } from '../../src/postgres/repositories/postgres-school-usage.ts';
import { connect, truncateAll } from './test-db.ts';

const db = connect();
const repos = createPostgresRepositories(db);
afterAll(() => db.destroy());

schoolUsageReportContract('PostgresSchoolUsageReport', async () => {
  await truncateAll(db);
  let next = 0;
  const id = (name: string) => `${name}-${String((next += 1))}`;
  return {
    report: new PostgresSchoolUsageReport(db),
    seed: async ({ schoolId, teachers }) => {
      await repos.schools.save(aSchool({ id: schoolId }));
      for (const teacher of teachers) {
        await repos.users.save(
          aUser({ id: teacher.id, schoolId, name: teacher.name, email: `${teacher.id}@x.edu` }),
        );
        if (teacher.lastActiveAt !== null) {
          await db
            .insertInto('sessions')
            .values({
              token_hash: id('token'),
              user_id: teacher.id,
              school_id: schoolId,
              created_at: teacher.lastActiveAt,
              expires_at: new Date(teacher.lastActiveAt.getTime() + 86_400_000),
              last_seen_at: teacher.lastActiveAt,
              device_browser: null,
              device_os: null,
              ended_at: null,
              ended_reason: null,
            })
            .execute();
        }
        const jobs = [
          ...(teacher.aiDraftsAt ?? []).map((at) => ({ kind: 'ai.test', at })),
          ...(teacher.otherJobsAt ?? []).map((at) => ({ kind: 'other.test', at })),
        ];
        for (const job of jobs) {
          await db
            .insertInto('jobs')
            .values({
              id: id('job'),
              school_id: schoolId,
              owner_id: teacher.id,
              kind: job.kind,
              payload: '{}',
              created_at: job.at,
            })
            .execute();
        }
        for (const seeded of teacher.classes ?? []) {
          const classId = id('class') as ClassId;
          await repos.classes.save({
            ...aClass({ id: classId, schoolId, teacherId: teacher.id }),
            sample: seeded.sample ?? false,
            archivedAt: seeded.archived ? new Date('2026-11-01T00:00:00Z') : null,
          });
          for (let s = 0; s < seeded.students; s += 1) {
            await repos.students.save(
              aStudent({ id: id('student') as StudentId, schoolId, classId }),
            );
          }
          for (const date of seeded.attendanceOn ?? []) {
            await db
              .insertInto('attendance_sessions')
              .values({
                id: id('day'),
                school_id: schoolId,
                class_id: classId,
                date,
                status: 'submitted',
              })
              .execute();
          }
          if ((seeded.assignmentsAt ?? []).length > 0) {
            const categoryId = id('category');
            await db
              .insertInto('grade_categories')
              .values({
                id: categoryId,
                school_id: schoolId,
                class_id: classId,
                name: 'Homework',
                weight_percent: 100,
              })
              .execute();
            for (const at of seeded.assignmentsAt ?? []) {
              await db
                .insertInto('assignments')
                .values({
                  id: id('assignment'),
                  school_id: schoolId,
                  class_id: classId,
                  category_id: categoryId,
                  title: 'Quiz',
                  points: 10,
                  due_date: null,
                  instructions: null,
                  questions: '[]',
                  created_at: at,
                })
                .execute();
            }
          }
        }
      }
    },
  };
});
