import type { Kysely } from 'kysely';
import type {
  ClassId,
  LearningPath,
  LearningPathId,
  LessonAttempt,
  SchoolId,
  StudentId,
} from '@thp/domain';
import type { LearningPathRepository, LessonAttemptRepository } from '@thp/ports';
import { learningPathMapper, lessonAttemptMapper } from '../mappers/learning-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresLearningPathRepository implements LearningPathRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: LearningPathId): Promise<LearningPath | null> {
    const row = await this.db
      .selectFrom('learning_paths')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : learningPathMapper.fromRow(row);
  }

  /** A second assigned path for the student in the subject breaks a unique index and fails. */
  save(path: LearningPath): Promise<void> {
    return upsert(this.db, 'learning_paths', learningPathMapper.toRow(path));
  }

  async delete(schoolId: SchoolId, id: LearningPathId): Promise<void> {
    await this.db
      .deleteFrom('learning_paths')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  listByStudent(schoolId: SchoolId, studentId: StudentId): Promise<readonly LearningPath[]> {
    return this.list(schoolId, 'student_id', studentId);
  }

  listByClass(schoolId: SchoolId, classId: ClassId): Promise<readonly LearningPath[]> {
    return this.list(schoolId, 'class_id', classId);
  }

  private async list(
    schoolId: SchoolId,
    column: 'student_id' | 'class_id',
    value: string,
  ): Promise<readonly LearningPath[]> {
    const rows = await this.db
      .selectFrom('learning_paths')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where(column, '=', value)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(learningPathMapper.fromRow);
  }
}

export class PostgresLessonAttemptRepository implements LessonAttemptRepository {
  constructor(private readonly db: Kysely<Database>) {}

  save(attempt: LessonAttempt): Promise<void> {
    return upsert(this.db, 'lesson_attempts', lessonAttemptMapper.toRow(attempt));
  }

  async listByPaths(
    schoolId: SchoolId,
    pathIds: readonly LearningPathId[],
  ): Promise<readonly LessonAttempt[]> {
    if (pathIds.length === 0) return [];
    const rows = await this.db
      .selectFrom('lesson_attempts')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('path_id', 'in', pathIds)
      .orderBy('at')
      .orderBy('id')
      .execute();
    return rows.map(lessonAttemptMapper.fromRow);
  }

  async deleteByPath(schoolId: SchoolId, pathId: LearningPathId): Promise<void> {
    await this.db
      .deleteFrom('lesson_attempts')
      .where('school_id', '=', schoolId)
      .where('path_id', '=', pathId)
      .execute();
  }
}
