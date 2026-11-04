import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  AttendanceSessionId,
  ClassId,
  GradeCategoryId,
  ReportCardCommentId,
  SemesterId,
  SubscriptionId,
  UserId,
} from '@thp/domain';
import {
  aClass,
  aGamePlay,
  aLivePlayer,
  aLiveSession,
  aGrade,
  aGradeCategory,
  anAttendanceSession,
  aReportCardComment,
  aSemester,
  aSubmission,
  aSubscription,
  aUser,
} from '@thp/testing';
import { attendanceMapper } from '../../src/postgres/mappers/attendance-mapper.ts';
import { gameMapper, gamePlayMapper } from '../../src/postgres/mappers/game-mappers.ts';
import { livePlayerMapper, liveSessionMapper } from '../../src/postgres/mappers/live-mappers.ts';
import {
  gradeCategoryMapper,
  gradeMapper,
  reportCardCommentMapper,
  submissionMapper,
} from '../../src/postgres/mappers/gradebook-mappers.ts';
import {
  classMapper,
  semesterMapper,
  subscriptionMapper,
  userMapper,
} from '../../src/postgres/mappers/school-mappers.ts';
import { connect, parentsFor, resetWith, schoolA } from './test-db.ts';

/**
 * The schema repeats the domain's rules, so a bug that skips the domain still cannot store an
 * invalid row. Each test writes a bad row directly and expects Postgres to refuse it.
 */
const db = connect();
afterAll(() => db.destroy());
beforeEach(() => resetWith(db, parentsFor.grading));

const grade = (overrides: Partial<ReturnType<typeof gradeMapper.toRow>> = {}) => ({
  ...gradeMapper.toRow(aGrade({ schoolId: schoolA })),
  ...overrides,
});

describe('grades', () => {
  it('allow only one grade per student and assignment', async () => {
    await db.insertInto('grades').values(grade()).execute();

    await expect(
      db
        .insertInto('grades')
        .values(grade({ id: 'grade-2' }))
        .execute(),
    ).rejects.toThrow(/grades_student_assignment_key/);
  });

  it('need a score when graded or late, and none when missing, excused or pending', async () => {
    await expect(
      db
        .insertInto('grades')
        .values(grade({ score: null }))
        .execute(),
    ).rejects.toThrow(/grades_score_matches_status/);
    await expect(
      db
        .insertInto('grades')
        .values(grade({ status: 'excused', score: 5 }))
        .execute(),
    ).rejects.toThrow(/grades_score_matches_status/);
  });

  it('reject a negative score, an unknown status and an unknown source', async () => {
    await expect(
      db
        .insertInto('grades')
        .values(grade({ score: -1 }))
        .execute(),
    ).rejects.toThrow(/grades_score_check/);
    await expect(
      db
        .insertInto('grades')
        .values(grade({ status: 'done', score: null }))
        .execute(),
    ).rejects.toThrow(/grades_status_check/);
    await expect(
      db
        .insertInto('grades')
        .values(grade({ source: 'ai' }))
        .execute(),
    ).rejects.toThrow(/grades_source_check/);
  });

  it('accept a grade confirmed from a game', async () => {
    await db
      .insertInto('grades')
      .values(grade({ source: 'game' }))
      .execute();
  });
});

describe('games and game plays', () => {
  beforeEach(() => resetWith(db, parentsFor.games));

  const play = (overrides: Partial<ReturnType<typeof gamePlayMapper.toRow>> = {}) => ({
    ...gamePlayMapper.toRow(aGamePlay({ schoolId: schoolA })),
    ...overrides,
  });

  it('a play needs a positive total, a score within it and a time of zero or more', async () => {
    for (const bad of [{ total: 0, score: 0 }, { score: 5 }, { score: -1 }]) {
      await expect(db.insertInto('game_plays').values(play(bad)).execute()).rejects.toThrow(
        /game_plays_score_check/,
      );
    }
    await expect(
      db
        .insertInto('game_plays')
        .values(play({ duration_ms: -1 }))
        .execute(),
    ).rejects.toThrow(/game_plays_duration_check/);
  });

  it("a game's plays go with it", async () => {
    await db.insertInto('game_plays').values(play()).execute();
    await db.deleteFrom('games').where('id', '=', 'game-1').execute();
    expect(await db.selectFrom('game_plays').selectAll().execute()).toEqual([]);
  });

  it('a game grades by best, first or average, for 1 to 1000 points', async () => {
    const game = (overrides: Partial<ReturnType<typeof gameMapper.toRow>>) =>
      db.updateTable('games').set(overrides).where('id', '=', 'game-1').execute();
    await expect(game({ grade_method: 'last' })).rejects.toThrow(/games_grade_method_check/);
    await expect(game({ grade_points: 0 })).rejects.toThrow(/games_grade_points_check/);
  });
});

describe('submissions', () => {
  const submission = (overrides: Partial<ReturnType<typeof submissionMapper.toRow>>) => ({
    ...submissionMapper.toRow(aSubmission({ schoolId: schoolA })),
    ...overrides,
  });

  it('a confirmed submission needs a final score and the confirming teacher', async () => {
    await expect(
      db
        .insertInto('submissions')
        .values(submission({ status: 'confirmed', confirmed_by: 'teacher-1' }))
        .execute(),
    ).rejects.toThrow(/submissions_confirmed_has_decision/);
  });

  it('an AI-graded submission needs its draft', async () => {
    await expect(
      db
        .insertInto('submissions')
        .values(submission({ status: 'ai_graded' }))
        .execute(),
    ).rejects.toThrow(/submissions_ai_graded_has_draft/);
  });
});

describe('classes', () => {
  /** A class with an (empty) schedule, so period and time columns may be set. */
  const cls = () =>
    classMapper.toRow(aClass({ id: 'class-x' as ClassId, schoolId: schoolA, schedule: {} }));

  it('reject a period outside 1–12', async () => {
    await expect(
      db
        .insertInto('classes')
        .values({ ...cls(), period: 13 })
        .execute(),
    ).rejects.toThrow(/classes_period_check/);
  });

  it('need both times or neither, with the start before the end', async () => {
    await expect(
      db
        .insertInto('classes')
        .values({ ...cls(), start_time: '08:00' })
        .execute(),
    ).rejects.toThrow(/classes_times_check/);
    await expect(
      db
        .insertInto('classes')
        .values({ ...cls(), start_time: '09:00', end_time: '08:00' })
        .execute(),
    ).rejects.toThrow(/classes_times_check/);
  });

  it('must belong to an existing school', async () => {
    await expect(
      db
        .insertInto('classes')
        .values({ ...cls(), school_id: 'nowhere' })
        .execute(),
    ).rejects.toThrow(/foreign key/);
  });
});

describe('school-level rules', () => {
  it('allow at most one active semester per school', async () => {
    const semester = (id: string) =>
      semesterMapper.toRow(aSemester({ id: id as SemesterId, schoolId: schoolA, isActive: true }));
    await db.insertInto('semesters').values(semester('s1')).execute();

    await expect(db.insertInto('semesters').values(semester('s2')).execute()).rejects.toThrow(
      /semesters_one_active_per_school/,
    );
  });

  it('reject a semester that ends before it starts', async () => {
    const row = semesterMapper.toRow(aSemester({ schoolId: schoolA }));
    await expect(
      db
        .insertInto('semesters')
        .values({ ...row, end_date: '2026-01-01' })
        .execute(),
    ).rejects.toThrow(/semesters_dates_check/);
  });

  it('keep user emails unique', async () => {
    await expect(
      db
        .insertInto('users')
        .values(userMapper.toRow(aUser({ id: 'teacher-2' as UserId, schoolId: schoolA })))
        .execute(),
    ).rejects.toThrow(/users_email_key/);
  });

  it('reject a category weight above 100', async () => {
    const row = gradeCategoryMapper.toRow(
      aGradeCategory({ id: 'c2' as GradeCategoryId, schoolId: schoolA }),
    );
    await expect(
      db
        .insertInto('grade_categories')
        .values({ ...row, weight_percent: 101 })
        .execute(),
    ).rejects.toThrow(/grade_categories_weight_percent_check/);
  });

  it('allow one attendance session per class and date', async () => {
    const save = async (id: string) => {
      const { session } = attendanceMapper.toRows(
        anAttendanceSession({ id: id as AttendanceSessionId, schoolId: schoolA }),
      );
      await db.insertInto('attendance_sessions').values(session).execute();
    };
    await save('att-1');

    await expect(save('att-2')).rejects.toThrow(/attendance_sessions_class_date_key/);
  });

  it('reject a subscription with no seats or a repeated provider id', async () => {
    const subscription = (id: string) => ({
      ...subscriptionMapper.toRow(aSubscription({ id: id as SubscriptionId, schoolId: schoolA })),
      external_id: 'ext-1',
    });
    await expect(
      db
        .insertInto('subscriptions')
        .values({ ...subscription('s0'), quantity: 0 })
        .execute(),
    ).rejects.toThrow(/subscriptions_quantity_check/);

    await db.insertInto('subscriptions').values(subscription('s1')).execute();
    await expect(
      db.insertInto('subscriptions').values(subscription('s2')).execute(),
    ).rejects.toThrow(/subscriptions_external_id_key/);
  });
});

describe('gradebook', () => {
  it("removes an assignment's grades with it", async () => {
    await db.insertInto('grades').values(grade()).execute();
    await db.deleteFrom('assignments').where('id', '=', 'assignment-1').execute();

    expect(await db.selectFrom('grades').selectAll().execute()).toEqual([]);
  });

  it('allow one report card comment per class and student, of at most 1000 characters', async () => {
    const comment = (id: string, text = 'Good work') => ({
      ...reportCardCommentMapper.toRow(
        aReportCardComment({ id: id as ReportCardCommentId, schoolId: schoolA }),
      ),
      text,
    });
    await expect(
      db
        .insertInto('report_card_comments')
        .values(comment('c0', 'x'.repeat(1001)))
        .execute(),
    ).rejects.toThrow(/report_card_comments_text_check/);

    await db.insertInto('report_card_comments').values(comment('c1')).execute();
    await expect(
      db.insertInto('report_card_comments').values(comment('c2')).execute(),
    ).rejects.toThrow(/report_card_comments_class_student_key/);
  });
});

describe('live sessions', () => {
  beforeEach(() => resetWith(db, parentsFor.games));

  const session = (overrides: Partial<ReturnType<typeof liveSessionMapper.toRow>> = {}) => ({
    ...liveSessionMapper.toRow(aLiveSession({ schoolId: schoolA })),
    ...overrides,
  });

  it('need a 6-digit PIN, a known status and 5 to 120 seconds per question', async () => {
    await expect(
      db
        .insertInto('live_sessions')
        .values(session({ pin: '12ab56' }))
        .execute(),
    ).rejects.toThrow(/live_sessions_pin_check/);
    await expect(
      db
        .insertInto('live_sessions')
        .values(session({ status: 'paused' }))
        .execute(),
    ).rejects.toThrow(/live_sessions_status_check/);
    await expect(
      db
        .insertInto('live_sessions')
        .values(session({ question_seconds: 200 }))
        .execute(),
    ).rejects.toThrow(/live_sessions_seconds_check/);
  });

  it('allow a PIN on one open session at a time; ended sessions free it', async () => {
    await db.insertInto('live_sessions').values(session()).execute();
    await expect(
      db
        .insertInto('live_sessions')
        .values(session({ id: 'live-2' }))
        .execute(),
    ).rejects.toThrow(/live_sessions_open_pin_key/);
    await db
      .insertInto('live_sessions')
      .values(session({ id: 'live-3', status: 'ended', ended_at: new Date() }))
      .execute();
  });

  it('let a student play once per session, until removed', async () => {
    await db.insertInto('live_sessions').values(session()).execute();
    const player = (overrides: Partial<ReturnType<typeof livePlayerMapper.toRow>> = {}) => ({
      ...livePlayerMapper.toRow(aLivePlayer({ schoolId: schoolA })),
      ...overrides,
    });
    await db.insertInto('live_players').values(player()).execute();
    await expect(
      db
        .insertInto('live_players')
        .values(player({ id: 'player-2' }))
        .execute(),
    ).rejects.toThrow(/live_players_active_student_key/);
    await db
      .updateTable('live_players')
      .set({ removed_at: new Date() })
      .where('id', '=', 'player-1')
      .execute();
    await db
      .insertInto('live_players')
      .values(player({ id: 'player-3' }))
      .execute();
  });
});
