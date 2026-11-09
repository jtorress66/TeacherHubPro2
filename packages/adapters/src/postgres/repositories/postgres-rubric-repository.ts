import type { Kysely } from 'kysely';
import {
  assistantSubjects,
  gradeLevels,
  type Rubric,
  type RubricCriterion,
  type RubricId,
  type RubricLevel,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { RubricRepository } from '@thp/ports';
import { oneOf, readJson, toJson, type TimedRowMapper } from '../mappers/columns.ts';
import type { Database, RubricsTable } from '../schema.ts';
import { upsert } from '../upsert.ts';

const nullableOneOf = <T extends string>(allowed: readonly T[], value: unknown, column: string) =>
  value === null ? null : oneOf(allowed, value, column);

export const rubricMapper: TimedRowMapper<Rubric, RubricsTable> = {
  toRow: (rubric) => ({
    id: rubric.id,
    school_id: rubric.schoolId,
    teacher_id: rubric.teacherId,
    title: rubric.title,
    subject: rubric.subject,
    grade: rubric.grade,
    levels: toJson(rubric.levels),
    criteria: toJson(rubric.criteria),
    created_at: rubric.createdAt,
    updated_at: rubric.updatedAt,
  }),
  fromRow: (row) => ({
    id: row.id as RubricId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    title: row.title,
    subject: nullableOneOf(assistantSubjects, row.subject, 'rubrics.subject'),
    grade: nullableOneOf(gradeLevels, row.grade, 'rubrics.grade'),
    levels: readJson(row.levels) as RubricLevel[],
    criteria: readJson(row.criteria) as RubricCriterion[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }),
};

export class PostgresRubricRepository implements RubricRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: RubricId): Promise<Rubric | null> {
    const row = await this.db
      .selectFrom('rubrics')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : rubricMapper.fromRow(row);
  }

  save(entity: Rubric): Promise<void> {
    return upsert(this.db, 'rubrics', rubricMapper.toRow(entity));
  }

  async delete(schoolId: SchoolId, id: RubricId): Promise<void> {
    await this.db
      .deleteFrom('rubrics')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }

  async listByTeacher(schoolId: SchoolId, teacherId: UserId): Promise<readonly Rubric[]> {
    const rows = await this.db
      .selectFrom('rubrics')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('teacher_id', '=', teacherId)
      .orderBy('updated_at', 'desc')
      .orderBy('id')
      .execute();
    return rows.map((row) => rubricMapper.fromRow(row));
  }
}
