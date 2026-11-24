import { describe, expect, it } from 'vitest';
import type { JobId, SchoolId, UserId } from '../shared/ids.ts';
import {
  byCurriculumOrder,
  curriculumFileKindOf,
  curriculumGuideRead,
  curriculumGuideUnreadable,
  guideExcerpt,
  guideUsage,
  maxCurriculumExcerpt,
  maxCurriculumText,
  minCurriculumText,
  pastedCurriculumGuide,
  uploadedCurriculumGuide,
  withReadingJob,
  type CurriculumGuide,
  type CurriculumGuideId,
} from './curriculum-guide.ts';

const now = new Date('2026-11-24T15:00:00Z');
const base = {
  id: 'guide-1' as CurriculumGuideId,
  schoolId: 'school-1' as SchoolId,
  subject: 'math',
  grade: '4',
  title: '  Grade 4 math pacing guide ',
  updatedBy: 'u-admin' as UserId,
  now,
};
const unit = 'Unit 1: Place value to one million. Students round and compare whole numbers.';

function valueOf<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe('pastedCurriculumGuide', () => {
  it('is ready at once, with the text tidied and its length counted', () => {
    const guide = valueOf(
      pastedCurriculumGuide({
        ...base,
        text: `\r\n  ${unit}   \r\n\r\n\r\n\r\nUnit 2: Fractions.  `,
      }),
    );

    expect(guide).toEqual({
      id: base.id,
      schoolId: base.schoolId,
      subject: 'math',
      grade: '4',
      title: 'Grade 4 math pacing guide',
      sourceName: null,
      status: 'ready',
      failure: null,
      jobId: null,
      text: `${unit}\n\nUnit 2: Fractions.`,
      totalCharacters: unit.length + 20,
      updatedBy: base.updatedBy,
      updatedAt: now,
    });
  });

  it('needs a known subject and grade, a title and enough text to follow', () => {
    expect(pastedCurriculumGuide({ ...base, subject: 'alchemy', text: unit })).toEqual({
      ok: false,
      error: { field: 'subject', code: 'not_allowed' },
    });
    expect(pastedCurriculumGuide({ ...base, grade: '13', text: unit })).toEqual({
      ok: false,
      error: { field: 'grade', code: 'not_allowed' },
    });
    expect(pastedCurriculumGuide({ ...base, title: ' ', text: unit })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
    expect(pastedCurriculumGuide({ ...base, text: ' too short ' })).toEqual({
      ok: false,
      error: { field: 'text', code: 'too_short' },
    });
    expect(minCurriculumText).toBe(40);
  });

  it(`refuses pasted text longer than ${String(maxCurriculumText)} characters`, () => {
    expect(pastedCurriculumGuide({ ...base, text: 'a'.repeat(maxCurriculumText + 1) })).toEqual({
      ok: false,
      error: { field: 'text', code: 'too_long' },
    });
  });
});

describe('uploadedCurriculumGuide', () => {
  const upload = { ...base, sourceName: 'Pacing Guide.docx' };

  it('waits for its file to be read, by the job it is given', () => {
    const guide = valueOf(uploadedCurriculumGuide(upload));

    expect(guide).toMatchObject({
      status: 'reading',
      sourceName: 'Pacing Guide.docx',
      jobId: null,
      text: '',
      totalCharacters: 0,
      failure: null,
    });
    expect(withReadingJob(guide, 'job-1' as JobId).jobId).toBe('job-1');
  });

  it('checks the same fields as pasted text', () => {
    expect(uploadedCurriculumGuide({ ...upload, title: '' })).toEqual({
      ok: false,
      error: { field: 'title', code: 'required' },
    });
  });

  it('becomes ready with the file’s text, keeping at most the stored limit', () => {
    const reading = valueOf(uploadedCurriculumGuide(upload));
    const later = new Date('2026-11-24T15:01:00Z');
    const long = `${unit} ${'x'.repeat(maxCurriculumText)}`;

    const read = curriculumGuideRead(reading, long, later);

    expect(read.status).toBe('ready');
    expect(read.text).toHaveLength(maxCurriculumText);
    expect(read.totalCharacters).toBe(long.length);
    expect(read.updatedAt).toEqual(later);
  });

  it('fails when the file has no text, or too little, or cannot be read', () => {
    const reading = valueOf(uploadedCurriculumGuide(upload));

    expect(curriculumGuideRead(reading, '  \n ', now)).toMatchObject({
      status: 'failed',
      failure: 'no_text',
      text: '',
    });
    expect(curriculumGuideUnreadable(reading, now)).toMatchObject({
      status: 'failed',
      failure: 'unreadable',
    });
  });
});

describe('curriculumFileKindOf', () => {
  it('knows PDF and Word files by their name', () => {
    expect(curriculumFileKindOf('Guide.PDF')).toBe('pdf');
    expect(curriculumFileKindOf('scope and sequence.docx')).toBe('docx');
    expect(curriculumFileKindOf('old.doc')).toBeNull();
    expect(curriculumFileKindOf('notes.txt')).toBeNull();
    expect(curriculumFileKindOf('pdf')).toBeNull();
  });
});

describe('guideExcerpt and guideUsage', () => {
  const ready = (text: string): CurriculumGuide =>
    curriculumGuideRead(
      valueOf(uploadedCurriculumGuide({ ...base, sourceName: 'g.pdf' })),
      text,
      now,
    );

  it('gives the AI the whole guide when it is short enough', () => {
    const guide = ready(unit);

    expect(guideExcerpt(guide)).toBe(unit);
    expect(guideUsage(guide)).toEqual({ used: unit.length, total: unit.length });
  });

  it(`gives the AI the first ${String(maxCurriculumExcerpt)} characters, cut between words`, () => {
    const words = 'fractions '.repeat(3000);
    const guide = ready(words);

    const excerpt = guideExcerpt(guide);

    expect(excerpt.length).toBeLessThanOrEqual(maxCurriculumExcerpt);
    expect(excerpt.length).toBeGreaterThan(maxCurriculumExcerpt - 20);
    expect(excerpt.endsWith('fractions')).toBe(true);
    expect(guideUsage(guide)).toEqual({ used: excerpt.length, total: words.trim().length });
  });

  it('gives nothing from a guide that is not ready', () => {
    const reading = valueOf(uploadedCurriculumGuide({ ...base, sourceName: 'g.pdf' }));

    expect(guideExcerpt(reading)).toBe('');
    expect(guideUsage(reading)).toEqual({ used: 0, total: 0 });
  });
});

describe('byCurriculumOrder', () => {
  it('lists guides by subject, then grade, as the forms do', () => {
    const make = (subject: string, grade: string) =>
      valueOf(pastedCurriculumGuide({ ...base, subject, grade, text: unit }));
    const guides = [make('science', '1'), make('math', '10'), make('math', 'K'), make('math', '2')];

    expect([...guides].sort(byCurriculumOrder).map((g) => `${g.subject} ${g.grade}`)).toEqual([
      'math K',
      'math 2',
      'math 10',
      'science 1',
    ]);
  });
});
