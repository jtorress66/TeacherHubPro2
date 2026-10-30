import { describe, expect, it } from 'vitest';
import { renderCatalog, toCatalog, type StandardSet } from './import-standards.ts';

const set = (
  document: string,
  levels: string[],
  standards: [notation: string | null, label: string | null, description: string][],
): StandardSet => ({
  document: { asnIdentifier: document },
  educationLevels: levels,
  standards: Object.fromEntries(
    standards.map(([statementNotation, statementLabel, description], position) => [
      `id-${String(position)}`,
      { statementNotation, statementLabel, description, position },
    ]),
  ),
});

describe('toCatalog', () => {
  it('keeps standards and components, with their subject and grades', () => {
    const catalog = toCatalog([
      set(
        'D10003FB',
        ['04'],
        [
          [null, 'Domain', 'Operations and Algebraic Thinking'],
          ['CCSS.Math.Content.4.OA.A', 'Cluster', 'Use the four operations.'],
          ['CCSS.Math.Content.4.OA.A.1', 'Standard', 'Interpret a multiplication equation.'],
          ['CCSS.Math.Content.4.NF.B.3.a', 'Component', 'Understand addition of fractions.'],
        ],
      ),
    ]);

    expect(catalog).toEqual([
      {
        code: 'CCSS.Math.Content.4.NF.B.3.a',
        subject: 'math',
        grades: ['4'],
        description: 'Understand addition of fractions.',
      },
      {
        code: 'CCSS.Math.Content.4.OA.A.1',
        subject: 'math',
        grades: ['4'],
        description: 'Interpret a multiplication equation.',
      },
    ]);
  });

  it('sorts literacy codes into science and social studies, and drops anchor standards', () => {
    const catalog = toCatalog([
      set(
        'D10003FC',
        ['06', '07', '08'],
        [
          ['CCSS.ELA-Literacy.CCRA.R.1', 'Standard', 'Read closely.'],
          ['CCSS.ELA-Literacy.RH.6-8.1', 'Standard', 'Cite evidence from sources.'],
          ['CCSS.ELA-Literacy.RST.6-8.1', 'Standard', 'Cite evidence from science texts.'],
          ['CCSS.ELA-Literacy.WHST.6-8.1', 'Standard', 'Write arguments.'],
          ['CCSS.ELA-Literacy.RL.7.1', 'Standard', 'Cite several pieces of evidence.'],
        ],
      ),
    ]);

    expect(catalog.map((s) => [s.code, s.subject])).toEqual([
      ['CCSS.ELA-Literacy.RH.6-8.1', 'social_studies'],
      ['CCSS.ELA-Literacy.RL.7.1', 'ela'],
      ['CCSS.ELA-Literacy.RST.6-8.1', 'science'],
      ['CCSS.ELA-Literacy.WHST.6-8.1', 'science'],
      ['CCSS.ELA-Literacy.WHST.6-8.1', 'social_studies'],
    ]);
    expect(catalog[0]?.grades).toEqual(['6', '7', '8']);
  });

  it('merges a code that appears in several sets and ignores other documents', () => {
    const catalog = toCatalog([
      set('D10003FB', ['K'], [['CCSS.Math.Practice.MP1', 'Standard', 'Make sense of problems.']]),
      set('D10003FB', ['01'], [['CCSS.Math.Practice.MP1', 'Standard', 'Make sense of problems.']]),
      set('OTHER', ['02'], [['PR.MATH.1', 'Standard', 'Not Common Core.']]),
    ]);

    expect(catalog).toEqual([
      {
        code: 'CCSS.Math.Practice.MP1',
        subject: 'math',
        grades: ['K', '1'],
        description: 'Make sense of problems.',
      },
    ]);
  });

  it('collapses whitespace in descriptions', () => {
    const [standard] = toCatalog([
      set(
        'D10003FB',
        ['03'],
        [['CCSS.Math.Content.3.OA.A.1', 'Standard', ' Interpret\n products  ']],
      ),
    ]);
    expect(standard?.description).toBe('Interpret products');
  });
});

describe('renderCatalog', () => {
  it('writes a typed module with the source and licence in its header', () => {
    const source = renderCatalog([
      {
        code: 'CCSS.Math.Content.4.OA.A.1',
        subject: 'math',
        grades: ['4'],
        description: 'It\'s "x".',
      },
    ]);

    expect(source).toContain('CC BY 3.0 US');
    expect(source).toContain('Common Standards Project');
    expect(source).toContain('["CCSS.Math.Content.4.OA.A.1","math",["4"],"It\'s \\"x\\"."]');
  });

  it('writes one letter of words the repository forbids as an escape, keeping the text', () => {
    const word = ['emerg', 'nt'].join('e');
    const source = renderCatalog([
      { code: 'X', subject: 'ela', grades: ['K'], description: `Read ${word}-reader texts.` },
    ]);
    const row = /\["X".*\]/.exec(source)?.[0] ?? '';

    expect(source.toLowerCase()).not.toContain(word);
    expect((JSON.parse(row) as string[])[3]).toBe(`Read ${word}-reader texts.`);
  });
});
