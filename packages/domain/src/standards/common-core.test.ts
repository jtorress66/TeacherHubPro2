import { describe, expect, it } from 'vitest';
import { findStandard, isGradeLevel, standardsFor, standardSubjects } from './common-core.ts';

describe('the Common Core catalog', () => {
  it('finds an official code with its subject, grades and description', () => {
    expect(findStandard('CCSS.Math.Content.4.NF.A.1')).toMatchObject({
      code: 'CCSS.Math.Content.4.NF.A.1',
      subject: 'math',
      grades: ['4'],
    });
    expect(findStandard('CCSS.Math.Content.4.NF.A.1')?.description).toMatch(/fraction/i);
  });

  it('does not know invented codes', () => {
    expect(findStandard('CCSS.Math.Content.4.NF.Z.9')).toBeNull();
    expect(findStandard('PR.MATH.4.1')).toBeNull();
  });

  it('lists the standards for a subject and grade', () => {
    const grade4Math = standardsFor('math', '4');
    expect(grade4Math.length).toBeGreaterThan(20);
    expect(grade4Math.every((s) => s.subject === 'math' && s.grades.includes('4'))).toBe(true);
    expect(grade4Math.map((s) => s.code)).toContain('CCSS.Math.Practice.MP1');
  });

  it('covers ELA from kindergarten', () => {
    expect(standardsFor('ela', 'K').map((s) => s.code)).toContain('CCSS.ELA-Literacy.RL.K.1');
  });

  it('gives science and social studies the literacy standards for grades 6 to 12 only', () => {
    expect(standardsFor('science', '8').map((s) => s.code)).toContain(
      'CCSS.ELA-Literacy.RST.6-8.1',
    );
    expect(standardsFor('social_studies', '10').map((s) => s.code)).toContain(
      'CCSS.ELA-Literacy.RH.9-10.1',
    );
    expect(standardsFor('science', '4')).toEqual([]);
    expect(standardsFor('social_studies', '5')).toEqual([]);
  });

  it('names the four subjects', () => {
    expect(standardSubjects).toEqual(['math', 'ela', 'science', 'social_studies']);
  });

  it('recognises grade levels K to 12', () => {
    expect(isGradeLevel('K')).toBe(true);
    expect(isGradeLevel('12')).toBe(true);
    expect(isGradeLevel('13')).toBe(false);
    expect(isGradeLevel('04')).toBe(false);
  });
});
