import type { LtiPlatformId, SchoolId, UserId } from '../shared/ids.ts';
import type { LtiPlacedItem } from './lti-deep-linking.ts';

/**
 * An assignment or game a teacher placed in a course (deep linking): remembered so its students
 * can open it from there, and so the teacher can send its grades to that course.
 */
export interface LtiPlacement {
  readonly platformId: LtiPlatformId;
  /** The course's id in the course system. */
  readonly contextId: string;
  readonly item: LtiPlacedItem;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  readonly placedAt: Date;
}
