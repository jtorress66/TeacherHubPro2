import type { SchoolId, UserId } from '../shared/ids.ts';

/**
 * A teacher's calendar subscription link. Only a hash of its secret is kept, so the full address
 * is shown once when it is made; making a new one replaces it, and turning it off deletes it.
 */
export interface CalendarFeed {
  readonly teacherId: UserId;
  readonly schoolId: SchoolId;
  readonly tokenHash: string;
  readonly createdAt: Date;
}
