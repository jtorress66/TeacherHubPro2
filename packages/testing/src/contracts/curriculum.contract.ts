import { describe, expect, it } from 'vitest';
import {
  pastedCurriculumGuide,
  type CurriculumGuide,
  type CurriculumGuideId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import type { CurriculumGuideRepository } from '@thp/ports';

/** Uses the shared fixtures: teacher-1 at school-a, and school-b as another school. */
const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const now = new Date('2026-11-24T15:00:00Z');
const text = 'Unit 1: Place value to one million. Unit 2: Multiplying by one digit.';

function guide(
  id: string,
  subject: string,
  grade: string,
  overrides: Partial<CurriculumGuide> = {},
): CurriculumGuide {
  const made = pastedCurriculumGuide({
    id: id as CurriculumGuideId,
    schoolId: schoolA,
    subject,
    grade,
    title: `${subject} ${grade}`,
    updatedBy: 'teacher-1' as UserId,
    now,
    text,
  });
  if (!made.ok) throw new Error('bad fixture');
  return { ...made.value, ...overrides };
}

export function curriculumGuideRepositoryContract(
  name: string,
  make: () => CurriculumGuideRepository,
): void {
  describe(`${name} (CurriculumGuideRepository contract)`, () => {
    it('keeps a guide and finds it by ID or by subject and grade, in its school only', async () => {
      const guides = make();
      const math4 = guide('guide-1', 'math', '4');
      await guides.save(math4);

      expect(await guides.find(schoolA, math4.id)).toEqual(math4);
      expect(await guides.findFor(schoolA, 'math', '4')).toEqual(math4);
      expect(await guides.findFor(schoolA, 'math', '5')).toBeNull();
      expect(await guides.findFor(schoolA, 'science', '4')).toBeNull();
      expect(await guides.find(schoolB, math4.id)).toBeNull();
      expect(await guides.findFor(schoolB, 'math', '4')).toBeNull();
    });

    it('replaces a guide saved again with the same ID', async () => {
      const guides = make();
      await guides.save(
        guide('guide-1', 'math', '4', {
          status: 'reading',
          text: '',
          totalCharacters: 0,
          sourceName: 'Guide.docx',
          jobId: 'job-1' as CurriculumGuide['jobId'],
        }),
      );
      const ready = guide('guide-1', 'math', '4', {
        title: 'New title',
        sourceName: 'Guide.docx',
        jobId: 'job-1' as CurriculumGuide['jobId'],
        updatedAt: new Date('2026-11-24T16:00:00Z'),
      });

      await guides.save(ready);

      expect(await guides.listBySchool(schoolA)).toEqual([ready]);
    });

    it('keeps a failed guide with its reason', async () => {
      const guides = make();
      const failed = guide('guide-1', 'ela', 'K', {
        status: 'failed',
        failure: 'no_text',
        text: '',
        totalCharacters: 0,
      });

      await guides.save(failed);

      expect(await guides.find(schoolA, failed.id)).toEqual(failed);
    });

    it("lists a school's guides and removes one", async () => {
      const guides = make();
      const math4 = guide('guide-1', 'math', '4');
      const science5 = guide('guide-2', 'science', '5');
      await guides.save(math4);
      await guides.save(science5);

      expect(
        [...(await guides.listBySchool(schoolA))].sort((a, b) => a.id.localeCompare(b.id)),
      ).toEqual([math4, science5]);
      expect(await guides.listBySchool(schoolB)).toEqual([]);

      await guides.remove(schoolB, math4.id);
      expect(await guides.find(schoolA, math4.id)).toEqual(math4);

      await guides.remove(schoolA, math4.id);
      expect(await guides.listBySchool(schoolA)).toEqual([science5]);
    });
  });
}
