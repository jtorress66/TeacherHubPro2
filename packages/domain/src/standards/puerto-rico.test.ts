import { describe, expect, it } from 'vitest';
import {
  findPrStandard,
  prChoicesFor,
  prDomainOf,
  prSources,
  prStandardsFor,
  prSubjects,
} from './puerto-rico.ts';

describe('the Puerto Rico standards catalog', () => {
  it('finds a code with its subject, grade, strand and description', () => {
    expect(findPrStandard('7.R.6.1L')).toEqual({
      code: '7.R.6.1L',
      subject: 'english',
      grades: ['7'],
      level: null,
      course: null,
      strand: 'R',
      description:
        'Explain how an author develops the point of view of different characters, the narrator, or speaker in a literary text.',
    });
    expect(findPrStandard('7.R.99')).toBeNull();
  });

  it('lists a subject’s codes for a grade, or for a school level when the document gives no grade', () => {
    const seventh = prStandardsFor('english', '7');
    expect(seventh.length).toBeGreaterThan(100);
    expect(seventh.every((s) => s.grades.includes('7'))).toBe(true);

    const highSchoolScience = prStandardsFor('science', 'high');
    expect(highSchoolScience.map((s) => s.code)).toContain('ES.Q.IT1.IT.1');
    expect(highSchoolScience.every((s) => s.level === 'high' && s.course !== null)).toBe(true);
  });

  it('offers the grades and levels each subject has', () => {
    expect(prChoicesFor('english')).toEqual([
      'K',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
    ]);
    expect(prChoicesFor('science')).toEqual([
      'K',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      'intermediate',
      'high',
    ]);
  });

  it('has every subject, each from a named official document', () => {
    expect(prSubjects).toEqual(['english', 'spanish', 'math', 'science', 'social_studies']);
    for (const subject of prSubjects) {
      expect(prStandardsFor(subject, prChoicesFor(subject)[0] ?? 'K').length).toBeGreaterThan(0);
      expect(prSources.find((source) => source.subject === subject)?.year).toMatch(/^20\d\d$/u);
    }
  });
});

describe('prDomainOf', () => {
  const domain = (code: string) => {
    const standard = findPrStandard(code);
    if (standard === null) throw new Error(`missing ${code}`);
    return prDomainOf(standard);
  };

  it('places English and Spanish codes in the plan’s categories by strand', () => {
    expect(domain('7.R.6.1L')).toBe('reading');
    expect(domain('7.W.6')).toBe('writing');
    expect(domain('7.LA.6')).toBe('language');
    expect(domain('4.FS.1.1c')).toBe('foundational_skills');
    expect(domain('3.LI.TE.5')).toBe('reading');
    expect(domain('3.AO.CC.1')).toBe('listening_speaking');
    expect(domain('3.L.NE.1')).toBe('language');
    expect(domain('3.E.TP.1')).toBe('writing');
    expect(domain('K.LF.CTI.1')).toBe('foundational_skills');
  });

  it('puts Math, Science and Social Studies codes under other standards', () => {
    expect(domain('5.N.2.1')).toBe('other');
    expect(domain('4.CC.2.1')).toBe('other');
    expect(domain('ES.Q.IT1.IT.1')).toBe('other');
  });
});
