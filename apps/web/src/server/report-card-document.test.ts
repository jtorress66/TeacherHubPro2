import { describe, expect, it } from 'vitest';
import type { ReportCard, ReportCards } from '@thp/application';
import type { GradeCategoryId, LocalDate, StudentId } from '@thp/domain';
import type { ReportCardPage } from '@thp/ports';
import { aClass, aGradeCategory, aSchool, aSemester, aStudent, aUser } from '@thp/testing';
import { reportCardFileName, reportCardPages } from './report-card-document.ts';

const tests = aGradeCategory({
  id: 'tests' as GradeCategoryId,
  name: 'Exámenes',
  weightPercent: 50,
});

const card = (overrides: Partial<ReportCard> = {}): ReportCard => ({
  student: aStudent({
    id: 'ana' as StudentId,
    firstName: 'Ana',
    lastName: 'Zayas',
    studentNumber: '1042',
  }),
  categories: [
    {
      category: tests,
      result: { categoryId: tests.id, earned: 45, possible: 50, percentage: 90, count: 1 },
    },
  ],
  summary: {
    categories: [],
    overall: 86.25,
    gpa: 3.625,
    letter: 'B',
    earned: 61,
    possible: 70,
    completed: 3,
  },
  attendance: {
    summary: { present: 18, absent: 1, tardy: 1, excused: 0, total: 20 },
    rate: 95,
    days: 20,
  },
  comment: 'Muy aplicada.',
  ...overrides,
});

const cards = (overrides: Partial<ReportCards> = {}): ReportCards => ({
  school: aSchool({ name: 'Escuela Luz', address: 'Calle Sol 1', phone: '555-0100' }),
  logo: null,
  cls: aClass({ name: 'Ciencias 5' }),
  semester: aSemester({ name: 'Otoño 2026' }),
  teacher: aUser({ name: 'Ana López' }),
  cards: [card()],
  ...overrides,
});

const today = '2026-12-18' as LocalDate;

/** Spanish number formats use a no-break space before "%"; compare with plain spaces. */
const sectionsOf = (page: ReportCardPage | undefined) =>
  JSON.parse(
    JSON.stringify(page?.sections ?? []).replace(/\u00a0/g, ' '),
  ) as ReportCardPage['sections'];

describe('reportCardPages', () => {
  it('lays out one translated page per student', () => {
    const pages = reportCardPages(cards(), 'es', today);

    expect(pages).toHaveLength(1);
    const page = pages?.[0];
    expect(page).toMatchObject({
      schoolName: 'Escuela Luz',
      schoolDetails: 'Calle Sol 1 · 555-0100',
      logo: null,
      title: 'Boleta de calificaciones',
    });
    expect(sectionsOf(page)).toEqual([
      {
        kind: 'facts',
        items: [
          { label: 'Estudiante', value: 'Ana Zayas' },
          { label: 'Número de estudiante', value: '1042' },
          { label: 'Clase', value: 'Ciencias 5' },
          { label: 'Semestre', value: 'Otoño 2026' },
          { label: 'Maestro(a)', value: 'Ana López' },
          { label: 'Fecha', value: '2026-12-18' },
        ],
      },
      {
        kind: 'table',
        title: 'Calificaciones',
        headers: ['Categoría', 'Puntos', 'Porcentaje', 'Letra'],
        rows: [['Exámenes (50 %)', '45 / 50', '90 %', 'A']],
        empty: 'Todavía no hay calificaciones.',
      },
      {
        kind: 'facts',
        items: [
          { label: 'Nota final', value: '86,3 % (B)' },
          { label: 'GPA (escala de 4.0)', value: '3,63' },
        ],
      },
      {
        kind: 'table',
        title: 'Asistencia',
        headers: ['Presente', 'Ausente', 'Tarde', 'Excusado', 'Días', 'Porcentaje'],
        rows: [['18', '1', '1', '0', '20', '95 %']],
        empty: 'No hay días de asistencia enviados.',
      },
      { kind: 'text', title: 'Comentarios del maestro', text: 'Muy aplicada.' },
      {
        kind: 'signatures',
        labels: ['Firma del maestro', 'Firma del director', 'Firma del padre, madre o tutor'],
      },
    ]);
  });

  it('leaves out what a student does not have: number, semester, grades, attendance and comment', () => {
    const bare = card({
      student: aStudent({ firstName: 'Ben', lastName: 'Acosta', studentNumber: null }),
      categories: [],
      summary: { ...card().summary, overall: null, gpa: null, letter: null },
      attendance: {
        summary: { present: 0, absent: 0, tardy: 0, excused: 0, total: 0 },
        rate: null,
        days: 0,
      },
      comment: null,
    });
    const pages = reportCardPages(
      cards({
        semester: null,
        teacher: null,
        cards: [bare],
        school: aSchool({ name: 'Home' }),
        logo: { bytes: new Uint8Array([1]), contentType: 'image/png' },
      }),
      'en',
      today,
    );
    const page = pages?.[0];

    expect(page?.schoolDetails).toBeNull();
    expect(page?.logo?.contentType).toBe('image/png');
    expect(sectionsOf(page).map((s) => s.kind)).toEqual([
      'facts',
      'table',
      'facts',
      'table',
      'signatures',
    ]);
    expect(sectionsOf(page)[0]).toEqual({
      kind: 'facts',
      items: [
        { label: 'Student', value: 'Ben Acosta' },
        { label: 'Class', value: 'Ciencias 5' },
        { label: 'Date', value: '2026-12-18' },
      ],
    });
    expect(sectionsOf(page)[2]).toEqual({
      kind: 'facts',
      items: [
        { label: 'Overall grade', value: '—' },
        { label: 'GPA (4.0 scale)', value: '—' },
      ],
    });
    expect(sectionsOf(page)[3]).toMatchObject({ rows: [] });
  });

  it('is null when there are no students', () => {
    expect(reportCardPages(cards({ cards: [] }), 'en', today)).toBeNull();
  });
});

describe('reportCardFileName', () => {
  it('names the file after the student, or the class for several, in the page language', () => {
    expect(reportCardFileName(cards(), 'es')).toBe('boleta-ana-zayas.pdf');
    expect(reportCardFileName(cards({ cards: [card(), card()] }), 'en')).toBe(
      'report-card-ciencias-5.pdf',
    );
  });
});
