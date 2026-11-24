import type {
  AssistantSubject,
  CurriculumGuide,
  CurriculumGuideId,
  GradeLevel,
  SchoolId,
} from '@thp/domain';
import type { CurriculumGuideRepository } from '@thp/ports';

export class InMemoryCurriculumGuideRepository implements CurriculumGuideRepository {
  private readonly guides = new Map<string, CurriculumGuide>();

  save(guide: CurriculumGuide): Promise<void> {
    this.guides.set(guide.id, guide);
    return Promise.resolve();
  }

  find(schoolId: SchoolId, id: CurriculumGuideId): Promise<CurriculumGuide | null> {
    const guide = this.guides.get(id);
    return Promise.resolve(guide?.schoolId === schoolId ? guide : null);
  }

  findFor(
    schoolId: SchoolId,
    subject: AssistantSubject,
    grade: GradeLevel,
  ): Promise<CurriculumGuide | null> {
    return Promise.resolve(
      [...this.guides.values()].find(
        (g) => g.schoolId === schoolId && g.subject === subject && g.grade === grade,
      ) ?? null,
    );
  }

  listBySchool(schoolId: SchoolId): Promise<readonly CurriculumGuide[]> {
    return Promise.resolve([...this.guides.values()].filter((g) => g.schoolId === schoolId));
  }

  remove(schoolId: SchoolId, id: CurriculumGuideId): Promise<void> {
    if (this.guides.get(id)?.schoolId === schoolId) this.guides.delete(id);
    return Promise.resolve();
  }
}
