import type {
  AssistantSubject,
  CurriculumGuide,
  CurriculumGuideId,
  GradeLevel,
  SchoolId,
} from '@thp/domain';

/** A school's curriculum guides, at most one per subject and grade. */
export interface CurriculumGuideRepository {
  /** Adds the guide or replaces the one with the same ID. */
  save(guide: CurriculumGuide): Promise<void>;
  find(schoolId: SchoolId, id: CurriculumGuideId): Promise<CurriculumGuide | null>;
  findFor(
    schoolId: SchoolId,
    subject: AssistantSubject,
    grade: GradeLevel,
  ): Promise<CurriculumGuide | null>;
  listBySchool(schoolId: SchoolId): Promise<readonly CurriculumGuide[]>;
  remove(schoolId: SchoolId, id: CurriculumGuideId): Promise<void>;
}
