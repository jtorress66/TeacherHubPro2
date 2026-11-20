import type { SchoolId, TeacherUsage } from '@thp/domain';

export interface SchoolUsageQuery {
  readonly schoolId: SchoolId;
  /** Activity on or after this moment is counted. */
  readonly since: Date;
  /** The background job kinds that are AI drafts (sending grades or making audio are not). */
  readonly aiJobKinds: readonly string[];
}

/** How much each person in a school uses the app: counts only, from records the app keeps. */
export interface SchoolUsageReport {
  /**
   * Everyone in the school, by name, with their classes and students now and their activity
   * since the date. Sample and archived classes are left out.
   */
  forSchool(query: SchoolUsageQuery): Promise<readonly TeacherUsage[]>;
}
