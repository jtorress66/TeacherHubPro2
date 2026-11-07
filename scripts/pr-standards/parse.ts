// Reads the Puerto Rico Department of Education's standards documents (as text, one string per
// page) into codes with their descriptions. Pure: the import script does the file work.

export type PrSubject = 'english' | 'spanish' | 'math' | 'science' | 'social_studies';
export type PrLevel = 'intermediate' | 'high';

export interface ParsedStandard {
  readonly code: string;
  readonly subject: PrSubject;
  /** The grades the document gives the code; empty for a level-only code. */
  readonly grades: readonly string[];
  /** For codes the document places by school level instead of grade (Science). */
  readonly level: PrLevel | null;
  /** The course a high school or middle school code belongs to, when the document names one. */
  readonly course: string | null;
  /** The second part of the code: the strand or domain (R, W, LL, A, CC…). */
  readonly strand: string;
  readonly description: string;
}

/** Where a page heading puts the codes that follow. */
interface Place {
  readonly grade?: string;
  readonly level?: PrLevel;
  readonly course?: string | null;
}

export interface DocumentRules {
  readonly subject: PrSubject;
  /** Codes that take their place from the page heading instead of their own prefix. */
  readonly placedByHeading: readonly string[];
  /** Lines that are page furniture: running headers, page numbers, section labels. */
  readonly furniture: readonly RegExp[];
  /** Table layouts put short entries from several grade columns on one line. */
  readonly columns?: boolean;
}

const gradeWords: Readonly<Record<string, string>> = {
  KINDERGARTEN: 'K',
  'PRIMER GRADO': '1',
  'SEGUNDO GRADO': '2',
  'TERCER GRADO': '3',
  'CUARTO GRADO': '4',
  'QUINTO GRADO': '5',
  'SEXTO GRADO': '6',
  'SÉPTIMO GRADO': '7',
  'OCTAVO GRADO': '8',
  'NOVENO GRADO': '9',
  'DÉCIMO GRADO': '10',
  'UNDÉCIMO GRADO': '11',
  'DUODÉCIMO GRADO': '12',
  'FIRST GRADE': '1',
  'SECOND GRADE': '2',
  'THIRD GRADE': '3',
  'FOURTH GRADE': '4',
  'FIFTH GRADE': '5',
  'SIXTH GRADE': '6',
  'SEVENTH GRADE': '7',
  'EIGHTH GRADE': '8',
  'NINTH GRADE': '9',
  'TENTH GRADE': '10',
  'ELEVENTH GRADE': '11',
  'TWELFTH GRADE': '12',
};

/** A page heading that places the codes after it: a grade, or a school level and course. */
function placeOf(line: string): Place | null {
  const grade = gradeWords[line.toUpperCase()];
  if (grade !== undefined) return { grade };
  const level = /^Escuela (Superior|Intermedia)(?::\s*(.+))?$/u.exec(line);
  if (level === null) return null;
  return {
    level: level[1] === 'Superior' ? 'high' : 'intermediate',
    course: level[2]?.trim() ?? null,
  };
}

const common: readonly RegExp[] = [
  /^\d{1,3}$/u, // page numbers
  /^[ivxlc]+$/u, // roman page numbers
  /Expectativas de Grado/u,
  /Grade Level Expectations/u,
  /^Programa de /u,
];

export const documents: Readonly<Record<PrSubject, DocumentRules>> = {
  english: { subject: 'english', placedByHeading: [], furniture: common },
  spanish: { subject: 'spanish', placedByHeading: [], furniture: common, columns: true },
  math: { subject: 'math', placedByHeading: ['ES'], furniture: common },
  science: { subject: 'science', placedByHeading: ['ES', 'EI'], furniture: common },
  social_studies: { subject: 'social_studies', placedByHeading: [], furniture: common },
};

const code = String.raw`(?:K|\d{1,2}|[A-Z]{2,3})\.[A-Z]{1,4}(?:\.[A-Za-z0-9]+)*`;
/** One or more codes at the start of a line (a parent code may come before its first child). */
const codeLine = new RegExp(String.raw`^((?:${code}\s+)*)(${code})(?:\s+(.*))?$`, 'u');

/** "(+)" marks an advanced expectation; "Indicadores:" introduces Science indicators. */
const clean = (line: string): string =>
  line
    .replace(/^\(\+\)\s*/u, '')
    .replace(/^Indicadores:\s*/u, '')
    // Spanish codes are printed with a space before their last number ("K.LL.TE. 5"), and
    // sometimes inside their letters ("K.LL.IC I. 9").
    .replace(
      /^((?:K|\d{1,2})\.[A-Z]{1,3}\.)([A-Z]+(?: [A-Z]+)?)\.\s*(\d)/u,
      (_, start: string, letters: string, digit: string) =>
        `${start}${letters.replace(/ /gu, '')}.${digit}`,
    )
    .trim();

/** Where another Spanish code starts further along a table row. */
const nextColumn = /\s+(?=(?:K|\d{1,2})\.[A-Z]{1,3}\.[A-Z]+(?: [A-Z]+)?\.\s?\d+\s)/u;

/** A numbered expectation heading ("5.  Analiza…") is never part of a description. */
const isExpectationHeading = (line: string): boolean => /^\d{1,2}\.\s+\S/u.test(line);

const ended = (text: string): boolean => /[.!?]$/u.test(text);

/** A line that carries on an open description: a bullet, a lowercase word, or after an unfinished one. */
const carriesOn = (description: string, line: string): boolean =>
  description === '' || !ended(description) || /^[➢•a-záéíóúñ(]/u.test(line);

/** Text fixes for the Spanish document's decoded font: its opening parenthesis decodes as "Ĵ". */
const tidy = (text: string): string => text.replace(/Ĵ/gu, '(').replace(/\s+/gu, ' ').trim();

interface Open {
  code: string;
  strand: string;
  place: Place;
  description: string;
}

export interface ParseResult {
  readonly standards: readonly ParsedStandard[];
  /** Codes left out, with why: never guessed. */
  readonly skipped: readonly string[];
  /** Codes kept with something worth checking, such as a repeat with other wording. */
  readonly notes: readonly string[];
}

export function parseDocument(pages: readonly string[], rules: DocumentRules): ParseResult {
  const found = new Map<string, ParsedStandard>();
  const skipped: string[] = [];
  const notes: string[] = [];
  let place: Place = {};
  let open: Open | null = null;

  const close = () => {
    if (open === null) return;
    const { code: id, strand, description, place: at } = open;
    const prefix = id.split('.')[0] ?? '';
    const byHeading = rules.placedByHeading.includes(prefix);
    const grades = byHeading
      ? at.grade === undefined
        ? []
        : [at.grade]
      : /^(K|\d{1,2})$/u.test(prefix)
        ? [prefix]
        : [];
    const level = byHeading ? (at.level ?? null) : null;
    open = null;
    if (/^\(no aplica/iu.test(tidy(description))) {
      skipped.push(`${id}: does not apply`);
      return;
    }
    if (grades.length === 0 && level === null) {
      skipped.push(`${id}: no grade`);
      return;
    }
    const standard: ParsedStandard = {
      code: id,
      subject: rules.subject,
      grades,
      level,
      course: byHeading ? (at.course ?? null) : null,
      strand,
      description: tidy(description),
    };
    const earlier = found.get(id);
    if (earlier === undefined) {
      found.set(id, standard);
    } else {
      // The same expectation repeated in another course or grade: kept once, under all of them.
      found.set(id, { ...earlier, grades: [...new Set([...earlier.grades, ...grades])] });
      if (earlier.description !== standard.description) {
        notes.push(`${id}: repeated with other wording; the first is kept`);
      }
    }
  };

  for (const page of pages) {
    const lines = page
      .split('\n')
      .flatMap((line) => (rules.columns === true ? line.split(nextColumn) : [line]));
    for (const raw of lines) {
      const line = clean(raw);
      if (line === '') continue;
      const heading = placeOf(line);
      if (heading !== null) {
        // Running headings repeat on every page: they place the codes that follow, and a
        // description that runs onto the next page carries on.
        place = heading;
        continue;
      }
      if (rules.furniture.some((pattern) => pattern.test(line))) continue;
      const match = codeLine.exec(line);
      if (match !== null) {
        close();
        const id = match[2] ?? '';
        open = { code: id, strand: id.split('.')[1] ?? '', place, description: match[3] ?? '' };
        continue;
      }
      if (open === null) continue;
      if (open.description === '' && /^[a-z]$/u.test(line)) {
        // A code split over two lines: "1.FS.4.1" then "a".
        open.code = `${open.code}${line}`;
        continue;
      }
      if (isExpectationHeading(line) || !carriesOn(open.description, line)) {
        close();
        continue;
      }
      open.description = `${open.description} ${line}`;
    }
  }
  close();
  return { standards: [...found.values()], skipped, notes };
}
