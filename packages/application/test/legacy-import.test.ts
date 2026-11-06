import { describe, expect, it } from 'vitest';
import {
  createSchool,
  createUser,
  type ClassId,
  type Email,
  type MigrationReport,
  type SchoolId,
  type StudentId,
  type SubscriptionId,
  type UserId,
} from '@thp/domain';
import type { LegacyDocument, LegacySource } from '@thp/ports';
import { InMemoryLeadRepository } from '@thp/testing';
import { ImportLegacyData, LogIn } from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { makeWorld } from './world.ts';

type Export = Record<string, readonly LegacyDocument[]>;

const source = (data: Export): LegacySource => ({
  read: (collection) => Promise.resolve(data[collection] ?? []),
});

/** An old bcrypt hash; the world's fake hasher treats `legacy$<password>` as one. */
const oldHash = 'legacy$old password';

/** A small export shaped like the old app's records (field names as the old code wrote them). */
const oldData = (): Export => ({
  schools: [
    {
      school_id: 'school_ana',
      name: 'My School',
      address: '',
      email: '',
      owner_user_id: 'user_ana',
    },
    {
      school_id: 'school_lincoln',
      name: 'Lincoln Middle',
      email: 'not an email',
      logo_url: '/uploads/logo.png',
    },
  ],
  users: [
    {
      user_id: 'user_ana',
      email: 'Ana@School.edu',
      name: 'Ana López',
      role: 'teacher',
      school_id: 'school_ana',
      language: 'es',
      password_hash: oldHash,
      onboarding_status: 'completed',
    },
    {
      user_id: 'user_ben',
      email: 'ben@lincoln.edu',
      name: 'Ben Admin',
      role: 'admin',
      school_id: 'school_lincoln',
      language: 'en',
      created_at: '2026-08-28T08:00:00+00:00',
    },
    {
      user_id: 'user_pat',
      email: 'pat@home.com',
      name: 'Pat',
      role: 'parent',
      school_id: 'school_ana',
    },
    { user_id: 'user_dup', email: 'ana@school.edu', name: 'Twin', school_id: 'school_ana' },
    { user_id: 'user_lost', email: 'lost@school.edu', name: 'Lost', school_id: 'school_gone' },
  ],
  subscriptions: [
    {
      subscription_id: 'sub_1',
      user_id: 'user_ana',
      plan_id: 'individual_monthly',
      quantity: 1,
      status: 'active',
      stripe_subscription_id: 'sub_stripe_1',
      current_period_end: '2026-09-15T00:00:00+00:00',
      trial_end: '2026-08-01T00:00:00+00:00',
    },
    { subscription_id: 'sub_2', user_id: 'user_ana', plan_id: 'gold', status: 'active' },
  ],
  semesters: [
    {
      semester_id: 'sem_1',
      school_id: 'school_ana',
      name: 'Fall',
      start_date: '2026-08-10',
      end_date: '2026-12-18',
      is_active: true,
    },
  ],
  classes: [
    {
      class_id: 'class_math',
      school_id: 'school_ana',
      teacher_id: 'user_ana',
      name: 'Math 5',
      grade: '5',
      subject: 'Math',
      semester_id: 'sem_1',
      period: 2,
      start_time: '09:00',
      end_time: '09:50',
      days_of_week: ['Monday', 'Wednesday'],
    },
    {
      class_id: 'class_art',
      school_id: 'school_ana',
      teacher_id: 'user_ana',
      name: 'Art',
      period: 40,
    },
    { class_id: 'class_orphan', school_id: 'school_ana', teacher_id: 'user_gone', name: 'Orphan' },
  ],
  students: [
    {
      student_id: 'student_jose',
      class_id: 'class_math',
      class_ids: ['class_math', 'class_art'],
      first_name: 'José',
      last_name: 'Álvarez',
      parent_email: 'mom@home.com',
      email: 'jose@kids.com',
    },
    {
      student_id: 'student_luz',
      class_id: 'class_math',
      first_name: 'Luz',
      last_name: 'Rivera',
      parent_email: 'nope',
    },
    { student_id: 'student_x', class_id: 'class_gone', first_name: 'X', last_name: 'Y' },
  ],
  plan_folders: [
    { folder_id: 'folder_1', teacher_id: 'user_ana', name: 'Unit 1', color: '#10b981' },
  ],
  lesson_plans: [
    {
      plan_id: 'plan_1',
      class_id: 'class_math',
      teacher_id: 'user_ana',
      school_id: 'school_ana',
      plan_type: 'weekly',
      week_start: '2026-09-09',
      week_end: '2026-09-13',
      unit: 'Fractions',
      objective: 'Add fractions',
      skills: ['a', 'b', 'c', 'd', 'e'],
      days: [
        {
          date: '2026-09-07',
          day_name: 'Monday',
          theme: 'Halves',
          dok_levels: [1, 2, 7],
          eca: { E: false, C: true, A: true },
          activities: [
            { activity_type: 'brainstorming', checked: true, notes: 'Pizza' },
            { activity_type: 'comprehension', checked: true },
            { activity_type: 'vocabulary', checked: false },
            { activity_type: 'juggling', checked: true },
          ],
          materials: [
            { material_type: 'book', checked: true },
            { material_type: 'notebook', checked: false },
          ],
        },
      ],
      standards: [
        { week_index: 1, domain: 'Math', codes: ['CCSS.MATH.CONTENT.5.NF.A.1', 'MADE.UP.1'] },
      ],
      expectations: [{ week_index: 1, text: 'Students add unlike fractions.' }],
      subject_integration: ['Mathematics', 'Estudios Sociales', 'Cooking'],
      folder_id: 'folder_1',
    },
    {
      plan_id: 'plan_tpl',
      class_id: 'class_math',
      teacher_id: 'user_ana',
      week_start: '2026-09-14',
      is_template: true,
      template_name: 'My week',
    },
    {
      plan_id: 'plan_ce',
      class_id: 'class_art',
      teacher_id: 'user_ana',
      plan_type: 'conversational_english',
      week_start: '2026-09-14',
      lesson_date: '2026-09-15',
      title: 'Greetings',
      lesson_topic: 'Hello',
      hook_intro: 'Song',
      materials_text: 'Cards',
      additional_notes: 'Fun',
    },
    { plan_id: 'plan_lost', teacher_id: 'user_gone', week_start: '2026-09-14' },
  ],
  attendance_sessions: [
    {
      session_id: 'att_1',
      class_id: 'class_math',
      date: '2026-09-02',
      status: 'submitted',
      records: [
        { student_id: 'student_jose', status: 'late', minutes_late: 5 },
        { student_id: 'student_luz', status: 'absent', note: 'Sick' },
        { student_id: 'student_ghost', status: 'present' },
      ],
    },
    {
      session_id: 'att_2',
      class_id: 'class_math',
      date: '2026-09-03',
      status: 'open',
      records: [],
    },
  ],
  grade_categories: [
    { category_id: 'cat_hw', class_id: 'class_math', name: 'Homework', weight_percent: 40 },
  ],
  assignments: [
    {
      assignment_id: 'asg_1',
      class_id: 'class_math',
      category_id: 'cat_hw',
      title: 'Worksheet 1',
      points: 20,
      due_date: '2026-09-05',
      description: 'Page 4',
      public_token: 'abc123',
      attachments: [{ name: 'sheet.pdf' }],
    },
    { assignment_id: 'asg_game', class_id: 'class_math', title: 'Game: Fractions', points: 10 },
  ],
  ai_assignments: [
    {
      assignment_id: 'aiassign_1',
      class_id: 'class_math',
      category_id: 'cat_hw',
      title: 'Quiz',
      due_date: '2026-09-04',
      questions: [
        {
          question_id: 'q1',
          question_type: 'multiple_choice',
          question_text: '1/2 + 1/2?',
          points: 5,
          options: [
            { text: '1', is_correct: true },
            { text: '2', is_correct: false },
          ],
        },
        {
          question_id: 'q2',
          question_type: 'true_false',
          question_text: 'Is 1/2 > 1/3?',
          points: 5,
          correct_answer: 'True',
        },
        {
          question_id: 'q3',
          question_type: 'matching',
          question_text: 'Match',
          points: 5,
          matching_pairs: { '1/2': 'half', '1/4': 'quarter' },
        },
        {
          question_id: 'q4',
          question_type: 'essay',
          question_text: 'Explain',
          points: 5,
          rubric_criteria: ['Clear', 'Correct'],
        },
        { question_id: 'q5', question_type: 'drawing', question_text: 'Draw', points: 5 },
      ],
    },
  ],
  grades: [
    {
      grade_id: 'grade_1',
      assignment_id: 'asg_1',
      student_id: 'student_jose',
      score: 18,
      status: 'graded',
    },
    {
      grade_id: 'grade_2',
      assignment_id: 'asg_1',
      student_id: 'student_luz',
      status: 'missing',
      score: 0,
    },
    {
      grade_id: 'grade_3',
      assignment_id: 'asg_game',
      student_id: 'student_jose',
      score: 9,
      grade_method: 'best',
    },
    {
      grade_id: 'grade_4',
      assignment_id: 'asg_1',
      student_id: 'student_ghost',
      score: 3,
      status: 'graded',
    },
    {
      grade_id: 'grade_5',
      assignment_id: 'aiassign_1',
      student_id: 'student_luz',
      score: 11,
      status: 'graded',
    },
  ],
  ai_submissions: [
    {
      submission_id: 'sub_a',
      assignment_id: 'aiassign_1',
      class_id: 'class_math',
      student_name: 'jose alvarez',
      student_email: 'jose@kids.com',
      answers: { q1: '0', q2: 'true', q4: 'Because' },
      submitted_at: '2026-09-03T15:00:00+00:00',
      status: 'graded',
      ai_score: 14,
      ai_feedback: 'Good',
      final_score: 15,
      teacher_feedback: 'Nice work',
    },
    {
      submission_id: 'sub_b',
      assignment_id: 'aiassign_1',
      student_name: 'Rivera, Luz',
      answers: { q1: '1' },
      submitted_at: '2026-09-05T15:00:00+00:00',
      status: 'pending_review',
      ai_score: 12,
      ai_feedback: 'Check q4',
    },
    {
      submission_id: 'sub_c',
      assignment_id: 'aiassign_1',
      student_name: 'Somebody Else',
      answers: {},
      submitted_at: '2026-09-03T15:00:00+00:00',
      status: 'pending',
    },
  ],
  portal_tokens: [
    {
      token: 'portal_live',
      student_id: 'student_jose',
      parent_email: 'mom@home.com',
      expires_at: '2026-09-30T00:00:00+00:00',
    },
    { token: 'portal_old', student_id: 'student_luz', expires_at: '2026-01-01T00:00:00+00:00' },
  ],
  homeschool_portal_tokens: [
    { token: 'hsp_live', student_id: 'student_luz', expires_at: '2026-10-01T00:00:00+00:00' },
  ],
  student_learning_tokens: [
    { token: 'slt_live', student_id: 'student_jose', expires_at: '2026-10-01T00:00:00+00:00' },
  ],
  student_notes: [
    {
      note_id: 'snote_1',
      student_id: 'student_jose',
      teacher_id: 'user_ana',
      content: 'Loves maps',
      created_at: '2026-08-20T10:00:00+00:00',
    },
  ],
  student_insights: [
    {
      student_id: 'student_jose',
      teacher_id: 'user_ana',
      insight: '- Improving in fractions\n- Missed one day\n- Try challenge work',
      generated_at: '2026-08-21T10:00:00+00:00',
    },
    {
      student_id: 'student_luz',
      teacher_id: 'user_ana',
      insight: 'A paragraph only.',
      generated_at: '2026-08-21T10:00:00+00:00',
    },
  ],
  sub_packets: [
    {
      class_id: 'class_math',
      teacher_id: 'user_ana',
      main_office_ext: '101',
      daily_routines: 'Warm-up first',
    },
  ],
  trial_reminders: [{ user_id: 'user_ana', days_left: 3, sent_at: '2026-07-29T00:00:00+00:00' }],
  leads: [
    {
      lead_id: 'lead_1',
      session_id: 'chat_1',
      first_name: 'Dana',
      last_name: 'District',
      email: 'dana@district.org',
      school_org: 'North District',
      visitor_category: 'district',
      interest_category: 'demo',
      chat_summary: 'Wants a demo',
      created_at: '2026-08-01T00:00:00+00:00',
      status: 'contacted',
    },
  ],
  user_sessions: [{ session_token: 'secret' }, { session_token: 'secret2' }],
  grading_jobs: [{ job_id: 'job_1' }],
});

function importer(data: Export = oldData()) {
  const world = { ...makeWorld(), leads: new InMemoryLeadRepository() };
  const legacy = source(data);
  return {
    world,
    run: (apply: boolean) => new ImportLegacyData({ ...world, legacy }).execute({ apply }),
  };
}

const line = (report: MigrationReport, collection: string) =>
  report.collections.find((c) => c.collection === collection);

describe('importing the old app’s data', () => {
  it('accounts for every record: imported, or skipped with a reason, with no personal data', async () => {
    const { run } = importer();
    const report = await run(false);

    expect(report.unaccounted).toEqual([]);
    expect(line(report, 'users')).toEqual({
      collection: 'users',
      read: 5,
      imported: 2,
      skipped: { role_without_accounts: 1, duplicate_email: 1, school_not_found: 1 },
      notes: { no_password: 1, trial_carried_over: 1 },
    });
    expect(line(report, 'user_sessions')).toMatchObject({ read: 2, skipped: { transient: 2 } });
    expect(line(report, 'grading_jobs')).toMatchObject({ skipped: { transient: 1 } });
    expect(JSON.stringify(report)).not.toMatch(/José|Ana López|mom@home|portal_live/u);
  });

  it('writes nothing on a dry run', async () => {
    const { world, run } = importer();
    await run(false);

    expect(world.schools.all()).toEqual([]);
    expect(world.users.all()).toEqual([]);
    expect(world.grades.all()).toEqual([]);
  });

  it('keeps old ids, roles and settings, and lets a teacher log in with their old password', async () => {
    const { world, run } = importer();
    await run(true);

    expect(world.schools.all().map((s) => [s.id, s.name, s.email])).toEqual([
      ['school_ana', 'My School', null],
      ['school_lincoln', 'Lincoln Middle', null],
    ]);
    expect(world.users.all().map((u) => [u.id, u.email, u.role, u.language])).toEqual([
      ['user_ana', 'ana@school.edu', 'teacher', 'es'],
      ['user_ben', 'ben@lincoln.edu', 'school_admin', 'en'],
    ]);
    const loggedIn = await new LogIn(world).execute({
      email: 'ana@school.edu',
      password: 'old password',
    });
    expect(loggedIn.ok).toBe(true);
    const rehashed = await world.credentials.findByUserId('user_ana' as UserId);
    expect(rehashed?.passwordHash).not.toBe(oldHash);
  });

  it('never overwrites a password chosen in the new app when imported again', async () => {
    const { world, run } = importer();
    await run(true);
    await world.credentials.save({ userId: 'user_ana' as UserId, passwordHash: 'hashed:new' });
    await run(true);

    expect((await world.credentials.findByUserId('user_ana' as UserId))?.passwordHash).toBe(
      'hashed:new',
    );
  });

  it('is idempotent: importing twice gives the same rows', async () => {
    const { world, run } = importer();
    await run(true);
    const first = [world.students.all(), world.grades.all(), world.submissions.all()];
    const report = await run(true);

    expect([world.students.all(), world.grades.all(), world.submissions.all()]).toEqual(first);
    expect(report.unaccounted).toEqual([]);
  });

  it('attaches an old account to the same person’s existing account, merging their personal school', async () => {
    const { world, run } = importer();
    const school = valueOf(createSchool({ id: 'school_new' as SchoolId, name: 'TeacherHubPro' }));
    await world.schools.save(school);
    await world.users.save(
      valueOf(
        createUser({
          id: 'user_owner' as UserId,
          schoolId: school.id,
          email: 'ana@school.edu',
          name: 'Ana',
          role: 'super_admin',
        }),
      ),
    );
    const report = await run(true);

    expect(line(report, 'users')?.notes).toMatchObject({ matched_existing_account: 1 });
    expect(line(report, 'schools')?.notes).toMatchObject({ merged_into_existing_account: 1 });
    expect((await world.users.findById(school.id, 'user_owner' as UserId))?.role).toBe(
      'super_admin',
    );
    expect(world.users.all().some((u) => u.id === 'user_ana')).toBe(false);
    expect(world.classes.all().find((c) => c.id === 'class_math')).toMatchObject({
      teacherId: 'user_owner',
      schoolId: 'school_new',
    });
    expect(world.subscriptions.all()[0]).toMatchObject({ ownerId: 'user_owner' });
  });

  it('carries over the subscription with its payment id; an unknown plan is skipped', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.subscriptions.all().filter((s) => s.ownerId === 'user_ana')).toEqual([
      {
        id: 'sub_1',
        schoolId: 'school_ana',
        ownerId: 'user_ana',
        planId: 'individual_monthly',
        quantity: 1,
        status: 'active',
        trialEndsAt: new Date('2026-08-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-09-15T00:00:00Z'),
        externalId: 'sub_stripe_1',
      },
    ]);
    expect(line(report, 'subscriptions')?.skipped).toEqual({ unknown_plan: 1 });
  });

  it('carries over the old app’s free trial (7 days from sign-up) for someone with no subscription', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.subscriptions.all().find((s) => s.ownerId === 'user_ben')).toEqual({
      id: 'trial_user_ben',
      schoolId: 'school_lincoln',
      ownerId: 'user_ben',
      planId: 'individual_monthly',
      quantity: 1,
      status: 'trialing',
      trialEndsAt: new Date('2026-09-04T08:00:00Z'),
      currentPeriodEnd: null,
      externalId: null,
    });
    expect(line(report, 'users')?.notes).toMatchObject({ trial_carried_over: 1 });
  });

  it('imports classes with their schedule, dropping a schedule the new rules refuse', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.classes.all().map((c) => [c.id, c.semesterId, c.schedule])).toEqual([
      [
        'class_math',
        'sem_1',
        { period: 2, startTime: '09:00', endTime: '09:50', days: ['Mon', 'Wed'] },
      ],
      ['class_art', null, null],
    ]);
    expect(line(report, 'classes')).toMatchObject({
      skipped: { teacher_not_found: 1 },
      notes: { schedule_dropped: 1 },
    });
  });

  it('gives a student in several classes a record in each, without their own email', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.students.all().map((s) => [s.id, s.classId, s.parentEmail])).toEqual([
      ['student_jose', 'class_math', 'mom@home.com'],
      ['student_jose:class_art', 'class_art', 'mom@home.com'],
      ['student_luz', 'class_math', null],
    ]);
    expect(line(report, 'students')).toMatchObject({
      imported: 2,
      skipped: { class_not_found: 1 },
      notes: { copied_to_another_class: 1, parent_email_dropped: 1 },
    });
  });

  it('turns old weekly plans, templates and Conversational English plans into new ones', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.planFolders.all()).toMatchObject([{ id: 'folder_1', color: 'emerald' }]);
    const [weekly, conversational] = world.lessonPlans.all();
    expect(weekly).toMatchObject({ id: 'plan_1', classId: 'class_math', folderId: 'folder_1' });
    expect(weekly?.body).toMatchObject({
      kind: 'weekly',
      unit: 'Fractions',
      subjectIntegration: ['mathematics', 'social_studies'],
      weeks: [
        {
          weekStart: '2026-09-07',
          objective: 'Add fractions',
          skills: ['a', 'b', 'c', 'd'],
          standards: ['CCSS.Math.Content.5.NF.A.1'],
          expectations: 'Students add unlike fractions.',
        },
      ],
    });
    const monday = weekly?.body.kind === 'weekly' ? weekly.body.weeks[0]?.days[0] : undefined;
    expect(monday).toEqual({
      theme: 'Halves',
      dok: [1, 2],
      eca: ['core', 'assessment'],
      activities: [
        { type: 'brainstorming', notes: 'Pizza' },
        { type: 'comprehension_questions', notes: null },
        { type: 'other', notes: null },
      ],
      materials: ['book'],
      notes: null,
    });
    expect(conversational?.body).toMatchObject({
      kind: 'conversational_english',
      lessonDate: '2026-09-15',
      topic: 'Hello',
      hook: 'Song',
      materials: 'Cards',
      notes: 'Fun',
    });
    expect(conversational?.title).toBe('Greetings');
    expect(world.planTemplates.all()).toMatchObject([{ id: 'plan_tpl', name: 'My week' }]);
    expect(line(report, 'lesson_plans')).toMatchObject({
      read: 4,
      imported: 3,
      skipped: { teacher_not_found: 1 },
    });
    expect(line(report, 'lesson_plans')?.notes).toMatchObject({
      week_moved_to_monday: 1,
      skills_over_limit: 1,
      unknown_standard_dropped: 1,
      subject_integration_dropped: 1,
      unknown_activity_kept_as_other: 1,
      dok_level_dropped: 1,
    });
  });

  it('imports attendance; a late arrival becomes tardy and an unknown student is left out', async () => {
    const { world, run } = importer();
    const report = await run(true);

    const [submitted, open] = world.attendanceSessions.all();
    expect(submitted).toMatchObject({
      status: 'submitted',
      roster: ['student_jose', 'student_luz'],
      records: [
        { studentId: 'student_jose', status: 'tardy', minutesLate: 5, note: null },
        { studentId: 'student_luz', status: 'absent', minutesLate: null, note: 'Sick' },
      ],
    });
    expect(open).toMatchObject({ status: 'open', roster: ['student_jose', 'student_luz'] });
    expect(line(report, 'attendance_sessions')?.notes).toEqual({ record_student_not_found: 1 });
  });

  it('imports assignments and questions, placing ones without a category in a zero-weight "Other" (in the teacher’s language)', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(world.gradeCategories.all().map((c) => [c.id, c.name, c.weightPercent])).toEqual([
      ['cat_hw', 'Homework', 40],
      ['class_math:other', 'Otros', 0],
    ]);
    const quiz = world.assignments.all().find((a) => a.id === 'aiassign_1');
    expect(quiz?.questions).toEqual([
      {
        type: 'multiple_choice',
        id: 'q1',
        prompt: '1/2 + 1/2?',
        points: 5,
        instructions: null,
        options: ['1', '2'],
        correctOption: 0,
      },
      {
        type: 'true_false',
        id: 'q2',
        prompt: 'Is 1/2 > 1/3?',
        points: 5,
        instructions: null,
        answer: true,
      },
      {
        type: 'matching',
        id: 'q3',
        prompt: 'Match',
        points: 5,
        instructions: null,
        pairs: [
          { left: '1/2', right: 'half' },
          { left: '1/4', right: 'quarter' },
        ],
      },
      {
        type: 'essay',
        id: 'q4',
        prompt: 'Explain',
        points: 5,
        instructions: null,
        rubric: 'Clear\nCorrect',
      },
    ]);
    expect(world.assignments.all().find((a) => a.id === 'asg_1')).toMatchObject({
      instructions: 'Page 4',
      points: 20,
      dueDate: '2026-09-05',
    });
    expect(line(report, 'assignments')?.notes).toEqual({
      shared_link_retired: 1,
      attachment_not_copied: 1,
      placed_in_other_category: 1,
    });
    expect(line(report, 'ai_assignments')?.notes).toEqual({ question_dropped: 1 });
  });

  it('merges gradebook grades and AI submissions into one grade per student and assignment', async () => {
    const { world, run } = importer();
    const report = await run(true);

    const grades = world.grades
      .all()
      .map((g) => [
        g.assignmentId,
        g.studentId,
        g.status,
        g.score,
        g.source,
        g.gradedBy,
        g.comment,
      ]);
    expect(grades).toEqual([
      ['asg_1', 'student_jose', 'graded', 18, 'manual', 'user_ana', null],
      ['asg_1', 'student_luz', 'missing', null, 'manual', 'user_ana', null],
      ['asg_game', 'student_jose', 'graded', 9, 'game', 'user_ana', null],
      ['aiassign_1', 'student_luz', 'graded', 11, 'manual', 'user_ana', null],
      ['aiassign_1', 'student_jose', 'graded', 15, 'confirmed_ai', 'user_ana', 'Nice work'],
    ]);
    expect(line(report, 'grades')).toMatchObject({
      skipped: { student_not_found: 1 },
      notes: { score_dropped_for_status: 1 },
    });
    const submissions = world.submissions.all();
    expect(submissions.map((s) => [s.id, s.studentId, s.status, s.finalScore, s.late])).toEqual([
      ['sub_a', 'student_jose', 'confirmed', 15, false],
      ['sub_b', 'student_luz', 'ai_graded', null, true],
    ]);
    expect(submissions[1]?.aiDraft).toEqual({ score: 12, feedback: 'Check q4' });
    expect(line(report, 'ai_submissions')).toMatchObject({
      imported: 2,
      skipped: { student_name_not_matched: 1 },
      notes: { matched_by_name: 2 },
    });
  });

  it('keeps live family and student links working by storing only their hashes', async () => {
    const { world, run } = importer();
    const report = await run(true);

    const portal = await world.portalLinks.findByTokenHash(
      await world.tokenHasher.hash('portal_live'),
    );
    expect(portal).toMatchObject({
      studentId: 'student_jose',
      classId: 'class_math',
      sentTo: 'mom@home.com',
      expiresAt: new Date('2026-09-30T00:00:00Z'),
    });
    expect(
      await world.portalLinks.findByTokenHash(await world.tokenHasher.hash('hsp_live')),
    ).not.toBeNull();
    expect(
      await world.studentLinks.findByTokenHash(await world.tokenHasher.hash('slt_live')),
    ).toMatchObject({ studentId: 'student_jose', classId: 'class_math' });
    expect(JSON.stringify(world.portalLinks.all())).not.toContain('portal_live');
    expect(line(report, 'portal_tokens')?.skipped).toEqual({ expired: 1 });
  });

  it('imports notes, insights in bullet form, substitute packets, trial reminders and leads', async () => {
    const { world, run } = importer();
    const report = await run(true);

    expect(
      await world.studentNotes.listFor(
        'school_ana' as SchoolId,
        'student_jose' as StudentId,
        'user_ana' as UserId,
      ),
    ).toMatchObject([{ id: 'snote_1', text: 'Loves maps' }]);
    expect(
      await world.studentInsights.find(
        'school_ana' as SchoolId,
        'student_jose' as StudentId,
        'user_ana' as UserId,
      ),
    ).toMatchObject({
      bullets: ['Improving in fractions', 'Missed one day', 'Try challenge work'],
    });
    expect(line(report, 'student_insights')?.skipped).toEqual({ not_in_bullets: 1 });
    expect(
      await world.subPackets.findByClass('school_ana' as SchoolId, 'class_math' as ClassId),
    ).toMatchObject({ mainOfficeExt: '101', dailyRoutines: 'Warm-up first' });
    expect(await world.trialReminders.sentKinds('sub_1' as SubscriptionId)).toEqual(['three_days']);
    expect(await world.leads.search({ limit: 5 })).toMatchObject([
      { id: 'lead_1', email: 'dana@district.org' as Email, score: 'high', status: 'contacted' },
    ]);
  });
});
