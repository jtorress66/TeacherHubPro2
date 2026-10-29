import type { Kysely } from 'kysely';
import type { SchoolId, Semester, SemesterId } from '@thp/domain';
import type { SemesterRepository } from '@thp/ports';
import { semesterMapper } from '../mappers/school-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresSemesterRepository implements SemesterRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: SemesterId): Promise<Semester | null> {
    const row = await this.db
      .selectFrom('semesters')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : semesterMapper.fromRow(row);
  }

  save(semester: Semester): Promise<void> {
    return upsert(this.db, 'semesters', semesterMapper.toRow(semester));
  }

  async listBySchool(schoolId: SchoolId): Promise<readonly Semester[]> {
    const rows = await this.db
      .selectFrom('semesters')
      .selectAll()
      .where('school_id', '=', schoolId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(semesterMapper.fromRow);
  }
}
