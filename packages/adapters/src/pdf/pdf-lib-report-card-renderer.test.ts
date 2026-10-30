import { describe, expect, it } from 'vitest';
import { extractText, getDocumentProxy } from 'unpdf';
import type { ReportCardPage } from '@thp/ports';
import { pdfPageCount, reportCardRendererContract } from '@thp/testing';
import { PdfLibReportCardRenderer } from './pdf-lib-report-card-renderer.ts';
import { printable } from './printable.ts';

reportCardRendererContract('PdfLibReportCardRenderer', () => new PdfLibReportCardRenderer());

const fromBase64 = (text: string): Uint8Array => Uint8Array.from(Buffer.from(text, 'base64'));
const png = fromBase64(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
);
const jpeg = fromBase64(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
);

const card = (overrides: Partial<ReportCardPage> = {}): ReportCardPage => ({
  schoolName: 'Escuela Luz',
  schoolDetails: 'Calle Sol 1 · 555-0100',
  logo: null,
  title: 'Boleta de calificaciones',
  sections: [
    {
      kind: 'facts',
      items: [
        { label: 'Estudiante', value: 'Ñandú Muñoz' },
        { label: 'Clase', value: 'Matemáticas 5' },
      ],
    },
    {
      kind: 'table',
      title: 'Calificaciones',
      headers: ['Categoría', 'Puntos', '%', 'Letra'],
      rows: [
        ['Exámenes', '45 / 50', '90.0%', 'A'],
        ['Tareas', '16 / 20', '80.0%', 'B'],
      ],
      empty: 'Sin calificaciones',
    },
    { kind: 'table', title: 'Asistencia', headers: ['Presente'], rows: [], empty: 'Sin días' },
    { kind: 'text', title: 'Comentarios', text: 'Trabaja con empeño. '.repeat(30).trim() },
    { kind: 'signatures', labels: ['Maestro', 'Director', 'Padre o tutor'] },
  ],
  ...overrides,
});

const textOf = async (bytes: Uint8Array): Promise<string> => {
  const { text } = await extractText(await getDocumentProxy(bytes.slice()), { mergePages: true });
  return text;
};

const imageCount = (bytes: Uint8Array): number =>
  (new TextDecoder('latin1').decode(bytes).match(/\/Subtype\s*\/Image/g) ?? []).length;

describe('PdfLibReportCardRenderer', () => {
  const renderer = new PdfLibReportCardRenderer();

  it('prints the school, every fact, table cell, comment and signature line', async () => {
    const text = await textOf(await renderer.render([card()]));

    for (const expected of [
      'Escuela Luz',
      'Calle Sol 1 · 555-0100',
      'Boleta de calificaciones',
      'Ñandú Muñoz',
      'Matemáticas 5',
      'Exámenes',
      '45 / 50',
      '90.0%',
      'Sin días',
      'Trabaja con empeño.',
      'Padre o tutor',
    ]) {
      expect(text).toContain(expected);
    }
  });

  it('wraps a long comment instead of running off the page', async () => {
    const text = await textOf(await renderer.render([card()]));

    expect(text.match(/Trabaja con empeño\./g)).toHaveLength(30);
  });

  it('embeds a PNG or JPEG logo, and skips a logo it cannot read', async () => {
    const withPng = await renderer.render([
      card({ logo: { bytes: png, contentType: 'image/png' } }),
    ]);
    const withJpeg = await renderer.render([
      card({ logo: { bytes: jpeg, contentType: 'image/jpeg' } }),
    ]);
    const broken = await renderer.render([
      card({ logo: { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png' } }),
    ]);

    // A PNG with transparency is stored as the image plus its alpha mask.
    expect(imageCount(withPng)).toBeGreaterThan(0);
    expect(imageCount(withJpeg)).toBe(1);
    expect(imageCount(broken)).toBe(0);
  });

  it('continues on another page when a card is too long for one', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => [`Tarea ${String(i + 1)}`, '9 / 10']);
    const bytes = await renderer.render([
      card({
        sections: [{ kind: 'table', title: 'Tareas', headers: ['A', 'B'], rows, empty: '' }],
      }),
    ]);

    expect(pdfPageCount(bytes)).toBe(2);
    expect(await textOf(bytes)).toContain('Tarea 50');
  });
});

describe('printable', () => {
  it('keeps Latin letters with accents and drops marks the font cannot print', () => {
    expect(printable('Ñandú Muñoz-Pérez · 90%')).toBe('Ñandú Muñoz-Pérez · 90%');
    expect(printable('Nguyễn Trần')).toBe('Nguyen Tran');
    expect(printable('王小明')).toBe('???');
    expect(printable('Line\none')).toBe('Line one');
  });
});
