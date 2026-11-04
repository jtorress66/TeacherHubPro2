import { describe, expect, it } from 'vitest';
import type { GameId, LivePlayerId, LiveSessionId, SchoolId, StudentId, UserId } from '@thp/domain';
import type {
  LiveAnswerRepository,
  LivePlayerRepository,
  LiveSessionRepository,
  TicketSigner,
} from '@thp/ports';
import { aLiveAnswer, aLivePlayer, aLiveSession } from '../fixtures.ts';
import { deletableContract, scopedRepositoryContract } from './scoped-repository.contract.ts';

const schoolA = 'school-a' as SchoolId;
const schoolB = 'school-b' as SchoolId;

/** A distinct 6-digit PIN for each sample id. */
const pinFor = (id: string): string =>
  String(
    100_000 + (Array.from(id).reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7) % 900_000),
  );

export interface LiveRepositories {
  readonly sessions: LiveSessionRepository;
  readonly players: LivePlayerRepository;
  readonly answers: LiveAnswerRepository;
}

/**
 * Shared suites for live sessions, their players and answers. Fixtures use game-1, class-1,
 * teacher-1 and student-1 in school-a; sessions live-1 and live-2 for players and answers, so
 * Postgres tests seed those parents.
 */
export function liveRepositoryContract(name: string, make: () => LiveRepositories): void {
  const sessions = {
    make: () => make().sessions,
    sample: (schoolId: SchoolId, id: string) =>
      aLiveSession({ schoolId, id: id as LiveSessionId, pin: pinFor(id) }),
  };
  scopedRepositoryContract(`${name} live sessions`, {
    ...sessions,
    change: (session) => ({
      ...session,
      status: 'ended' as const,
      endedAt: new Date('2026-11-04T11:00:00Z'),
    }),
    lists: [
      {
        name: 'listByTeacher',
        call: (repo, schoolId, session) => repo.listByTeacher(schoolId, session.teacherId),
      },
      {
        name: 'listByGame',
        call: (repo, schoolId, session) => repo.listByGame(schoolId, session.gameId),
      },
    ],
  });
  deletableContract(`${name} live sessions`, sessions);

  describe(`${name} (LiveSessionRepository)`, () => {
    it('finds an open session by its PIN, and never an ended one', async () => {
      const repo = make().sessions;
      const open = aLiveSession({ schoolId: schoolA, pin: '111111' });
      await repo.save(open);
      expect(await repo.findOpenByPin('111111')).toEqual(open);
      expect(await repo.findOpenByPin('222222')).toBeNull();

      await repo.save({ ...open, status: 'ended', endedAt: new Date('2026-11-04T11:00:00Z') });
      expect(await repo.findOpenByPin('111111')).toBeNull();
    });

    it('lists newest first, only for the teacher and the game', async () => {
      const repo = make().sessions;
      const older = aLiveSession({
        schoolId: schoolA,
        id: 'live-1' as LiveSessionId,
        pin: '111111',
      });
      const newer = aLiveSession({
        schoolId: schoolA,
        id: 'live-2' as LiveSessionId,
        pin: '222222',
        createdAt: new Date('2026-11-04T12:00:00Z'),
      });
      await repo.save(older);
      await repo.save(newer);
      expect((await repo.listByTeacher(schoolA, older.teacherId)).map((s) => s.id)).toEqual([
        'live-2',
        'live-1',
      ]);
      expect(await repo.listByTeacher(schoolA, 'teacher-9' as UserId)).toEqual([]);
      expect(await repo.listByGame(schoolA, 'game-9' as GameId)).toEqual([]);
    });
  });

  describe(`${name} (LivePlayerRepository)`, () => {
    it('saves players and lists a session’s, joined first first, within the school', async () => {
      const { sessions: sessionRepo, players } = make();
      await sessionRepo.save(aLiveSession({ schoolId: schoolA }));
      const ana = aLivePlayer({ schoolId: schoolA });
      const ben = aLivePlayer({
        schoolId: schoolA,
        id: 'player-2' as LivePlayerId,
        studentId: 'student-one' as StudentId,
        firstName: 'Ben',
        joinedAt: new Date('2026-11-04T10:00:30Z'),
      });
      await players.save(ana);
      await players.save(ben);
      await players.save({ ...ana, removedAt: new Date('2026-11-04T10:05:00Z') });

      expect(await players.findById(schoolA, ana.id)).toMatchObject({
        removedAt: expect.any(Date) as Date,
      });
      expect(
        (await players.listBySessions(schoolA, [ana.sessionId])).map((p) => p.firstName),
      ).toEqual(['Ben', 'Ana']);
      expect(await players.listBySessions(schoolB, [ana.sessionId])).toEqual([]);
      expect(await players.findById(schoolB, ana.id)).toBeNull();

      await players.deleteBySession(schoolB, ana.sessionId);
      expect(await players.listBySessions(schoolA, [ana.sessionId])).toHaveLength(2);
      await players.deleteBySession(schoolA, ana.sessionId);
      expect(await players.listBySessions(schoolA, [ana.sessionId])).toEqual([]);
    });
  });

  describe(`${name} (LivePlayerRepository: one seat per student)`, () => {
    it('lets a student play once per session, and again only after being removed', async () => {
      const { sessions: sessionRepo, players } = make();
      await sessionRepo.save(aLiveSession({ schoolId: schoolA }));
      const ana = aLivePlayer({ schoolId: schoolA });
      await players.save(ana);
      await expect(
        players.save(aLivePlayer({ schoolId: schoolA, id: 'player-2' as LivePlayerId })),
      ).rejects.toThrow();
      await players.save({ ...ana, removedAt: new Date('2026-11-04T10:05:00Z') });
      await players.save(aLivePlayer({ schoolId: schoolA, id: 'player-3' as LivePlayerId }));
      expect(await players.listBySessions(schoolA, [ana.sessionId])).toHaveLength(2);
    });
  });

  describe(`${name} (LiveAnswerRepository)`, () => {
    it('keeps one answer per player and question, listed by session within the school', async () => {
      const { sessions: sessionRepo, players, answers } = make();
      await sessionRepo.save(aLiveSession({ schoolId: schoolA }));
      await players.save(aLivePlayer({ schoolId: schoolA }));
      const first = aLiveAnswer({ schoolId: schoolA });
      const second = aLiveAnswer({ schoolId: schoolA, question: 1, correct: false, points: 0 });
      await answers.save(second);
      await answers.save(first);
      await expect(answers.save({ ...first, choice: 2 })).rejects.toThrow();

      expect(await answers.listBySessions(schoolA, [first.sessionId])).toEqual([first, second]);
      expect(await answers.listBySessions(schoolB, [first.sessionId])).toEqual([]);
      expect(await answers.listBySessions(schoolA, ['live-9' as LiveSessionId])).toEqual([]);

      await answers.deleteBySession(schoolA, first.sessionId);
      expect(await answers.listBySessions(schoolA, [first.sessionId])).toEqual([]);
    });
  });
}

export function ticketSignerContract(name: string, make: () => TicketSigner): void {
  describe(`${name} (TicketSigner contract)`, () => {
    const now = new Date('2026-11-04T10:00:00Z');
    const later = new Date('2026-11-04T10:10:00Z');
    const payload = { role: 'player', sessionId: 'live-1', playerId: 'player-1' };

    it('verifies its own unexpired tickets', () => {
      const signer = make();
      expect(signer.verify(signer.sign(payload, later), now)).toEqual(payload);
    });

    it('refuses expired, altered and foreign tickets', () => {
      const signer = make();
      const ticket = signer.sign(payload, later);
      expect(signer.verify(ticket, later)).toBeNull();
      expect(signer.verify(`${ticket}x`, now)).toBeNull();
      const [body = '', expiry = '', signature = ''] = ticket.split('.');
      const forged = `${Buffer.from(JSON.stringify({ ...payload, role: 'host' })).toString('base64url')}.${expiry}.${signature}`;
      expect(signer.verify(forged, now)).toBeNull();
      expect(signer.verify(`${body}.${String(later.getTime() + 1)}.${signature}`, now)).toBeNull();
      expect(signer.verify('not-a-ticket', now)).toBeNull();
      expect(signer.verify('', now)).toBeNull();
    });
  });
}
