import { z } from 'zod';
import type { ClassChanges, SemesterId } from '@thp/domain';
import { locale, optional, text } from './forms.ts';

const period = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : Number(value)))
  .pipe(z.number({ error: 'invalid_format' }).int('invalid_format').nullable());

/** Checked day boxes: none, one (a string) or several (a list). */
const days = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]));

export const classForm = z.object({
  name: text,
  subject: optional,
  grade: optional,
  section: optional,
  schoolYear: optional,
  semesterId: optional,
  period,
  startTime: optional,
  endTime: optional,
  days,
  locale,
});

export type ClassFormValues = z.infer<typeof classForm>;

/** The form's values as class details; the domain applies the rules (and the Mon–Fri default). */
export function toClassChanges(values: ClassFormValues): ClassChanges {
  return {
    name: values.name,
    subject: values.subject,
    grade: values.grade,
    section: values.section,
    schoolYear: values.schoolYear,
    semesterId: values.semesterId as SemesterId | null,
    schedule: {
      period: values.period,
      startTime: values.startTime,
      endTime: values.endTime,
      ...(values.days === undefined ? {} : { days: values.days }),
    },
  };
}

export const studentForm = z.object({
  firstName: text,
  lastName: text,
  studentNumber: optional,
  parentEmail: optional,
  accommodations: optional,
  locale,
});

export const semesterForm = z.object({
  name: text,
  startDate: text,
  endDate: text,
  schoolYear: optional,
  makeActive: z
    .string()
    .optional()
    .transform((value) => value === 'on'),
  locale,
});
