import { describe, expect, it } from 'vitest';
import {
  createQuestion,
  gradeManually,
  markAttendance,
  recordAiGrade,
  activateSubscription,
  type GradeId,
  type PlanFolderId,
  type QuestionId,
  type SemesterId,
  type StudentId,
  type UserId,
} from '@thp/domain';
import {
  aClass,
  aGame,
  aGrade,
  aReportCardComment,
  aGradeCategory,
  aLessonPlan,
  aPlanFolder,
  aPlanTemplate,
  anAssignment,
  anAttendanceSession,
  aSchool,
  aSemester,
  aStudent,
  aSubmission,
  aSubscription,
  aUser,
  unwrap,
} from '@thp/testing';
import { attendanceMapper } from './attendance-mapper.ts';
import {
  assignmentMapper,
  gradeCategoryMapper,
  gradeMapper,
  reportCardCommentMapper,
  submissionMapper,
} from './gradebook-mappers.ts';
import {
  classMapper,
  gameMapper,
  lessonPlanMapper,
  planFolderMapper,
  planTemplateMapper,
  schoolMapper,
  semesterMapper,
  studentMapper,
  subscriptionMapper,
  userMapper,
} from './school-mappers.ts';

const createdAt = new Date('2026-09-01T00:00:00Z');

/** What a row looks like when read back: jsonb already parsed, created_at filled in. */
function stored<R extends object>(
  row: R,
  jsonColumns: readonly (keyof R)[] = [],
): R & { created_at: Date } {
  const parsed: Record<string, unknown> = { ...row, created_at: createdAt };
  for (const column of jsonColumns) {
    const value = row[column];
    parsed[column as string] = typeof value === 'string' ? JSON.parse(value) : value;
  }
  return parsed as R & { created_at: Date };
}

describe('row mappers round-trip every entity unchanged', () => {
  it('school', () => {
    const school = aSchool({
      address: 'Calle 1',
      phone: '555',
      email: 'a@b.edu',
      logoKey: 'schools/s/logo',
    });
    expect(schoolMapper.fromRow(stored(schoolMapper.toRow(school)))).toEqual(school);
  });

  it('user', () => {
    const user = aUser({ role: 'school_admin', language: 'es', picture: 'https://p/a.png' });
    expect(userMapper.fromRow(stored(userMapper.toRow(user)))).toEqual(user);
  });

  it('class with and without a schedule', () => {
    const scheduled = aClass({
      subject: 'Math',
      grade: '7',
      section: 'B',
      schoolYear: '2026-2027',
      semesterId: 'semester-1' as SemesterId,
      schedule: { period: 3, startTime: '09:50', endTime: '10:40', days: ['Mon', 'Wed'] },
    });
    const plain = aClass();

    expect(classMapper.fromRow(stored(classMapper.toRow(scheduled), ['schedule_days']))).toEqual(
      scheduled,
    );
    expect(classMapper.fromRow(stored(classMapper.toRow(plain), ['schedule_days']))).toEqual(plain);
  });

  it('student', () => {
    const student = aStudent({
      studentNumber: 'S-1',
      parentEmail: 'mom@mail.com',
      accommodations: 'Extra time',
    });
    expect(studentMapper.fromRow(stored(studentMapper.toRow(student)))).toEqual(student);
  });

  it('semester, keeping dates as YYYY-MM-DD', () => {
    const semester = aSemester({ schoolYear: '2026-2027', isActive: true });
    const row = semesterMapper.toRow(semester);

    expect(row.start_date).toBe('2026-08-15');
    expect(semesterMapper.fromRow(stored(row))).toEqual(semester);
  });

  it('lesson plan with its body, kind and folder', () => {
    const plan = aLessonPlan({
      title: 'At the café',
      folderId: 'folder-1' as PlanFolderId,
      body: { kind: 'conversational_english', lessonDate: '2026-09-08', hook: 'Menus' },
    });
    const row = lessonPlanMapper.toRow(plan);

    expect(row.kind).toBe('conversational_english');
    expect(lessonPlanMapper.fromRow(stored(row, ['body']))).toEqual(plan);
  });

  it('plan folder and plan template', () => {
    const folder = aPlanFolder({ color: 'rose' });
    expect(planFolderMapper.fromRow(stored(planFolderMapper.toRow(folder)))).toEqual(folder);
    const template = aPlanTemplate();
    const row = planTemplateMapper.toRow(template);
    expect(row.kind).toBe('weekly');
    expect(planTemplateMapper.fromRow(stored(row, ['body']))).toEqual(template);
  });

  it('grade category', () => {
    const category = aGradeCategory({ weightPercent: 37.5 });
    expect(gradeCategoryMapper.fromRow(stored(gradeCategoryMapper.toRow(category)))).toEqual(
      category,
    );
  });

  it('assignment with questions and a due date', () => {
    const question = unwrap(
      createQuestion({
        type: 'multiple_choice',
        id: 'q1' as QuestionId,
        prompt: '2 + 2?',
        options: ['3', '4'],
        correctOption: 1,
      }),
    );
    const assignment = anAssignment({ dueDate: '2026-09-18', questions: [question] });
    expect(
      assignmentMapper.fromRow(stored(assignmentMapper.toRow(assignment), ['questions'])),
    ).toEqual(assignment);
  });

  it('report card comment', () => {
    const comment = aReportCardComment();
    expect(reportCardCommentMapper.fromRow(stored(reportCardCommentMapper.toRow(comment)))).toEqual(
      comment,
    );
  });

  it('grade', () => {
    const grade = aGrade({ status: 'late', score: 7, maxPoints: 10, comment: 'Two days late' });
    expect(gradeMapper.fromRow(stored(gradeMapper.toRow(grade)))).toEqual(grade);
  });

  it('submission as submitted, AI-graded and confirmed', () => {
    const submitted = aSubmission({ answers: { ['q1' as QuestionId]: 'Jupiter' } });
    const aiGraded = unwrap(recordAiGrade(submitted, { score: 80, feedback: 'Good' }));
    const { submission: confirmed } = unwrap(
      gradeManually(aiGraded, {
        gradeId: 'g1' as GradeId,
        teacherId: 'teacher-1' as UserId,
        score: 90,
      }),
    );

    for (const submission of [submitted, aiGraded, confirmed]) {
      expect(
        submissionMapper.fromRow(
          stored(submissionMapper.toRow(submission), ['answers', 'ai_draft']),
        ),
      ).toEqual(submission);
    }
  });

  it('attendance session with its roster order and marks', () => {
    const roster = ['s2', 's1', 's3'] as StudentId[];
    let session = anAttendanceSession({ roster });
    session = unwrap(markAttendance(session, 's3' as StudentId, 'tardy'));
    session = unwrap(markAttendance(session, 's2' as StudentId, 'present'));

    const { session: row, entries } = attendanceMapper.toRows(session);
    expect(entries.map((e) => [e.student_id, e.position, e.status])).toEqual([
      ['s2', 0, 'present'],
      ['s1', 1, null],
      ['s3', 2, 'tardy'],
    ]);
    const restored = attendanceMapper.fromRows(stored(row), [...entries].reverse());
    expect(restored.roster).toEqual(session.roster);
    expect(new Set(restored.records.map((r) => `${r.studentId}:${r.status}`))).toEqual(
      new Set(session.records.map((r) => `${r.studentId}:${r.status}`)),
    );
    expect({ ...restored, records: [] }).toEqual({ ...session, records: [] });
  });

  it('attendance marks keep their minutes late and note', () => {
    const session = unwrap(
      markAttendance(anAttendanceSession(), 'student-1' as StudentId, 'tardy', {
        minutesLate: 7,
        note: 'Rain',
      }),
    );

    const { session: row, entries } = attendanceMapper.toRows(session);
    expect(entries[0]).toMatchObject({ minutes_late: 7, note: 'Rain' });
    expect(attendanceMapper.fromRows(stored(row), entries)).toEqual(session);
  });

  it('game', () => {
    const game = aGame({ language: 'fr' });
    expect(gameMapper.fromRow(stored(gameMapper.toRow(game), ['items']))).toEqual(game);
  });

  it('subscription', () => {
    const subscription = unwrap(
      activateSubscription(aSubscription({ planId: 'school', quantity: 12 }), {
        currentPeriodEnd: new Date('2027-09-01T00:00:00Z'),
        externalId: 'ext-1',
      }),
    );
    expect(subscriptionMapper.fromRow(stored(subscriptionMapper.toRow(subscription)))).toEqual(
      subscription,
    );
  });

  it('accepts jsonb given as text as well as parsed', () => {
    const plan = aLessonPlan({ title: 'X' });
    expect(lessonPlanMapper.fromRow(stored(lessonPlanMapper.toRow(plan)))).toEqual(plan);
  });
});

describe('row mappers reject corrupt stored values', () => {
  it('an unknown role, language or onboarding status', () => {
    const row = stored(userMapper.toRow(aUser()));
    expect(() => userMapper.fromRow({ ...row, role: 'owner' })).toThrow('users.role');
    expect(() => userMapper.fromRow({ ...row, language: 'ru' })).toThrow('users.language');
    expect(() => userMapper.fromRow({ ...row, onboarding_status: 'half' })).toThrow(
      'users.onboarding_status',
    );
  });

  it('an unknown grade status or source', () => {
    const row = stored(gradeMapper.toRow(aGrade()));
    expect(() => gradeMapper.fromRow({ ...row, status: 'done' })).toThrow('grades.status');
    expect(() => gradeMapper.fromRow({ ...row, source: 'ai' })).toThrow('grades.source');
  });

  it('an unknown submission status', () => {
    const row = stored(submissionMapper.toRow(aSubmission()), ['answers', 'ai_draft']);
    expect(() => submissionMapper.fromRow({ ...row, status: 'graded' })).toThrow(
      'submissions.status',
    );
  });

  it('an unknown attendance status', () => {
    const { session, entries } = attendanceMapper.toRows(anAttendanceSession());
    expect(() =>
      attendanceMapper.fromRows(stored({ ...session, status: 'closed' }), entries),
    ).toThrow('attendance_sessions.status');
    expect(() =>
      attendanceMapper.fromRows(
        stored(session),
        entries.map((e) => ({ ...e, status: 'late' })),
      ),
    ).toThrow('attendance_entries.status');
  });

  it('an unknown plan, subscription status, folder colour or schedule day', () => {
    const subscription = stored(subscriptionMapper.toRow(aSubscription()));
    expect(() => subscriptionMapper.fromRow({ ...subscription, plan_id: 'gold' })).toThrow(
      'subscriptions.plan_id',
    );
    expect(() => subscriptionMapper.fromRow({ ...subscription, status: 'paused' })).toThrow(
      'subscriptions.status',
    );

    const folder = stored(planFolderMapper.toRow(aPlanFolder()));
    expect(() => planFolderMapper.fromRow({ ...folder, color: 'plaid' })).toThrow(
      'plan_folders.color',
    );

    const cls = stored(classMapper.toRow(aClass({ schedule: {} })), ['schedule_days']);
    expect(() => classMapper.fromRow({ ...cls, schedule_days: ['Funday'] })).toThrow(
      'classes.schedule_days',
    );
  });

  it('a date that is not YYYY-MM-DD and a time that is not HH:MM', () => {
    const semester = stored(semesterMapper.toRow(aSemester()));
    expect(() => semesterMapper.fromRow({ ...semester, start_date: '2026-13-01' })).toThrow(
      'semesters.start_date',
    );

    const cls = stored(
      classMapper.toRow(aClass({ schedule: { startTime: '08:00', endTime: '09:00' } })),
      ['schedule_days'],
    );
    expect(() => classMapper.fromRow({ ...cls, start_time: '8am' })).toThrow('classes.start_time');
  });
});
