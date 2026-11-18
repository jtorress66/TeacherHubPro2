import { describe, expect, it } from 'vitest';
import { csvCell, csvText } from './csv.ts';

describe('csvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('stops a spreadsheet from running a cell as a formula', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('=1,2')).toBe(`"'=1,2"`);
    expect(csvCell('\tx')).toBe("'\tx");
  });
});

describe('csvText', () => {
  it('writes rows with Windows line breaks after a mark that makes spreadsheets read UTF-8', () => {
    expect(
      csvText([
        ['Name', 'Class'],
        ['José', 'Math, 5th'],
      ]),
    ).toBe('\uFEFFName,Class\r\nJosé,"Math, 5th"\r\n');
  });
});
