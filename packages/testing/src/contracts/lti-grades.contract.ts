import { describe, expect, it } from 'vitest';
import type {
  AssignmentId,
  GameId,
  LtiPlacement,
  LtiPlatform,
  LtiPlatformId,
  LtiScore,
  SchoolId,
  UserId,
} from '@thp/domain';
import type {
  LtiGradesClient,
  LtiGradesError,
  LtiPlacementRepository,
  LtiPlatformRepository,
} from '@thp/ports';
import { anLtiPlatform } from '../fixtures.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;
const teacher = 'teacher-1' as UserId;
const colleague = 'teacher-2' as UserId;

export interface LtiPlacementRepositories {
  readonly platforms: LtiPlatformRepository;
  readonly placements: LtiPlacementRepository;
}

const quiz = { kind: 'assignment', id: 'quiz' as AssignmentId } as const;
const sameIdGame = { kind: 'game', id: 'quiz' as GameId } as const;

const placement = (overrides: Partial<LtiPlacement> = {}): LtiPlacement => ({
  platformId: 'lti-platform-1' as LtiPlatformId,
  contextId: 'course-1',
  item: quiz,
  schoolId: schoolA,
  teacherId: teacher,
  placedAt: new Date('2026-11-12T12:00:00Z'),
  ...overrides,
});

/** Needs schools `school-a` and `school-b`, and users `teacher-1` and `teacher-2` in school A. */
export function ltiPlacementRepositoryContract(
  name: string,
  make: () => LtiPlacementRepositories,
): void {
  async function withPlatform(): Promise<LtiPlacementRepositories & { platform: LtiPlatform }> {
    const repos = make();
    const platform = anLtiPlatform({ schoolId: schoolA });
    await repos.platforms.save(platform);
    return { ...repos, platform };
  }

  describe(`${name} (LtiPlacementRepository contract)`, () => {
    it('remembers where an item is placed, once per course, oldest first', async () => {
      const { placements } = await withPlatform();
      const first = placement();
      await placements.save(first);
      await placements.save(placement({ placedAt: new Date('2026-11-13T12:00:00Z') }));
      const other = placement({
        contextId: 'course-2',
        teacherId: colleague,
        placedAt: new Date('2026-11-14T12:00:00Z'),
      });
      await placements.save(other);

      const listed = await placements.listForItem(schoolA, quiz);
      expect(listed.map((row) => row.contextId)).toEqual(['course-1', 'course-2']);
      expect(listed[1]).toEqual(other);
      expect(await placements.find(schoolA, first.platformId, 'course-1', quiz)).toMatchObject({
        contextId: 'course-1',
        item: quiz,
        teacherId: teacher,
      });
      expect(await placements.find(schoolA, first.platformId, 'course-9', quiz)).toBeNull();
    });

    it('tells an assignment from a game with the same id', async () => {
      const { placements, platform } = await withPlatform();
      await placements.save(placement());

      expect(await placements.listForItem(schoolA, sameIdGame)).toEqual([]);
      expect(await placements.find(schoolA, platform.id, 'course-1', sameIdGame)).toBeNull();
    });

    it('never shows another school’s placements', async () => {
      const { placements, platform } = await withPlatform();
      await placements.save(placement());

      expect(await placements.listForItem(schoolB, quiz)).toEqual([]);
      expect(await placements.find(schoolB, platform.id, 'course-1', quiz)).toBeNull();
    });

    it('forgets the placements of a removed course system', async () => {
      const { platforms, placements, platform } = await withPlatform();
      await placements.save(placement());

      await platforms.delete(schoolA, platform.id);

      expect(await placements.listForItem(schoolA, quiz)).toEqual([]);
    });
  });
}

/** How the course's gradebook behaves for the client under test. */
export interface GradebookSetup {
  /** The course system refuses (or cannot take) every request. */
  readonly refusal?: LtiGradesError;
}

/** What the gradebook holds after a send: its columns and the latest score of each user. */
export interface GradebookState {
  readonly lineItems: readonly { readonly resourceId: string; readonly scoreMaximum: number }[];
  readonly scores: readonly LtiScore[];
}

const score = (userId: string, scoreGiven: number, timestamp: string): LtiScore => ({
  userId,
  scoreGiven,
  scoreMaximum: 10,
  activityProgress: 'Completed',
  gradingProgress: 'FullyGraded',
  timestamp,
});

const lineItem = {
  scoreMaximum: 10,
  label: 'Space quiz',
  resourceId: 'quiz',
  tag: 'teacherhubpro',
};

const byUser = (scores: readonly LtiScore[]) =>
  [...scores].sort((a, b) => a.userId.localeCompare(b.userId));

export function ltiGradesClientContract(
  name: string,
  make: (setup: GradebookSetup) => {
    readonly client: LtiGradesClient;
    readonly platform: LtiPlatform;
    readonly lineItemsUrl: string;
    readonly gradebook: () => Promise<GradebookState>;
  },
): void {
  const noon = '2026-11-14T12:00:00.000Z';

  describe(`${name} (LtiGradesClient contract)`, () => {
    it('makes the assignment’s column once and puts each score in it', async () => {
      const { client, platform, lineItemsUrl, gradebook } = make({});

      const sent = await client.sendScores(platform, {
        lineItemsUrl,
        lineItem,
        scores: [score('lms-1', 9, noon), score('lms-2', 7, noon)],
      });

      expect(sent).toEqual({ ok: true, value: { sent: 2, failed: 0 } });
      const state = await gradebook();
      expect(state.lineItems).toEqual([{ resourceId: 'quiz', scoreMaximum: 10 }]);
      expect(byUser(state.scores)).toEqual([score('lms-1', 9, noon), score('lms-2', 7, noon)]);
    });

    it('updates scores in the same column when sent again', async () => {
      const { client, platform, lineItemsUrl, gradebook } = make({});
      await client.sendScores(platform, {
        lineItemsUrl,
        lineItem,
        scores: [score('lms-1', 5, noon)],
      });

      const later = '2026-11-14T13:00:00.000Z';
      const again = await client.sendScores(platform, {
        lineItemsUrl,
        lineItem,
        scores: [score('lms-1', 8, later)],
      });

      expect(again).toEqual({ ok: true, value: { sent: 1, failed: 0 } });
      const state = await gradebook();
      expect(state.lineItems).toHaveLength(1);
      expect(state.scores).toEqual([score('lms-1', 8, later)]);
    });

    it('sends nothing when there is nothing to send', async () => {
      const { client, platform, lineItemsUrl, gradebook } = make({});

      expect(await client.sendScores(platform, { lineItemsUrl, lineItem, scores: [] })).toEqual({
        ok: true,
        value: { sent: 0, failed: 0 },
      });
      expect((await gradebook()).scores).toEqual([]);
    });

    it.each(['not_allowed', 'unavailable'] as const)(
      'reports a course system that answers %s',
      async (refusal) => {
        const { client, platform, lineItemsUrl } = make({ refusal });

        expect(
          await client.sendScores(platform, {
            lineItemsUrl,
            lineItem,
            scores: [score('lms-1', 9, noon)],
          }),
        ).toEqual({ ok: false, error: refusal });
      },
    );
  });
}
