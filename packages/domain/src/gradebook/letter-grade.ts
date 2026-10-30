export const letterGrades = ['A', 'B', 'C', 'D', 'F'] as const;

export type LetterGrade = (typeof letterGrades)[number];

/** The report card's bands, highest first; below the last band is an F. */
const bands: readonly { readonly letter: LetterGrade; readonly from: number }[] = [
  { letter: 'A', from: 90 },
  { letter: 'B', from: 80 },
  { letter: 'C', from: 70 },
  { letter: 'D', from: 60 },
];

export function letterGrade(percentage: number): LetterGrade {
  return bands.find((band) => percentage >= band.from)?.letter ?? 'F';
}
