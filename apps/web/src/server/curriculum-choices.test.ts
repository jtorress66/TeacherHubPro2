import { describe, expect, it } from 'vitest';
import type { CurriculumGuideEntry } from '@thp/application';
import { curriculumChoices, guideFor } from './curriculum-choices.ts';

const entry = (overrides: Partial<CurriculumGuideEntry>): CurriculumGuideEntry =>
  ({
    subject: 'math',
    grade: '4',
    title: 'Math 4 pacing',
    status: 'ready',
    ...overrides,
  }) as CurriculumGuideEntry;

describe('curriculumChoices', () => {
  it('offers the AI only the guides that are ready, with their subject, grade and title', () => {
    const choices = curriculumChoices([
      entry({}),
      entry({ subject: 'science', grade: 'K', title: 'Science K', status: 'reading' }),
      entry({ subject: 'ela', grade: '5', title: 'ELA 5', status: 'failed' }),
    ]);

    expect(choices).toEqual([{ subject: 'math', grade: '4', title: 'Math 4 pacing' }]);
  });
});

describe('guideFor', () => {
  it('finds the guide for the chosen subject and grade, or none', () => {
    const choices = [{ subject: 'math', grade: '4', title: 'Math 4 pacing' }];

    expect(guideFor(choices, 'math', '4')?.title).toBe('Math 4 pacing');
    expect(guideFor(choices, 'math', '5')).toBeUndefined();
  });
});
