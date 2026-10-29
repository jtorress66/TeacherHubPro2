import { describe, expect, it } from 'vitest';
import { parseRosterCsv } from '../src/index.ts';

const rows = (text: string) => {
  const result = parseRosterCsv(text);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

describe('parseRosterCsv', () => {
  it('reads a comma-separated file with English headers', () => {
    expect(
      rows('First name,Last name,Student number,Parent email\nAna,López,S-1,mom@x.com\n'),
    ).toEqual([
      {
        line: 2,
        firstName: 'Ana',
        lastName: 'López',
        studentNumber: 'S-1',
        parentEmail: 'mom@x.com',
        accommodations: '',
      },
    ]);
  });

  it('reads a semicolon file with Spanish headers, ignoring case and accents', () => {
    expect(
      rows('NOMBRE;Apellidos;Número de estudiante;Adaptaciones\r\nBen;Ortiz;7;Más tiempo\r\n'),
    ).toEqual([
      {
        line: 2,
        firstName: 'Ben',
        lastName: 'Ortiz',
        studentNumber: '7',
        parentEmail: '',
        accommodations: 'Más tiempo',
      },
    ]);
  });

  it('handles a byte order mark, quoted values with commas and quotes, and blank lines', () => {
    const text =
      String.fromCharCode(0xfeff) +
      'first_name,last_name\n\n"Ana María","de la Cruz, Jr."\n"Luis ""Lucho""",Pérez\n';
    expect(rows(text)).toEqual([
      expect.objectContaining({ line: 3, firstName: 'Ana María', lastName: 'de la Cruz, Jr.' }),
      expect.objectContaining({ line: 4, firstName: 'Luis "Lucho"', lastName: 'Pérez' }),
    ]);
  });

  it('counts lines correctly when a quoted value spans two lines', () => {
    const text =
      'first name,last name,accommodations\nAna,López,"Extra time\nand a quiet room"\nBen,Ortiz,\n';
    expect(rows(text).map((row) => row.line)).toEqual([2, 4]);
  });

  it('reports missing required columns', () => {
    expect(parseRosterCsv('name,email\nAna,a@b.co')).toEqual({
      ok: false,
      error: { code: 'csv_missing_columns', columns: ['firstName', 'lastName'] },
    });
  });

  it('reports a file without students and one with too many', () => {
    expect(parseRosterCsv('')).toEqual({ ok: false, error: { code: 'csv_empty' } });
    expect(parseRosterCsv('first name,last name\n')).toEqual({
      ok: false,
      error: { code: 'csv_empty' },
    });
    const big = [
      'first name,last name',
      ...Array.from({ length: 501 }, (_, i) => `A${String(i)},B`),
    ].join('\n');
    expect(parseRosterCsv(big)).toEqual({ ok: false, error: { code: 'csv_too_many_rows' } });
  });
});
