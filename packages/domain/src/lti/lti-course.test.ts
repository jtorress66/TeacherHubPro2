import { describe, expect, it } from 'vitest';
import type { LtiPlatformId, SchoolId, UserId } from '../shared/ids.ts';
import { ltiCourseOf } from './lti-course.ts';
import type { LtiLaunch } from './lti-launch.ts';

const now = new Date('2026-11-13T12:00:00Z');
const teacher = { id: 'teacher-1' as UserId, schoolId: 'school-1' as SchoolId };

const launch = (overrides: Partial<LtiLaunch> = {}): LtiLaunch => ({
  platformId: 'platform-1' as LtiPlatformId,
  subject: 'lms-user-7',
  role: 'teacher',
  contextId: 'course-9',
  contextTitle: 'Science 5',
  resourceLinkId: 'link-3',
  givenName: 'Ana',
  locale: null,
  membershipsUrl: 'https://lms.lincoln.edu/api/lti/courses/9/names_and_roles',
  expiresAt: new Date('2026-11-13T12:05:00Z'),
  ...overrides,
});

describe('ltiCourseOf', () => {
  it('remembers the course a teacher launched from, for that teacher', () => {
    expect(ltiCourseOf(launch(), teacher, now)).toEqual({
      platformId: 'platform-1',
      schoolId: 'school-1',
      teacherId: 'teacher-1',
      contextId: 'course-9',
      title: 'Science 5',
      membershipsUrl: 'https://lms.lincoln.edu/api/lti/courses/9/names_and_roles',
      lastLaunchedAt: now,
    });
  });

  it('names an untitled course by its id, and keeps a long title short', () => {
    expect(ltiCourseOf(launch({ contextTitle: null }), teacher, now)?.title).toBe('course-9');
    expect(ltiCourseOf(launch({ contextTitle: 'S'.repeat(300) }), teacher, now)?.title).toBe(
      'S'.repeat(200),
    );
  });

  it('remembers nothing for a launch outside a course', () => {
    expect(ltiCourseOf(launch({ contextId: null }), teacher, now)).toBeNull();
  });
});
