import { describe, expect, it } from 'vitest';
import type { ClassId, LearningPathId, LessonAttemptId, SchoolId, StudentId } from '@thp/domain';
import type { LearningPathRepository, LessonAttemptRepository } from '@thp/ports';
import { aLearningPath, aLessonAttempt } from '../fixtures.ts';
import { deletableContract, scopedRepositoryContract } from './scoped-repository.contract.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

export interface LearningRepositories {
  readonly paths: LearningPathRepository;
  readonly attempts: LessonAttemptRepository;
}

/**
 * Shared suites for learning paths and lesson attempts. Fixtures use class-1, teacher-1,
 * student-1 and student-2 in school-a; attempts use paths path-1 and path-2, so Postgres tests
 * seed those parents.
 */
export function learningRepositoryContract(name: string, make: () => LearningRepositories): void {
  const paths = {
    make: () => make().paths,
    sample: (schoolId: SchoolId, id: string) =>
      aLearningPath({ schoolId, id: id as LearningPathId }),
  };
  scopedRepositoryContract(`${name} learning paths`, {
    ...paths,
    change: (path) => ({ ...path, title: 'Fractions, again' }),
    lists: [
      {
        name: 'listByStudent',
        call: (repo, schoolId, path) => repo.listByStudent(schoolId, path.studentId),
      },
      {
        name: 'listByClass',
        call: (repo, schoolId, path) => repo.listByClass(schoolId, path.classId),
      },
    ],
  });
  deletableContract(`${name} learning paths`, paths);

  describe(`${name} (LearningPathRepository)`, () => {
    it('lists oldest first, only the student’s or the class’s', async () => {
      const repo = make().paths;
      const newer = aLearningPath({
        schoolId: schoolA,
        id: 'path-2' as LearningPathId,
        createdAt: new Date('2026-11-04T12:00:00Z'),
      });
      const older = aLearningPath({ schoolId: schoolA, id: 'path-1' as LearningPathId });
      await repo.save(newer);
      await repo.save(older);
      expect((await repo.listByStudent(schoolA, older.studentId)).map((p) => p.id)).toEqual([
        'path-1',
        'path-2',
      ]);
      expect(await repo.listByStudent(schoolA, 'student-2' as StudentId)).toEqual([]);
      expect(await repo.listByClass(schoolA, 'class-9' as ClassId)).toEqual([]);
    });

    it('keeps one assigned path per student and subject', async () => {
      const repo = make().paths;
      const first = aLearningPath({
        schoolId: schoolA,
        id: 'path-1' as LearningPathId,
        status: 'assigned',
        assignedAt: new Date('2026-11-04T11:00:00Z'),
      });
      await repo.save(first);
      const second = { ...first, id: 'path-2' as LearningPathId };
      await expect(repo.save(second)).rejects.toThrow();
      await repo.save({ ...second, subject: 'science' as const });
      await repo.save({ ...first, status: 'archived' });
      await repo.save({ ...second, subject: 'math' as const });
      expect((await repo.listByStudent(schoolA, first.studentId)).map((p) => p.status)).toEqual([
        'archived',
        'assigned',
      ]);
    });
  });

  describe(`${name} (LessonAttemptRepository)`, () => {
    it('keeps every attempt, oldest first, within the school and the paths asked for', async () => {
      const { paths: pathRepo, attempts } = make();
      await pathRepo.save(aLearningPath({ schoolId: schoolA, id: 'path-1' as LearningPathId }));
      await pathRepo.save(aLearningPath({ schoolId: schoolA, id: 'path-2' as LearningPathId }));
      const retry = aLessonAttempt({
        schoolId: schoolA,
        id: 'attempt-2' as LessonAttemptId,
        score: 3,
        at: new Date('2026-11-04T12:00:00Z'),
      });
      const first = aLessonAttempt({ schoolId: schoolA, answers: [0, null, 1] });
      const other = aLessonAttempt({
        schoolId: schoolA,
        id: 'attempt-3' as LessonAttemptId,
        pathId: 'path-2' as LearningPathId,
      });
      await attempts.save(retry);
      await attempts.save(first);
      await attempts.save(other);

      const listed = await attempts.listByPaths(schoolA, ['path-1' as LearningPathId]);
      expect(listed.map((a) => a.id)).toEqual(['attempt-1', 'attempt-2']);
      expect(listed[0]).toEqual(first);
      expect(await attempts.listByPaths(schoolB, ['path-1' as LearningPathId])).toEqual([]);
      expect(await attempts.listByPaths(schoolA, [])).toEqual([]);

      await attempts.deleteByPath(schoolB, 'path-1' as LearningPathId);
      expect(await attempts.listByPaths(schoolA, ['path-1' as LearningPathId])).toHaveLength(2);
      await attempts.deleteByPath(schoolA, 'path-1' as LearningPathId);
      expect(await attempts.listByPaths(schoolA, ['path-1' as LearningPathId])).toEqual([]);
      expect(await attempts.listByPaths(schoolA, ['path-2' as LearningPathId])).toHaveLength(1);
    });
  });
}
