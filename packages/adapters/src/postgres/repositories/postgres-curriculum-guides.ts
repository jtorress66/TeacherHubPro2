import type { Kysely } from 'kysely';
import {
  assistantSubjects,
  curriculumGuideFailures,
  curriculumGuideStatuses,
  gradeLevels,
  type AssistantSubject,
  type CurriculumGuide,
  type CurriculumGuideId,
  type GradeLevel,
  type JobId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { CurriculumGuideRepository } from '@thp/ports';
import { oneOf } from '../mappers/columns.ts';
import type { CurriculumGuidesTable, Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

const toGuide = (row: CurriculumGuidesTable): CurriculumGuide => ({
  id: row.id as CurriculumGuideId,
  schoolId: row.school_id as SchoolId,
  subject: oneOf(assistantSubjects, row.subject, 'curriculum_guides.subject'),
  grade: oneOf(gradeLevels, row.grade, 'curriculum_guides.grade'),
  title: row.title,
  sourceName: row.source_name,
  status: oneOf(curriculumGuideStatuses, row.status, 'curriculum_guides.status'),
  failure:
    row.failure === null
      ? null
      : oneOf(curriculumGuideFailures, row.failure, 'curriculum_guides.failure'),
  jobId: row.job_id as JobId | null,
  text: row.text,
  totalCharacters: row.total_characters,
  updatedBy: row.updated_by as UserId,
  updatedAt: row.updated_at,
});

const toRow = (guide: CurriculumGuide): CurriculumGuidesTable => ({
  id: guide.id,
  school_id: guide.schoolId,
  subject: guide.subject,
  grade: guide.grade,
  title: guide.title,
  source_name: guide.sourceName,
  status: guide.status,
  failure: guide.failure,
  job_id: guide.jobId,
  text: guide.text,
  total_characters: guide.totalCharacters,
  updated_by: guide.updatedBy,
  updated_at: guide.updatedAt,
});

export class PostgresCurriculumGuideRepository implements CurriculumGuideRepository {
  constructor(private readonly db: Kysely<Database>) {}

  save(guide: CurriculumGuide): Promise<void> {
    return upsert(this.db, 'curriculum_guides', toRow(guide));
  }

  async find(schoolId: SchoolId, id: CurriculumGuideId): Promise<CurriculumGuide | null> {
    const row = await this.db
      .selectFrom('curriculum_guides')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : toGuide(row);
  }

  async findFor(
    schoolId: SchoolId,
    subject: AssistantSubject,
    grade: GradeLevel,
  ): Promise<CurriculumGuide | null> {
    const row = await this.db
      .selectFrom('curriculum_guides')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('subject', '=', subject)
      .where('grade', '=', grade)
      .executeTakeFirst();
    return row === undefined ? null : toGuide(row);
  }

  async listBySchool(schoolId: SchoolId): Promise<readonly CurriculumGuide[]> {
    const rows = await this.db
      .selectFrom('curriculum_guides')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('id')
      .execute();
    return rows.map(toGuide);
  }

  async remove(schoolId: SchoolId, id: CurriculumGuideId): Promise<void> {
    await this.db
      .deleteFrom('curriculum_guides')
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .execute();
  }
}
