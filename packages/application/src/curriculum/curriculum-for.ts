import {
  curriculumExcerptOf,
  type AssistantSubject,
  type CurriculumExcerpt,
  type GradeLevel,
  type SchoolId,
} from '@thp/domain';
import type { CurriculumGuideRepository } from '@thp/ports';

/**
 * The school's guide for a subject and grade, as the AI reads it, when the teacher asked to follow
 * it. Only the caller's own school is searched. Null when not asked, or there is no ready guide.
 */
export async function curriculumFor(
  guides: CurriculumGuideRepository,
  request: {
    readonly schoolId: SchoolId;
    readonly subject: AssistantSubject | null;
    readonly grade: GradeLevel;
    readonly followCurriculum: boolean;
  },
): Promise<CurriculumExcerpt | null> {
  if (!request.followCurriculum || request.subject === null) return null;
  const guide = await guides.findFor(request.schoolId, request.subject, request.grade);
  return curriculumExcerptOf(guide);
}
