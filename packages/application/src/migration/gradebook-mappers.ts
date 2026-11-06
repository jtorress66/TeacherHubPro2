import {
  confirmAiGrade,
  createAssignment,
  createGrade,
  createGradeCategory,
  createSubmission,
  gradeManually,
  gradeStatuses,
  matchTypedName,
  maxPoints,
  recordAiFailure,
  recordAiGrade,
  type Assignment,
  type AssignmentId,
  type Class,
  type GradeCategory,
  type GradeCategoryId,
  type GradeId,
  type GradeStatus,
  type QuestionId,
  type StudentId,
  type Submission,
  type SubmissionId,
  type UserId,
} from '@thp/domain';
import type { LegacyDocument } from '@thp/ports';
import { day, instant, list, number, record, records, text } from './legacy-fields.ts';
import {
  invalidReason,
  type LegacyMapper,
  type MigrationContext,
  type MigrationSet,
} from './migration-set.ts';
import { readQuestion } from './question-reader.ts';

export const gradeCategoriesMapper: LegacyMapper = {
  collection: 'grade_categories',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'category_id');
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      if (id === null || cls === undefined) {
        tally.skipped('grade_categories', id === null ? 'missing_id' : 'class_not_found');
        continue;
      }
      const weight = number(doc, 'weight_percent');
      const category = createGradeCategory({
        id: id as GradeCategoryId,
        schoolId: cls.schoolId,
        classId: cls.id,
        name: text(doc, 'name') ?? '',
        ...(weight === null ? {} : { weightPercent: weight }),
      });
      if (!category.ok) {
        tally.skipped('grade_categories', invalidReason(category.error));
        continue;
      }
      set.categories.set(id, category.value);
      tally.imported('grade_categories');
    }
  },
};

/**
 * Where an assignment without a (known) category goes: "Other", weighted 0 so the class's
 * totals stay as they were until the teacher gives it a weight.
 */
function otherCategory(set: MigrationSet, cls: Class): GradeCategory {
  const id = `${cls.id}:other`;
  const existing = set.categories.get(id);
  if (existing !== undefined) return existing;
  const teacher = [...set.users.values(), ...set.adopted.values()].find(
    (user) => user.id === cls.teacherId,
  );
  const category: GradeCategory = {
    id: id as GradeCategoryId,
    schoolId: cls.schoolId,
    classId: cls.id,
    name: teacher?.language === 'es' ? 'Otros' : 'Other',
    weightPercent: 0,
  };
  set.categories.set(id, category);
  return category;
}

/**
 * Gradebook and AI assignments become one kind of assignment with the same questions (and
 * question ids, so old answers still line up). Files and old shared links are not carried over.
 */
export const assignmentsMapper = (collection: 'assignments' | 'ai_assignments'): LegacyMapper => ({
  collection,
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const id = text(doc, 'assignment_id');
      const cls = set.classes.get(text(doc, 'class_id') ?? '');
      if (id === null || cls === undefined) {
        tally.skipped(collection, id === null ? 'missing_id' : 'class_not_found');
        continue;
      }
      const known = set.categories.get(text(doc, 'category_id') ?? '');
      const category = known?.classId === cls.id ? known : otherCategory(set, cls);
      if (category !== known) tally.noted(collection, 'placed_in_other_category');
      const oldQuestions = records(doc, 'questions');
      const questions = oldQuestions.map(readQuestion).filter((q) => q !== null);
      for (let i = questions.length; i < oldQuestions.length; i += 1) {
        tally.noted(collection, 'question_dropped');
      }
      if (text(doc, 'public_token') !== null) tally.noted(collection, 'shared_link_retired');
      if (list(doc, 'attachments').length > 0) tally.noted(collection, 'attachment_not_copied');
      const points = number(doc, 'points');
      const assignment = createAssignment({
        id: id as AssignmentId,
        schoolId: cls.schoolId,
        classId: cls.id,
        categoryId: category.id,
        title: text(doc, 'title') ?? '',
        ...(points === null ? {} : { points }),
        dueDate: day(doc, 'due_date'),
        instructions: text(doc, 'instructions') ?? text(doc, 'description'),
        questions,
      });
      if (!assignment.ok) {
        tally.skipped(collection, invalidReason(assignment.error));
        continue;
      }
      set.assignments.set(id, assignment.value);
      tally.imported(collection);
    }
  },
});

const scored: readonly GradeStatus[] = ['graded', 'late'];

const gradeKey = (assignmentId: string, studentId: string) => `${assignmentId}|${studentId}`;

const teacherOf = (set: MigrationSet, assignment: Assignment) =>
  set.classes.get(assignment.classId);

export const gradesMapper: LegacyMapper = {
  collection: 'grades',
  map(docs, { set, tally }) {
    for (const doc of docs) {
      const assignment = set.assignments.get(text(doc, 'assignment_id') ?? '');
      const student =
        assignment === undefined ? null : set.student(text(doc, 'student_id'), assignment.classId);
      const cls = assignment === undefined ? undefined : teacherOf(set, assignment);
      if (assignment === undefined || student === null || cls === undefined) {
        tally.skipped(
          'grades',
          assignment === undefined ? 'assignment_not_found' : 'student_not_found',
        );
        continue;
      }
      let score = number(doc, 'score');
      const old = text(doc, 'status');
      let status: GradeStatus = (gradeStatuses as readonly (string | null)[]).includes(old)
        ? (old as GradeStatus)
        : score === null
          ? 'pending'
          : 'graded';
      if (!scored.includes(status) && score !== null) {
        tally.noted('grades', 'score_dropped_for_status');
        score = null;
      }
      if (scored.includes(status) && score === null) status = 'pending';
      const grade = createGrade({
        id: (text(doc, 'grade_id') ?? gradeKey(assignment.id, student.id)) as GradeId,
        schoolId: assignment.schoolId,
        studentId: student.id,
        assignmentId: assignment.id,
        status,
        score,
        maxPoints: maxPoints(assignment),
        source: text(doc, 'grade_method') === null ? 'manual' : 'game',
        gradedBy: cls.teacherId,
        comment: text(doc, 'comment'),
      });
      if (!grade.ok) {
        tally.skipped('grades', invalidReason(grade.error));
        continue;
      }
      const key = gradeKey(assignment.id, student.id);
      if (set.grades.has(key)) tally.noted('grades', 'duplicate_replaced');
      set.grades.set(key, grade.value);
      tally.imported('grades');
    }
  },
};

/** Answers keyed by question id, as text. */
function answersOf(doc: LegacyDocument): Readonly<Record<QuestionId, string>> {
  return Object.fromEntries(
    Object.entries(record(doc, 'answers') ?? {}).map(([id, answer]) => [
      id,
      typeof answer === 'string' ? answer : JSON.stringify(answer),
    ]),
  );
}

/** The roster student who made the submission: by id when stored, else by their typed name. */
function submitter(
  { set, tally }: MigrationContext,
  doc: LegacyDocument,
  assignment: Assignment,
): StudentId | null {
  const byId = set.student(text(doc, 'student_id'), assignment.classId);
  if (byId !== null) return byId.id;
  const roster = set.roster(assignment.classId);
  const matched = matchTypedName(text(doc, 'student_name') ?? '', roster);
  if (matched !== null) tally.noted('ai_submissions', 'matched_by_name');
  return matched as StudentId | null;
}

/** Moves a new submission to where the old one was: graded by AI, confirmed, or failed. */
function withHistory(
  context: MigrationContext,
  doc: LegacyDocument,
  submission: Submission,
  classTeacher: UserId,
) {
  const { set, tally } = context;
  const aiScore = number(doc, 'ai_score');
  const draft =
    aiScore === null
      ? null
      : recordAiGrade(submission, { score: aiScore, feedback: text(doc, 'ai_feedback') ?? '' });
  if (draft !== null && !draft.ok) tally.noted('ai_submissions', 'ai_score_dropped');
  const drafted = draft?.ok === true ? draft.value : submission;
  const status = text(doc, 'status');
  const finalScore = number(doc, 'final_score');
  if (status === 'graded' && finalScore !== null) {
    const key = gradeKey(submission.assignmentId, submission.studentId);
    const decision = {
      gradeId: (set.grades.get(key)?.id ?? `${submission.id}:grade`) as GradeId,
      teacherId: set.user(text(doc, 'graded_by'))?.id ?? classTeacher,
      comment: text(doc, 'teacher_feedback'),
      score: finalScore,
    };
    const confirmed =
      drafted.status === 'ai_graded'
        ? confirmAiGrade(drafted, decision)
        : gradeManually(drafted, decision);
    if (confirmed.ok) {
      if (set.grades.has(key)) tally.noted('ai_submissions', 'replaced_gradebook_entry');
      set.grades.set(key, confirmed.value.grade);
      return confirmed.value.submission;
    }
    tally.noted('ai_submissions', 'final_score_dropped');
  }
  if (status === 'grading_failed' && drafted.status === 'submitted') {
    const failed = recordAiFailure(drafted, 'grading_failed');
    if (failed.ok) return failed.value;
  }
  return drafted;
}

/**
 * The old app matched submissions to students by typed name. Each one is tied to a roster
 * student here; a name that matches nobody (or several) is reported, never guessed. A
 * confirmed AI grade becomes the student's grade, replacing a gradebook entry for the same work.
 */
export const aiSubmissionsMapper: LegacyMapper = {
  collection: 'ai_submissions',
  map(docs, context) {
    const { set, tally, now } = context;
    for (const doc of docs) {
      const id = text(doc, 'submission_id');
      const assignment = set.assignments.get(text(doc, 'assignment_id') ?? '');
      const cls = assignment === undefined ? undefined : teacherOf(set, assignment);
      if (id === null || assignment === undefined || cls === undefined) {
        tally.skipped('ai_submissions', id === null ? 'missing_id' : 'assignment_not_found');
        continue;
      }
      const studentId = submitter(context, doc, assignment);
      if (studentId === null) {
        tally.skipped('ai_submissions', 'student_name_not_matched');
        continue;
      }
      const key = gradeKey(assignment.id, studentId);
      if (set.submissions.has(key)) {
        tally.skipped('ai_submissions', 'second_submission');
        continue;
      }
      const submittedAt = instant(doc, 'submitted_at') ?? now;
      const created = createSubmission({
        id: id as SubmissionId,
        schoolId: assignment.schoolId,
        assignmentId: assignment.id,
        studentId,
        answers: answersOf(doc),
        submittedAt,
        maxPoints: maxPoints(assignment),
        late:
          assignment.dueDate !== null &&
          submittedAt.toISOString().slice(0, 10) > assignment.dueDate,
      });
      if (!created.ok) {
        tally.skipped('ai_submissions', invalidReason(created.error));
        continue;
      }
      set.submissions.set(key, withHistory(context, doc, created.value, cls.teacherId));
      tally.imported('ai_submissions');
    }
  },
};
