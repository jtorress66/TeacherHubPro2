import type { SchoolExport } from '@thp/application';
import type { Translate } from '@thp/i18n';
import type { ZipEntry } from '@thp/ports';
import { csvText } from './csv.ts';

const text = (value: string | number | null): string => (value === null ? '' : String(value));

/** "2026-09-02 10:05" in the person's time zone: sorts well and every spreadsheet reads it. */
function localDateTime(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

/** The school's data as one CSV file per table, headers and labels in the person's language. */
export function schoolExportFiles(data: SchoolExport, t: Translate, timeZone: string): ZipEntry[] {
  const yesNo = (value: boolean) => t(value ? 'schoolExport.yes' : 'schoolExport.no');
  const file = (name: string, rows: string[][]): ZipEntry => ({
    name: `${name}.csv`,
    text: csvText(rows),
  });
  return [
    file(t('schoolExport.file_teachers'), [
      [t('schoolExport.col_name'), t('schoolExport.col_email'), t('schoolExport.col_role')],
      ...data.teachers.map((row) => [row.name, row.email, t(`admin.role_${row.role}`)]),
    ]),
    file(t('schoolExport.file_classes'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_teacher'),
        t('schoolExport.col_subject'),
        t('schoolExport.col_gradeLevel'),
        t('schoolExport.col_section'),
        t('schoolExport.col_schoolYear'),
        t('schoolExport.col_archived'),
      ],
      ...data.classes.map((row) => [
        row.name,
        row.teacher,
        text(row.subject),
        text(row.grade),
        text(row.section),
        text(row.schoolYear),
        yesNo(row.archived),
      ]),
    ]),
    file(t('schoolExport.file_students'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_firstName'),
        t('schoolExport.col_lastName'),
        t('schoolExport.col_studentNumber'),
        t('schoolExport.col_parentEmail'),
        t('schoolExport.col_accommodations'),
        t('students.familyLanguage'),
      ],
      ...data.students.map((row) => [
        row.className,
        row.firstName,
        row.lastName,
        text(row.studentNumber),
        text(row.parentEmail),
        text(row.accommodations),
        text(row.familyLanguage),
      ]),
    ]),
    file(t('schoolExport.file_assignments'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_assignment'),
        t('schoolExport.col_category'),
        t('schoolExport.col_points'),
        t('schoolExport.col_dueDate'),
      ],
      ...data.assignments.map((row) => [
        row.className,
        row.title,
        row.category,
        text(row.points),
        text(row.dueDate),
      ]),
    ]),
    file(t('schoolExport.file_grades'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_student'),
        t('schoolExport.col_assignment'),
        t('schoolExport.col_status'),
        t('schoolExport.col_score'),
        t('schoolExport.col_comment'),
      ],
      ...data.grades.map((row) => [
        row.className,
        row.student,
        row.assignment,
        t(`gradebook.status_${row.status}`),
        text(row.score),
        text(row.comment),
      ]),
    ]),
    file(t('schoolExport.file_attendance'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_student'),
        t('schoolExport.col_date'),
        t('schoolExport.col_status'),
        t('schoolExport.col_minutesLate'),
        t('schoolExport.col_note'),
      ],
      ...data.attendance.map((row) => [
        row.className,
        row.student,
        row.date,
        t(`attendance.status_${row.status}`),
        text(row.minutesLate),
        text(row.note),
      ]),
    ]),
    file(t('schoolExport.file_answers'), [
      [
        t('schoolExport.col_class'),
        t('schoolExport.col_student'),
        t('schoolExport.col_assignment'),
        t('schoolExport.col_questionNumber'),
        t('schoolExport.col_question'),
        t('schoolExport.col_answer'),
        t('schoolExport.col_handedIn'),
        t('schoolExport.col_late'),
      ],
      ...data.answers.map((row) => [
        row.className,
        row.student,
        row.assignment,
        text(row.question),
        row.prompt,
        row.answer,
        localDateTime(row.submittedAt, timeZone),
        yesNo(row.late),
      ]),
    ]),
  ];
}

/** The download's file name, e.g. "TeacherHubPro school data 2026-11-18.zip". */
export function schoolExportName(t: Translate, day: string): string {
  return `${t('schoolExport.zipName', { date: day })}.zip`;
}
