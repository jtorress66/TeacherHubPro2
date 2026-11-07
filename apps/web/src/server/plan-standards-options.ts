import { gradeLevels, prChoicesFor, prSubjects, type PrChoice, type PrSubject } from '@thp/domain';

export interface PrOptions {
  /** The grades and school levels each Puerto Rico subject has codes for. */
  readonly choices: Readonly<Record<PrSubject, readonly PrChoice[]>>;
  /** The grade a class's plans start the code list on, when the class's grade can be read. */
  readonly classGrades: Readonly<Record<string, PrChoice>>;
}

/** "7", "7th", "Grado 7" or "Kínder" as a grade level. */
function gradeOf(text: string | null): PrChoice | null {
  if (text === null) return null;
  if (/^k/iu.test(text.trim())) return 'K';
  const number = /\d{1,2}/u.exec(text)?.[0];
  return (gradeLevels as readonly string[]).includes(number ?? '') ? (number as PrChoice) : null;
}

/** What the plan editor's Puerto Rico code picker offers; the codes themselves load on demand. */
export function prOptionsFor(
  classes: readonly { readonly id: string; readonly grade: string | null }[],
): PrOptions {
  const choices = Object.fromEntries(
    prSubjects.map((subject) => [subject, prChoicesFor(subject)]),
  ) as Record<PrSubject, readonly PrChoice[]>;
  const classGrades: Record<string, PrChoice> = {};
  for (const cls of classes) {
    const grade = gradeOf(cls.grade);
    if (grade !== null) classGrades[cls.id] = grade;
  }
  return { choices, classGrades };
}
