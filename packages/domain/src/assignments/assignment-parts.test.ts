import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  AttachmentId,
  ClassId,
  SchoolId,
  StudentId,
  StudentLinkId,
  UserId,
} from '../shared/ids.ts';
import type { LocalDate } from '../shared/local-date.ts';
import { createAttachment, maxAttachmentBytes } from './attachment.ts';
import { createExtractedTest } from './extracted-test.ts';
import { leniencyFor } from './leniency.ts';
import { createStudentLink, isUsable, linkExpiry, revokeLink } from './student-link.ts';
import { connectClassroom } from './classroom-connection.ts';

const schoolId = 'school-1' as SchoolId;

describe('createAttachment', () => {
  const input = {
    id: 'att-1' as AttachmentId,
    schoolId,
    assignmentId: 'a-1' as AssignmentId,
    name: ' worksheet.pdf ',
    contentType: 'application/pdf',
    size: 2048,
  };

  it('keeps an allowed file with a storage key of its own', () => {
    expect(createAttachment(input)).toEqual({
      ok: true,
      value: { ...input, name: 'worksheet.pdf', key: 'attachments/school-1/a-1/att-1' },
    });
  });

  it.each([
    [{ contentType: 'application/x-msdownload' }, 'contentType', 'not_allowed'],
    [{ size: 0 }, 'size', 'out_of_range'],
    [{ size: maxAttachmentBytes + 1 }, 'size', 'too_large'],
    [{ name: '' }, 'name', 'required'],
  ] as const)('refuses %o', (overrides, field, code) => {
    expect(createAttachment({ ...input, ...overrides })).toEqual({
      ok: false,
      error: { field, code },
    });
  });
});

describe('student links', () => {
  const now = new Date('2026-09-01T12:00:00Z');
  const link = createStudentLink({
    id: 'link-1' as StudentLinkId,
    schoolId,
    classId: 'class-1' as ClassId,
    studentId: 'student-1' as StudentId,
    tokenHash: 'hash',
    expiresAt: new Date('2027-01-31T00:00:00Z'),
  });

  it('works until it expires or is revoked', () => {
    expect(isUsable(link, now)).toBe(true);
    expect(isUsable(link, new Date('2027-01-31T00:00:00Z'))).toBe(false);
    expect(isUsable(revokeLink(link, now), now)).toBe(false);
  });

  it('expires the day after the semester ends, or after 180 days without one', () => {
    expect(linkExpiry('2027-01-30' as LocalDate, now)).toEqual(new Date('2027-01-31T00:00:00Z'));
    expect(linkExpiry(null, now)).toEqual(new Date('2027-02-28T12:00:00Z'));
    expect(linkExpiry('2026-08-01' as LocalDate, now)).toEqual(new Date('2027-02-28T12:00:00Z'));
  });
});

describe('createExtractedTest', () => {
  it('keeps the general instructions and the questions the teacher will review', () => {
    const test = createExtractedTest({
      instructions: ' Read carefully. ',
      questions: [
        {
          type: 'fill_blank',
          prompt: 'The ___ is red.',
          acceptedAnswers: ['apple'],
          instructions: 'Word bank: apple, sky',
        },
        { type: 'true_false', prompt: 'Water is wet.', answer: true },
      ],
    });
    expect(test.ok && test.value.instructions).toBe('Read carefully.');
    expect(test.ok && test.value.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(test.ok && test.value.questions[0]?.instructions).toBe('Word bank: apple, sky');
  });

  it('refuses a test without questions or with an invalid one', () => {
    expect(createExtractedTest({ instructions: null, questions: [] })).toEqual({
      ok: false,
      error: { field: 'questions', code: 'required' },
    });
    const bad = createExtractedTest({
      instructions: null,
      questions: [{ type: 'multiple_choice', prompt: 'Pick', options: ['a'], correctOption: 0 }],
    });
    expect(bad).toEqual({ ok: false, error: { field: 'questions.0.options', code: 'required' } });
  });
});

describe('leniencyFor', () => {
  it('is gentler with younger students and strict with spelling only from grade 4', () => {
    expect(leniencyFor('K')).toMatchObject({ leniency: 'very_high', spellingMatters: false });
    expect(leniencyFor('4')).toMatchObject({ spellingMatters: true });
    expect(leniencyFor('11')).toMatchObject({ leniency: 'low' });
  });

  it('uses grade 6 when the class has no known grade', () => {
    expect(leniencyFor(null)).toEqual(leniencyFor('6'));
    expect(leniencyFor('Year 3')).toEqual(leniencyFor('6'));
  });
});

describe('connectClassroom', () => {
  it('keeps only the encrypted token and when it was connected', () => {
    const at = new Date('2026-09-01T12:00:00Z');
    expect(
      connectClassroom({
        schoolId,
        teacherId: 'teacher-1' as UserId,
        encryptedRefreshToken: 'cipher',
        connectedAt: at,
      }),
    ).toEqual({
      id: 'teacher-1',
      schoolId,
      teacherId: 'teacher-1',
      encryptedRefreshToken: 'cipher',
      connectedAt: at,
    });
  });
});
