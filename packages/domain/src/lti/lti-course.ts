import type { LtiPlatformId, SchoolId, UserId } from '../shared/ids.ts';
import type { LtiLaunch } from './lti-launch.ts';

/**
 * A course a teacher has opened TeacherHubPro from: remembered for that teacher, so they can
 * import its class list later.
 */
export interface LtiCourse {
  readonly platformId: LtiPlatformId;
  readonly schoolId: SchoolId;
  readonly teacherId: UserId;
  /** The course's id in the course system (the launch's context). */
  readonly contextId: string;
  readonly title: string;
  /** Where its class list can be read; null when the course system did not offer it. */
  readonly membershipsUrl: string | null;
  readonly lastLaunchedAt: Date;
}

const maxTitleLength = 200;

/** What a launch says about its course. */
export type LtiCourseSource = Pick<
  LtiLaunch,
  'platformId' | 'contextId' | 'contextTitle' | 'membershipsUrl'
>;

/** The course a teacher's launch came from; null for a launch outside a course. */
export function ltiCourseOf(
  launch: LtiCourseSource,
  teacher: { readonly id: UserId; readonly schoolId: SchoolId },
  now: Date,
): LtiCourse | null {
  if (launch.contextId === null) return null;
  return {
    platformId: launch.platformId,
    schoolId: teacher.schoolId,
    teacherId: teacher.id,
    contextId: launch.contextId,
    title: (launch.contextTitle ?? launch.contextId).slice(0, maxTitleLength),
    membershipsUrl: launch.membershipsUrl,
    lastLaunchedAt: now,
  };
}
