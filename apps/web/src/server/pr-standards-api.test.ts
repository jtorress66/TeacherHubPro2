import { describe, expect, it } from 'vitest';
import { prCodesFor } from './pr-standards-api.ts';

describe('prCodesFor', () => {
  it('lists a subject and grade’s codes with their plan category', () => {
    const result = prCodesFor(new URLSearchParams({ subject: 'english', grade: '7' }));

    expect(result.status).toBe(200);
    const codes = result.status === 200 ? result.codes : [];
    expect(codes).toContainEqual({
      code: '7.R.6.1L',
      description:
        'Explain how an author develops the point of view of different characters, the narrator, or speaker in a literary text.',
      domain: 'reading',
      course: null,
    });
    expect(codes.every((c) => c.code.startsWith('7.'))).toBe(true);
  });

  it('lists a school level with each code’s course', () => {
    const result = prCodesFor(new URLSearchParams({ subject: 'science', grade: 'high' }));
    const codes = result.status === 200 ? result.codes : [];
    expect(codes.find((c) => c.code === 'ES.Q.IT1.IT.1')).toMatchObject({
      domain: 'other',
      course: 'Química',
    });
  });

  it('refuses an unknown subject or grade', () => {
    expect(prCodesFor(new URLSearchParams({ subject: 'art', grade: '7' }))).toEqual({
      status: 400,
    });
    expect(prCodesFor(new URLSearchParams({ subject: 'math', grade: '13' }))).toEqual({
      status: 400,
    });
    expect(prCodesFor(new URLSearchParams())).toEqual({ status: 400 });
  });
});
