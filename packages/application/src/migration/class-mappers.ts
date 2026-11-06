import {
  createClass,
  createSchedule,
  createStudent,
  parseEmail,
  type ClassId,
  type ScheduleInput,
  type StudentId,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { number, strings, text } from './legacy-fields.ts';
import { invalidReason, type LegacyMapper } from './migration-set.ts';

const dayNames: Readonly<Record<string, string>> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
  lun: 'Mon',
  mar: 'Tue',
  mie: 'Wed',
  mié: 'Wed',
  jue: 'Thu',
  vie: 'Fri',
  sáb: 'Sat',
  sab: 'Sat',
  dom: 'Sun',
};

/** "Monday", "monday", "Mon" or "Lunes" as the new app's day. */
const weekday = (name: string): string => dayNames[name.trim().slice(0, 3).toLowerCase()] ?? name;

/** The old class's period, times and days; null when it had none. */
function scheduleOf(doc: LegacyDocument): ScheduleInput | null {
  const period = number(doc, 'period');
  const startTime = text(doc, 'start_time');
  const endTime = text(doc, 'end_time');
  const days = strings(doc, 'days_of_week').map(weekday);
  if (period === null && startTime === null && endTime === null && days.length === 0) return null;
  return {
    period,
    startTime,
    endTime,
    ...(days.length > 0 ? { days: [...new Set(days)] } : {}),
  };
}

export const classesMapper: LegacyMapper = {
  collection: 'classes',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'class_id');
      const teacher = set.user(text(doc, 'teacher_id'));
      if (id === null || teacher === null) {
        tally.skipped('classes', id === null ? 'missing_id' : 'teacher_not_found');
        continue;
      }
      let schedule = scheduleOf(doc);
      if (schedule !== null && !createSchedule(schedule).ok) {
        tally.noted('classes', 'schedule_dropped');
        schedule = null;
      }
      const semester = set.semesters.get(text(doc, 'semester_id') ?? '');
      const cls = createClass({
        id: id as ClassId,
        schoolId: set.schoolId(text(doc, 'school_id')) ?? teacher.schoolId,
        teacherId: teacher.id,
        name: text(doc, 'name') ?? '',
        subject: text(doc, 'subject'),
        grade: text(doc, 'grade'),
        section: text(doc, 'section'),
        schoolYear: text(doc, 'year_term'),
        semesterId: semester?.id ?? null,
        schedule,
      });
      if (!cls.ok) {
        tally.skipped('classes', invalidReason(cls.error));
        continue;
      }
      set.classes.set(id, cls.value);
      tally.imported('classes');
    }
  },
};

/**
 * A student belongs to one class here. A student the old app kept in several classes gets a
 * record in each (`<old id>:<class id>`), so their grades and attendance stay with the right
 * class. The student's own email is not carried over: no feature needs it.
 */
export const studentsMapper: LegacyMapper = {
  collection: 'students',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'student_id');
      const classIds = [
        ...new Set([text(doc, 'class_id'), ...strings(doc, 'class_ids')].filter((c) => c !== null)),
      ].filter((classId) => set.classes.has(classId));
      if (id === null || classIds.length === 0) {
        tally.skipped('students', id === null ? 'missing_id' : 'class_not_found');
        continue;
      }
      const parentEmail = text(doc, 'parent_email');
      const emailOk = parentEmail === null || parseEmail('parentEmail', parentEmail).ok;
      if (!emailOk) tally.noted('students', 'parent_email_dropped');
      const accommodations = doc.accommodations;
      let failed: string | null = null;
      for (const [index, classId] of classIds.entries()) {
        const cls = set.classes.get(classId);
        if (cls === undefined) continue;
        const student = createStudent({
          id: (index === 0 ? id : `${id}:${classId}`) as StudentId,
          schoolId: cls.schoolId,
          classId: cls.id,
          firstName: text(doc, 'first_name') ?? '',
          lastName: text(doc, 'last_name') ?? '',
          studentNumber: text(doc, 'student_number'),
          parentEmail: emailOk ? parentEmail : null,
          accommodations: Array.isArray(accommodations)
            ? strings(doc, 'accommodations').join('\n')
            : text(doc, 'accommodations'),
        });
        if (!student.ok) {
          failed = invalidReason(student.error);
          break;
        }
        set.enrol(id, cls.id, student.value);
        if (index > 0) tally.noted('students', 'copied_to_another_class');
      }
      if (failed === null) tally.imported('students');
      else tally.skipped('students', failed);
    }
  },
};
