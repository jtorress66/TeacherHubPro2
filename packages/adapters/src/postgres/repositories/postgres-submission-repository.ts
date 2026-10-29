import type { Kysely } from 'kysely';
import type { AssignmentId, SchoolId, Submission, SubmissionId } from '@thp/domain';
import type { SubmissionRepository } from '@thp/ports';
import { submissionMapper } from '../mappers/gradebook-mappers.ts';
import type { Database } from '../schema.ts';
import { upsert } from '../upsert.ts';

export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(schoolId: SchoolId, id: SubmissionId): Promise<Submission | null> {
    const row = await this.db
      .selectFrom('submissions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('id', '=', id)
      .executeTakeFirst();
    return row === undefined ? null : submissionMapper.fromRow(row);
  }

  save(submission: Submission): Promise<void> {
    return upsert(this.db, 'submissions', submissionMapper.toRow(submission));
  }

  async listByAssignment(
    schoolId: SchoolId,
    assignmentId: AssignmentId,
  ): Promise<readonly Submission[]> {
    const rows = await this.db
      .selectFrom('submissions')
      .selectAll()
      .where('school_id', '=', schoolId)
      .where('assignment_id', '=', assignmentId)
      .orderBy('created_at')
      .orderBy('id')
      .execute();
    return rows.map(submissionMapper.fromRow);
  }
}
