import {
  type ClassId,
  type JobId,
  type ParentEmail,
  type PrepBatch,
  type PrepBatchId,
  type PrepItem,
  type PrepPublished,
  type PrepRequest,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { PrepBatchesTable } from '../schema.ts';
import { oneOf, readJson, toJson, type RowMapper } from './columns.ts';

const statuses = ['running', 'ready', 'failed', 'published'] as const;

/** Reads a JSON column this code wrote; anything but an object or list means outside changes. */
function stored(value: unknown, column: string): object {
  const json = readJson(value);
  if (typeof json !== 'object' || json === null) {
    throw new Error(`Unexpected value in prep_batches.${column}`);
  }
  return json;
}

const optional = (value: unknown, column: string): object | null =>
  value === null ? null : stored(value, column);

export const prepBatchMapper: RowMapper<PrepBatch, PrepBatchesTable> = {
  toRow: (batch) => ({
    id: batch.id,
    school_id: batch.schoolId,
    teacher_id: batch.teacherId,
    class_id: batch.classId,
    request: toJson(batch.request),
    status: batch.status,
    items: toJson(batch.items),
    parent_email: batch.parentEmail === null ? null : toJson(batch.parentEmail),
    job_id: batch.jobId,
    started_at: batch.createdAt,
    ready_at: batch.readyAt,
    published_at: batch.publishedAt,
    published: batch.published === null ? null : toJson(batch.published),
  }),
  fromRow: (row) => ({
    id: row.id as PrepBatchId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    classId: row.class_id as ClassId,
    request: stored(row.request, 'request') as PrepRequest,
    status: oneOf(statuses, row.status, 'prep_batches.status'),
    items: stored(row.items, 'items') as readonly PrepItem[],
    parentEmail: optional(row.parent_email, 'parent_email') as ParentEmail | null,
    jobId: row.job_id as JobId,
    createdAt: row.started_at,
    readyAt: row.ready_at,
    publishedAt: row.published_at,
    published: optional(row.published, 'published') as PrepPublished | null,
  }),
};
