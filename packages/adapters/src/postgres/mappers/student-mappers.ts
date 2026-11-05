import type {
  SchoolId,
  StudentId,
  StudentInsight,
  StudentNote,
  StudentNoteId,
  UserId,
} from '@thp/domain';
import type { StudentInsightsTable, StudentNotesTable } from '../schema.ts';
import { readJson, toJson, type RowMapper } from './columns.ts';

export const studentNoteMapper: RowMapper<StudentNote, StudentNotesTable> = {
  toRow: (note) => ({
    id: note.id,
    school_id: note.schoolId,
    student_id: note.studentId,
    author_id: note.authorId,
    text: note.text,
    written_at: note.createdAt,
  }),
  fromRow: (row) => ({
    id: row.id as StudentNoteId,
    schoolId: row.school_id as SchoolId,
    studentId: row.student_id as StudentId,
    authorId: row.author_id as UserId,
    text: row.text,
    createdAt: row.written_at,
  }),
};

function bulletsOf(value: unknown): readonly string[] {
  const bullets = readJson(value);
  if (!Array.isArray(bullets) || !bullets.every((b) => typeof b === 'string')) {
    throw new Error('Unexpected value in student_insights.bullets');
  }
  return bullets;
}

export const studentInsightMapper: RowMapper<StudentInsight, StudentInsightsTable> = {
  toRow: (insight) => ({
    school_id: insight.schoolId,
    student_id: insight.studentId,
    teacher_id: insight.teacherId,
    bullets: toJson(insight.bullets),
    generated_at: insight.generatedAt,
  }),
  fromRow: (row) => ({
    schoolId: row.school_id as SchoolId,
    studentId: row.student_id as StudentId,
    teacherId: row.teacher_id as UserId,
    bullets: bulletsOf(row.bullets),
    generatedAt: row.generated_at,
  }),
};
