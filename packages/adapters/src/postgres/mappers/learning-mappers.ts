import {
  assistantSubjects,
  gradeLevels,
  languages,
  type ClassId,
  type LearningLesson,
  type LearningPath,
  type LearningPathId,
  type LessonAttempt,
  type LessonAttemptId,
  type PathStatus,
  type SchoolId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import type { LearningPathsTable, LessonAttemptsTable } from '../schema.ts';
import { oneOf, readJson, toJson, type TimedRowMapper } from './columns.ts';

const statuses: readonly PathStatus[] = ['draft', 'assigned', 'archived'];

function lessonsOf(value: unknown): readonly LearningLesson[] {
  const lessons = readJson(value);
  if (!Array.isArray(lessons)) throw new Error('Unexpected value in learning_paths.lessons');
  return lessons as LearningLesson[];
}

function answersOf(value: unknown): readonly (number | null)[] {
  const answers = readJson(value);
  if (!Array.isArray(answers)) throw new Error('Unexpected value in lesson_attempts.answers');
  return answers as (number | null)[];
}

export const learningPathMapper: TimedRowMapper<LearningPath, LearningPathsTable> = {
  toRow: (path) => ({
    id: path.id,
    school_id: path.schoolId,
    teacher_id: path.teacherId,
    student_id: path.studentId,
    class_id: path.classId,
    subject: path.subject,
    grade: path.grade,
    language: path.language,
    level: path.level,
    title: path.title,
    description: path.description,
    lessons: toJson(path.lessons),
    status: path.status,
    created_at: path.createdAt,
    assigned_at: path.assignedAt,
  }),
  fromRow: (row) => ({
    id: row.id as LearningPathId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    studentId: row.student_id as StudentId,
    classId: row.class_id as ClassId,
    subject: oneOf(assistantSubjects, row.subject, 'learning_paths.subject'),
    grade: oneOf(gradeLevels, row.grade, 'learning_paths.grade'),
    language: oneOf(languages, row.language, 'learning_paths.language'),
    level: row.level,
    title: row.title,
    description: row.description,
    lessons: lessonsOf(row.lessons),
    status: oneOf(statuses, row.status, 'learning_paths.status'),
    createdAt: row.created_at,
    assignedAt: row.assigned_at,
  }),
};

export const lessonAttemptMapper: TimedRowMapper<LessonAttempt, LessonAttemptsTable> = {
  toRow: (attempt) => ({
    id: attempt.id,
    school_id: attempt.schoolId,
    path_id: attempt.pathId,
    student_id: attempt.studentId,
    lesson: attempt.lesson,
    answers: toJson(attempt.answers),
    score: attempt.score,
    total: attempt.total,
    at: attempt.at,
  }),
  fromRow: (row) => ({
    id: row.id as LessonAttemptId,
    schoolId: row.school_id as SchoolId,
    pathId: row.path_id as LearningPathId,
    studentId: row.student_id as StudentId,
    lesson: row.lesson,
    answers: answersOf(row.answers),
    score: row.score,
    total: row.total,
    at: row.at,
  }),
};
