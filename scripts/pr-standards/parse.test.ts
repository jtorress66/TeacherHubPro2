import { describe, expect, it } from 'vitest';
import { documents, parseDocument } from './parse.ts';

const english = documents.english;

describe('parseDocument', () => {
  it('reads codes and their descriptions across lines, with the grade from the code (English 2022)', () => {
    const page = [
      'Content Standards and Grade Level Expectations I English',
      '80',
      'SEVENTH GRADE',
      '7.R.5.1I Analyze how a particular sentence, paragraph, chapter, or section fits into the overall structure of',
      'an informational text and contributes to the development of the setting and ideas.',
      '7.R.6 Assess how point of view or purpose shapes the content and style of a text.',
      '7.R.6.1 7.R.6.1L Explain how an author develops the point of view of different characters, the narrator, or speaker',
      'in a literary text.',
      '7.R.10.1 Read and comprehend a variety of literature of appropriate complexity.',
      'Writing',
      'The Writing Standard develops the student’s capacity and skills to plan, revise, edit, and publish',
      'many types of writing.',
    ].join('\n');

    const { standards, skipped } = parseDocument([page], english);

    expect(standards).toEqual([
      {
        code: '7.R.5.1I',
        subject: 'english',
        grades: ['7'],
        level: null,
        course: null,
        strand: 'R',
        description:
          'Analyze how a particular sentence, paragraph, chapter, or section fits into the overall structure of an informational text and contributes to the development of the setting and ideas.',
      },
      expect.objectContaining({
        code: '7.R.6',
        description: 'Assess how point of view or purpose shapes the content and style of a text.',
      }),
      expect.objectContaining({
        code: '7.R.6.1L',
        description:
          'Explain how an author develops the point of view of different characters, the narrator, or speaker in a literary text.',
      }),
      expect.objectContaining({
        code: '7.R.10.1',
        description: 'Read and comprehend a variety of literature of appropriate complexity.',
      }),
    ]);
    expect(skipped).toEqual([]);
  });

  it('takes a high-school Math code’s grade from the page heading, and keeps bullets and (+) codes', () => {
    const page = [
      'Estándares de Contenido y Expectativas de Grado I Matemáticas',
      '86',
      'DÉCIMO GRADO',
      'GEOMETRÍA',
      '(+) ES.G.46.3 Formula e investiga la validez del inverso de una proposición condicional.',
      '8.A.4.1 Resuelve un sistema que consiste en:',
      '➢ dos ecuaciones lineales en dos variables',
      'usando gráficas y la tecnología.',
      '(+)',
      'ES.A.24.1',
      'Determina e interpreta la razón de cambio.',
    ].join('\n');

    const { standards } = parseDocument([page], documents.math);

    expect(standards.map((s) => [s.code, s.grades, s.strand, s.description])).toEqual([
      [
        'ES.G.46.3',
        ['10'],
        'G',
        'Formula e investiga la validez del inverso de una proposición condicional.',
      ],
      [
        '8.A.4.1',
        ['8'],
        'A',
        'Resuelve un sistema que consiste en: ➢ dos ecuaciones lineales en dos variables usando gráficas y la tecnología.',
      ],
      ['ES.A.24.1', ['10'], 'A', 'Determina e interpreta la razón de cambio.'],
    ]);
  });

  it('lists middle and high school Science codes under their level and course, without guessing a grade', () => {
    const page = [
      'Escuela Superior: Química',
      'Estándares de Contenido y Expectativas de Grado de Puerto Rico 282',
      'Programa de Ciencias 2014',
      'Estándar: Diseño para ingeniería',
      'Indicadores: ES.Q.IT1.IT.1 Identifica una posible solución a un problema real y complejo, dividiéndolo en problemas más pequeños y',
      'manejables que se pueden resolver usando conocimientos de ingeniería.',
      'Escuela Intermedia: Ciencias Biológicas',
      'EI.B.CB1.EM.2 Utiliza tecnología para desarrollar un modelo de una célula.',
      'K.B.CB1.EM.2 Describe y clasifica los animales y sus crías.',
    ].join('\n');

    const { standards } = parseDocument([page], documents.science);

    expect(standards.map((s) => [s.code, s.grades, s.level, s.course, s.strand])).toEqual([
      ['ES.Q.IT1.IT.1', [], 'high', 'Química', 'Q'],
      ['EI.B.CB1.EM.2', [], 'intermediate', 'Ciencias Biológicas', 'B'],
      ['K.B.CB1.EM.2', ['K'], null, null, 'B'],
    ]);
    expect(standards[0]?.description).toBe(
      'Identifica una posible solución a un problema real y complejo, dividiéndolo en problemas más pequeños y manejables que se pueden resolver usando conocimientos de ingeniería.',
    );
  });

  it('closes up "K.LL.TE. 5" codes and never joins an expectation heading to a description (Spanish)', () => {
    const page = [
      'Programa de Español 2014',
      '16',
      '5.  Analiza cómo estructuras y patrones específicos del texto dan secuencia a las ideas.',
      'K.LL.TE. 5 Reconoce géneros comunes de textos ',
      'literarios Ĵpor ejemplo: libros de cuentos, ',
      'poemas). ',
      '6.  Reconoce e interpreta cómo los autores utilizan el lenguaje literario',
      'K.LL.TE. 6 Nombra el autor e ilustrador del cuento.',
    ].join('\n');

    const { standards } = parseDocument([page], documents.spanish);

    expect(standards.map((s) => [s.code, s.strand, s.description])).toEqual([
      [
        'K.LL.TE.5',
        'LL',
        'Reconoce géneros comunes de textos literarios (por ejemplo: libros de cuentos, poemas).',
      ],
      ['K.LL.TE.6', 'LL', 'Nombra el autor e ilustrador del cuento.'],
    ]);
  });

  it('reports a code whose grade it cannot read, and keeps a repeated code once under all its grades', () => {
    const pages = [
      ['Introducción', 'XX.A.1 Una expectativa sin grado.', 'K.CC.1 Integra vocabulario.'].join(
        '\n',
      ),
      ['1.CC.1 Otra.', 'DUODÉCIMO GRADO', 'K.CC.1 Otra descripción distinta.'].join('\n'),
    ];

    const { standards, skipped, notes } = parseDocument(pages, documents.social_studies);

    expect(standards.map((s) => [s.code, s.grades, s.description])).toEqual([
      ['K.CC.1', ['K'], 'Integra vocabulario.'],
      ['1.CC.1', ['1'], 'Otra.'],
    ]);
    expect(skipped).toEqual(['XX.A.1: no grade']);
    expect(notes).toEqual(['K.CC.1: repeated with other wording; the first is kept']);
  });

  it('joins a code split over two lines ("1.FS.4.1" then "a")', () => {
    const page = ['1.FS.4.1', 'a', 'Read on-level texts with purpose and understanding.'].join(
      '\n',
    );

    expect(parseDocument([page], english).standards).toEqual([
      expect.objectContaining({
        code: '1.FS.4.1a',
        description: 'Read on-level texts with purpose and understanding.',
      }),
    ]);
  });

  it('merges the grades of a code that a later course repeats', () => {
    const pages = [
      ['DÉCIMO GRADO', 'ES.G.47.1 Demuestra teoremas sobre triángulos.'].join('\n'),
      ['DUODÉCIMO GRADO', 'ES.G.47.1 Demuestra teoremas sobre triángulos, Incluye:'].join('\n'),
    ];

    const { standards, notes } = parseDocument(pages, documents.math);

    expect(standards.map((s) => [s.code, s.grades])).toEqual([['ES.G.47.1', ['10', '12']]]);
    expect(notes).toEqual(['ES.G.47.1: repeated with other wording; the first is kept']);
  });
});

describe('the Spanish document’s table rows', () => {
  it('splits codes from several grade columns on one line, and leaves out codes that do not apply', () => {
    const page = [
      'K.LL.ICI. 8 ĴNo aplica a la literatura). 1.LL.ICI. 8 ĴNo aplica a literatura). 2.LL.ICI. 8 Compara dos textos.',
      'K.LL.IC I. 9 Con apoyo del maestro, compara ',
      'las aventuras de los personajes.',
    ].join('\n');

    const { standards, skipped } = parseDocument([page], documents.spanish);

    expect(standards.map((s) => [s.code, s.description])).toEqual([
      ['2.LL.ICI.8', 'Compara dos textos.'],
      ['K.LL.ICI.9', 'Con apoyo del maestro, compara las aventuras de los personajes.'],
    ]);
    expect(skipped).toEqual(['K.LL.ICI.8: does not apply', '1.LL.ICI.8: does not apply']);
  });
});
