import { jobStatuses, type Job, type JobId, type SchoolId, type UserId } from '@thp/domain';
import type { Selectable } from 'kysely';
import type { JobsTable } from '../schema.ts';
import { oneOf, readJson } from './columns.ts';

export const jobFromRow = (row: Selectable<JobsTable>): Job => ({
  id: row.id as JobId,
  schoolId: row.school_id as SchoolId,
  ownerId: row.owner_id as UserId,
  kind: row.kind,
  payload: readJson(row.payload),
  status: oneOf(jobStatuses, row.status, 'jobs.status'),
  result: row.result === null ? null : readJson(row.result),
  error: row.error,
  attempts: row.attempts,
  createdAt: row.created_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
});
