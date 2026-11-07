import type { StandardDomain } from '../lesson-plans/plan-standards.ts';
import { gradeLevels, type GradeLevel } from './common-core.ts';
import { puertoRicoRows } from './puerto-rico-codes.ts';

/** The Puerto Rico Department of Education's subjects, from its standards documents. */
export const prSubjects = ['english', 'spanish', 'math', 'science', 'social_studies'] as const;
export type PrSubject = (typeof prSubjects)[number];

/** Codes the documents place by school level instead of grade (middle and high school Science). */
export const prLevels = ['intermediate', 'high'] as const;
export type PrLevel = (typeof prLevels)[number];

/** A grade, or a school level, to list codes for. */
export type PrChoice = GradeLevel | PrLevel;

/** One row of the generated catalog. */
export type PrRow = readonly [
  code: string,
  subject: PrSubject,
  grades: readonly GradeLevel[],
  level: PrLevel | null,
  course: string | null,
  strand: string,
  description: string,
];

export interface PuertoRicoStandard {
  readonly code: string;
  readonly subject: PrSubject;
  readonly grades: readonly GradeLevel[];
  readonly level: PrLevel | null;
  readonly course: string | null;
  readonly strand: string;
  readonly description: string;
}

/** The official documents the catalog was read from. */
export const prSources: readonly {
  readonly subject: PrSubject;
  readonly title: string;
  readonly year: string;
}[] = [
  {
    subject: 'english',
    title: 'Estándares de Contenido y Expectativas de Grado: Programa de Inglés',
    year: '2022',
  },
  {
    subject: 'spanish',
    title: 'Estándares de Contenido y Expectativas de Grado: Programa de Español',
    year: '2014',
  },
  {
    subject: 'math',
    title: 'Estándares de Contenido y Expectativas de Grado: Programa de Matemáticas',
    year: '2022',
  },
  {
    subject: 'science',
    title: 'Estándares de Contenido y Expectativas de Grado: Programa de Ciencias',
    year: '2014',
  },
  {
    subject: 'social_studies',
    title: 'Estándares de Contenido y Expectativas de Grado: Programa de Estudios Sociales',
    year: '2014',
  },
];

const catalog: readonly PuertoRicoStandard[] = puertoRicoRows.map(
  ([code, subject, grades, level, course, strand, description]) => ({
    code,
    subject,
    grades,
    level,
    course,
    strand,
    description,
  }),
);

const byCode = new Map(catalog.map((standard) => [standard.code, standard]));

export const isPrSubject = (value: string): value is PrSubject =>
  (prSubjects as readonly string[]).includes(value);

export const isPrChoice = (value: string): value is PrChoice =>
  (gradeLevels as readonly string[]).includes(value) ||
  (prLevels as readonly string[]).includes(value);

/** A code from the official Puerto Rico documents, or null for any other code. */
export const findPrStandard = (code: string): PuertoRicoStandard | null => byCode.get(code) ?? null;

const matches = (standard: PuertoRicoStandard, choice: PrChoice): boolean =>
  standard.level === choice || (standard.grades as readonly string[]).includes(choice);

/** A subject's codes for a grade or a school level, in the documents' order. */
export const prStandardsFor = (
  subject: PrSubject,
  choice: PrChoice,
): readonly PuertoRicoStandard[] =>
  catalog.filter((standard) => standard.subject === subject && matches(standard, choice));

/** The grades, then the school levels, that a subject has codes for. */
export const prChoicesFor = (subject: PrSubject): readonly PrChoice[] => {
  const own = catalog.filter((standard) => standard.subject === subject);
  return [...gradeLevels, ...prLevels].filter((choice) =>
    own.some((standard) => matches(standard, choice)),
  );
};

/** English (2022) and Spanish (2014) strands as the plan's standards categories. */
const strandDomains: Partial<Record<PrSubject, Readonly<Record<string, StandardDomain>>>> = {
  english: {
    LS: 'listening_speaking',
    FS: 'foundational_skills',
    R: 'reading',
    W: 'writing',
    LA: 'language',
  },
  spanish: {
    AO: 'listening_speaking',
    LF: 'foundational_skills',
    LL: 'reading',
    LI: 'reading',
    E: 'writing',
    L: 'language',
  },
};

/** Where a code goes in a plan: its category, or "other" for subjects without them. */
export const prDomainOf = (standard: PuertoRicoStandard): StandardDomain =>
  strandDomains[standard.subject]?.[standard.strand] ?? 'other';
