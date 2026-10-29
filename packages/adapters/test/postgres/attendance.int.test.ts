import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { markAttendance, submitAttendance, type StudentId } from '@thp/domain';
import { anAttendanceSession, unwrap } from '@thp/testing';
import { PostgresAttendanceSessionRepository } from '../../src/postgres/repositories/postgres-attendance-session-repository.ts';
import { connect, parentsFor, resetWith, schoolA } from './test-db.ts';

const db = connect();
const sessions = new PostgresAttendanceSessionRepository(db);
afterAll(() => db.destroy());
beforeEach(() => resetWith(db, parentsFor.roster));

describe('PostgresAttendanceSessionRepository', () => {
  it('keeps the roster order and every mark across a save and reload', async () => {
    const roster = ['student-two', 'student-1', 'student-one'] as StudentId[];
    let session = anAttendanceSession({ schoolId: schoolA, roster });
    session = unwrap(markAttendance(session, 'student-one' as StudentId, 'tardy'));
    session = unwrap(markAttendance(session, 'student-two' as StudentId, 'absent'));
    await sessions.save(session);

    const reloaded = await sessions.findById(schoolA, session.id);
    expect(reloaded?.roster).toEqual(roster);
    expect(reloaded?.records).toEqual([
      { studentId: 'student-two', status: 'absent' },
      { studentId: 'student-one', status: 'tardy' },
    ]);
  });

  it('replaces the marks when a session is saved again', async () => {
    let session = anAttendanceSession({ schoolId: schoolA });
    await sessions.save(session);
    session = unwrap(
      submitAttendance(unwrap(markAttendance(session, 'student-1' as StudentId, 'present'))),
    );
    await sessions.save(session);

    expect(await sessions.findById(schoolA, session.id)).toEqual(session);
  });

  it('saves a session with an empty roster', async () => {
    const session = anAttendanceSession({ schoolId: schoolA, roster: [] });
    await sessions.save(session);

    expect(await sessions.findById(schoolA, session.id)).toEqual(session);
  });
});
