import { describe, expect, it } from 'vitest';
import type { SchoolExport } from '@thp/application';
import type { LocalDate } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { schoolExportFiles, schoolExportName } from './school-export-view.ts';

const data: SchoolExport = {
  teachers: [{ name: 'Ana López', email: 'ana@school.edu', role: 'school_admin' }],
  classes: [
    {
      name: 'Ciencias 5',
      teacher: 'Ana López',
      subject: 'Ciencias',
      grade: '5',
      section: null,
      schoolYear: '2026-2027',
      archived: true,
    },
  ],
  students: [
    {
      className: 'Ciencias 5',
      student: 'Ben Acosta',
      firstName: 'Ben',
      lastName: 'Acosta',
      studentNumber: '0042',
      parentEmail: 'mom@x.com',
      accommodations: 'Extra time',
      familyLanguage: 'zh',
    },
  ],
  assignments: [
    {
      className: 'Ciencias 5',
      title: 'Quiz 1',
      category: 'Quizzes',
      points: 10,
      dueDate: '2026-09-10' as LocalDate,
    },
  ],
  grades: [
    {
      className: 'Ciencias 5',
      student: 'Ben Acosta',
      assignment: 'Quiz 1',
      status: 'graded',
      score: 9.5,
      comment: '=nice',
    },
  ],
  attendance: [
    {
      className: 'Ciencias 5',
      student: 'Ben Acosta',
      date: '2026-09-01' as LocalDate,
      status: 'tardy',
      minutesLate: 5,
      note: null,
    },
  ],
  answers: [
    {
      className: 'Ciencias 5',
      student: 'Ben Acosta',
      assignment: 'Quiz 1',
      question: 1,
      prompt: 'Why day and night?',
      answer: 'The Earth\nturns.',
      submittedAt: new Date('2026-09-02T14:05:00Z'),
      late: false,
    },
  ],
  curriculum: [
    {
      subject: 'science',
      grade: 'K',
      title: 'Science K',
      sourceName: 'Guide.docx',
      text: 'Unit 1: Weather',
    },
    { subject: 'math', grade: '5', title: 'Math 5', sourceName: null, text: 'Unit 1: Fractions' },
  ],
};

const lines = (text: string | undefined) => (text ?? '').replace(/^\uFEFF/u, '').split('\r\n');

describe('schoolExportFiles', () => {
  it('writes one spreadsheet per table, headers and values in the person’s language', () => {
    const files = schoolExportFiles(data, createTranslator('en'), 'America/Puerto_Rico');
    const file = (name: string) => files.find((f) => f.name === name)?.text;

    expect(files.map((f) => f.name)).toEqual([
      'teachers.csv',
      'classes.csv',
      'students.csv',
      'assignments.csv',
      'grades.csv',
      'attendance.csv',
      'student-answers.csv',
      'curriculum.csv',
    ]);
    expect(lines(file('teachers.csv'))).toEqual([
      'Name,Email,Role',
      'Ana López,ana@school.edu,School admin',
      '',
    ]);
    expect(lines(file('classes.csv'))[1]).toBe('Ciencias 5,Ana López,Ciencias,5,,2026-2027,Yes');
    expect(lines(file('students.csv'))[1]).toBe(
      'Ciencias 5,Ben,Acosta,0042,mom@x.com,Extra time,zh',
    );
    expect(lines(file('assignments.csv'))[1]).toBe('Ciencias 5,Quiz 1,Quizzes,10,2026-09-10');
    expect(lines(file('grades.csv'))[1]).toBe("Ciencias 5,Ben Acosta,Quiz 1,Graded,9.5,'=nice");
    expect(lines(file('attendance.csv'))[1]).toBe('Ciencias 5,Ben Acosta,2026-09-01,Tardy,5,');
    expect(lines(file('curriculum.csv'))).toEqual([
      'Subject,Grade level,Title,File,Text',
      'Science,Kindergarten,Science K,Guide.docx,Unit 1: Weather',
      'Mathematics,5,Math 5,,Unit 1: Fractions',
      '',
    ]);
    expect(file('student-answers.csv')).toContain(
      'Ciencias 5,Ben Acosta,Quiz 1,1,Why day and night?,"The Earth\nturns.",2026-09-02 10:05,No',
    );
  });

  it('translates the headers and labels, and starts every file with the UTF-8 mark', () => {
    const files = schoolExportFiles(data, createTranslator('es'), 'UTC');

    expect(files.every((f) => f.text.startsWith('\uFEFF'))).toBe(true);
    expect(files.find((f) => f.name === 'calificaciones.csv')?.text).toContain('Calificado');
    expect(files.find((f) => f.name === 'asistencia.csv')?.text).toContain('Tardanza');
  });
});

describe('schoolExportName', () => {
  it('names the download after the school data and the day', () => {
    expect(schoolExportName(createTranslator('en'), '2026-11-18')).toBe(
      'TeacherHubPro school data 2026-11-18.zip',
    );
  });
});
