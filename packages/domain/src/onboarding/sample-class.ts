import type { AttendanceStatus } from '../attendance/attendance-session.ts';
import { weekdayOf } from '../command-center/today.ts';
import { addDays, type LocalDate } from '../shared/local-date.ts';

/**
 * The made-up class a new teacher starts with: the numbers behind it. The words come from the
 * teacher's language; nothing here is a real student.
 */
export const sampleStudentCount = 6;

/** The made-up students' last names: initials only. */
export const sampleLastInitials: readonly string[] = ['R.', 'T.', 'K.', 'M.', 'D.', 'P.'];

/** The one student the Command Center should list as maybe needing help. */
export const sampleHelpStudent = 2;

/** The student whose quiz answers wait for the teacher's review. */
export const sampleReviewStudent = 0;

const isWeekend = (date: LocalDate) => ['Sat', 'Sun'].includes(weekdayOf(date));

/** The five school days before today, oldest first: the attendance already taken. */
export function sampleSchoolDays(today: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  for (let day = addDays(today, -1); days.length < 5; day = addDays(day, -1)) {
    if (!isWeekend(day)) days.unshift(day);
  }
  return days;
}

/** The Monday the sample lesson plan starts: this week's, or next week's on a weekend. */
export function sampleWeekStart(today: LocalDate): LocalDate {
  const index = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(weekdayOf(today));
  return index >= 5 ? addDays(today, 7 - index) : addDays(today, -index);
}

const p: AttendanceStatus = 'present';

/** Each day's marks, one per student: the help student misses two days, another is late once. */
export const sampleAttendance: readonly (readonly AttendanceStatus[])[] = [
  [p, p, p, p, p, p],
  [p, p, 'absent', p, p, p],
  [p, p, p, p, 'tardy', p],
  [p, p, 'absent', p, p, p],
  [p, p, p, p, p, p],
];

/** Scores out of 100 on the two graded assignments, one per student. */
export const sampleScores = {
  homework: [95, 88, 62, 100, 84, 91],
  quiz: [90, 82, 58, 96, 79, 87],
} as const satisfies Readonly<Record<string, readonly number[]>>;

/** The online quiz: a choice, a true-or-false and an explanation, 10 points in all. */
export const sampleQuiz = {
  choice: { points: 3, options: ['1/2', '1/4', '3/4', '4/1'], correct: 1 },
  trueFalse: { points: 2, answer: true },
  explain: { points: 5, suggestedScore: 4 },
} as const;

/** The live game's choices; the questions come from the teacher's language. */
export const sampleGameChoices: readonly {
  readonly options: readonly string[];
  readonly answer: number;
}[] = [
  { options: ['1/2', '1/3', '2/3', '1/4'], answer: 0 },
  { options: ['1/8', '1/4', '1/2', '1/3'], answer: 2 },
  { options: ['2', '3', '4', '8'], answer: 2 },
  { options: ['1/4', '1/2', '3/4', '2/2'], answer: 1 },
  { options: ['3/5', '5/8', '3/8', '8/3'], answer: 2 },
];
