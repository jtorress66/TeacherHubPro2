import { describe, expect, it } from 'vitest';
import {
  maxAttachmentBytes,
  type ClassId,
  type QuestionId,
  type SchoolId,
  type UserId,
} from '@thp/domain';
import {
  aUser,
  FakeMicrosoftAuthorization,
  FakeOneDriveFiles,
  FakeSecretCipher,
  FakeTeams,
  InMemoryMicrosoftConnectionRepository,
} from '@thp/testing';
import {
  CreateClass,
  ExplainMicrosoftRefusal,
  FinishMicrosoftConnect,
  ImportTeamsRoster,
  ListTeamsClasses,
  PostWordToTeams,
  SaveQuestions,
  ShareAssignmentToTeams,
  StartMicrosoftConnect,
  TeamsAllowed,
} from '../src/index.ts';
import { colleagueOf, gradedClass, valueOf } from './classroom.ts';
import { makeWorld, signedUp, type World } from './world.ts';

const redirectUri = 'https://app.test/api/microsoft/callback';
const docx = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const outsider = aUser({ id: 'u-9' as UserId, schoolId: 'school-9' as SchoolId, email: 'o@x.edu' });

function microsoft(world: World) {
  const teams = new FakeTeams({
    teamsClass: { id: 'teams-1', name: 'Science 5A' },
    students: [
      { firstName: 'Ana', lastName: 'Zayas' },
      { firstName: 'Diego', lastName: 'Ruiz' },
      { firstName: 'Diego', lastName: 'Ruiz' },
    ],
  });
  return {
    ...world,
    cipher: new FakeSecretCipher(),
    microsoftAuth: new FakeMicrosoftAuthorization(),
    microsoftConnections: new InMemoryMicrosoftConnectionRepository(),
    oneDriveFiles: new FakeOneDriveFiles(),
    teamsClasses: teams,
    teamsAssignments: teams,
    teams,
    appUrl: 'https://app.test',
  };
}

type Deps = ReturnType<typeof microsoft>;

const connect = (
  deps: Deps,
  actor: Parameters<FinishMicrosoftConnect['execute']>[0]['actor'],
  teams: boolean,
) =>
  new FinishMicrosoftConnect(deps).execute({
    actor,
    code: FakeMicrosoftAuthorization.code,
    codeVerifier: FakeMicrosoftAuthorization.verifier,
    redirectUri,
    teams,
  });

/** A teacher with a graded class (Zayas, Acosta, Morales), a quiz with a question, and Teams. */
async function teacher(world: World, { teams = true } = {}) {
  const setup = await gradedClass(world);
  const deps = microsoft(world);
  valueOf(await connect(deps, setup.actor, teams));
  const assignment = await setup.assign('Space quiz', 'Pruebas cortas', 100, '2026-09-30');
  const base = { actor: setup.actor, classId: setup.cls.id, assignmentId: assignment.id };
  valueOf(
    await new SaveQuestions(world).execute({
      ...base,
      questions: [
        {
          id: 'q1' as QuestionId,
          type: 'short_answer',
          prompt: 'Why day and night?',
          points: 6,
        },
      ],
    }),
  );
  return { ...setup, deps, base };
}

describe('Allowing Microsoft Teams', () => {
  it('asks Microsoft for Teams only when the teacher allows it', () => {
    const start = new StartMicrosoftConnect({ microsoftAuth: new FakeMicrosoftAuthorization() });
    const url = (teams?: boolean) =>
      new URL(
        start.execute({
          state: 's',
          codeChallenge: 'c',
          redirectUri,
          ...(teams === undefined ? {} : { teams }),
        }),
      ).searchParams.get('teams');
    expect(url()).toBe('no');
    expect(url(false)).toBe('no');
    expect(url(true)).toBe('yes');
  });

  it('remembers that a school account allowed Teams', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    const deps = microsoft(world);
    expect(await connect(deps, actor, true)).toEqual({ ok: true, value: { teams: true } });
    expect(await new TeamsAllowed(deps).execute({ actor })).toBe(true);
    expect(await new TeamsAllowed(deps).execute({ actor: { ...outsider, id: actor.id } })).toBe(
      false,
    );
  });

  it('keeps OneDrive but says Teams needs a school account when a personal account connects', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    const deps = microsoft(world);
    deps.microsoftAuth.schoolAccount = false;
    expect(await connect(deps, actor, true)).toEqual({
      ok: false,
      error: { code: 'teams_school_account' },
    });
    expect(await deps.microsoftConnections.find(actor.schoolId, actor.id)).toMatchObject({
      teams: false,
    });
    expect(await new TeamsAllowed(deps).execute({ actor })).toBe(false);
  });

  it('connecting for OneDrive alone does not allow Teams', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    const deps = microsoft(world);
    expect(await connect(deps, actor, false)).toEqual({ ok: true, value: { teams: false } });
    expect(await new TeamsAllowed(deps).execute({ actor })).toBe(false);
  });

  it("names the fix when Microsoft refuses: the school's administrator, a school account, or try again", () => {
    const auth = new FakeMicrosoftAuthorization();
    const explain = new ExplainMicrosoftRefusal({ microsoftAuth: auth });
    const refusal = { error: 'access_denied', description: 'AADSTS90094' };
    const cases = [
      ['admin_approval_required', true, 'teams_admin_approval'],
      ['admin_approval_required', false, 'microsoft_admin_approval'],
      ['school_account_required', true, 'teams_school_account'],
      ['school_account_required', false, 'microsoft_failed'],
      ['declined', true, 'teams_declined'],
      ['declined', false, 'microsoft_failed'],
      ['unavailable', true, 'microsoft_failed'],
    ] as const;
    for (const [reason, teams, code] of cases) {
      auth.refusalCode = reason;
      expect(explain.execute({ ...refusal, teams })).toEqual({ code });
    }
    expect(auth.refusals.at(-1)).toEqual(refusal);
  });
});

describe('Listing Teams classes', () => {
  it("lists the teacher's Teams classes", async () => {
    const { actor, deps } = await teacher(makeWorld());
    expect(valueOf(await new ListTeamsClasses(deps).execute({ actor }))).toEqual([
      { id: 'teams-1', name: 'Science 5A' },
    ]);
  });

  it('asks to allow Teams first, without touching Teams', async () => {
    const { actor, deps } = await teacher(makeWorld(), { teams: false });
    expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'teams_not_allowed' },
    });
    const world = makeWorld();
    const { user: newcomer } = await signedUp(world);
    expect(await new ListTeamsClasses(microsoft(world)).execute({ actor: newcomer })).toEqual({
      ok: false,
      error: { code: 'microsoft_not_connected' },
    });
  });

  it("never uses another school's connection", async () => {
    const { actor, deps } = await teacher(makeWorld());
    expect(
      await new ListTeamsClasses(deps).execute({ actor: { ...outsider, id: actor.id } }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });
  });

  it('forgets Teams, not OneDrive, when the school withdraws it', async () => {
    const { actor, deps } = await teacher(makeWorld());
    deps.microsoftAuth.withdrawTeams();
    expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'teams_not_allowed' },
    });
    expect(await deps.microsoftConnections.find(actor.schoolId, actor.id)).toMatchObject({
      teams: false,
    });
  });

  it('forgets an access Microsoft no longer accepts', async () => {
    const { actor, deps } = await teacher(makeWorld());
    deps.microsoftAuth.removeApp();
    expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'microsoft_not_connected' },
    });
    expect(await deps.microsoftConnections.find(actor.schoolId, actor.id)).toBeNull();
  });

  it('keeps everything when Microsoft or Teams is only busy', async () => {
    const { actor, deps } = await teacher(makeWorld());
    deps.microsoftAuth.failWith = 'throttled';
    expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'microsoft_failed' },
    });
    for (const [reason, code] of [
      ['throttled', 'teams_failed'],
      ['unavailable', 'teams_failed'],
      ['unauthorized', 'microsoft_not_connected'],
      ['not_found', 'not_found'],
    ] as const) {
      deps.teams.failWith = reason;
      expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
        ok: false,
        error: { code },
      });
    }
    expect(await new TeamsAllowed(deps).execute({ actor })).toBe(true);
  });

  it('offers to allow Teams again when Teams refuses the permission', async () => {
    const { actor, deps } = await teacher(makeWorld());
    deps.teams.failWith = 'insufficient_scope';
    expect(await new ListTeamsClasses(deps).execute({ actor })).toEqual({
      ok: false,
      error: { code: 'teams_not_allowed' },
    });
    expect(await new TeamsAllowed(deps).execute({ actor })).toBe(false);
    expect(await deps.microsoftConnections.find(actor.schoolId, actor.id)).not.toBeNull();
  });
});

describe('Importing a roster from Teams', () => {
  it('adds the students by first and last name, skipping names already in the class', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacher(world);
    expect(
      valueOf(
        await new ImportTeamsRoster(deps).execute({
          actor,
          classId: cls.id,
          teamsClassId: 'teams-1',
        }),
      ),
    ).toEqual({ added: 1, skipped: 2 });
    const roster = await world.students.listByClass(actor.schoolId, cls.id);
    const diego = roster.find((student) => student.firstName === 'Diego');
    expect(diego).toMatchObject({
      lastName: 'Ruiz',
      studentNumber: null,
      parentEmail: null,
      classId: cls.id,
    });
  });

  it('never imports into a class of another school or another teacher', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacher(world);
    for (const [intruder, code] of [
      [outsider, 'not_found'],
      [colleagueOf(actor), 'forbidden'],
    ] as const) {
      expect(
        await new ImportTeamsRoster(deps).execute({
          actor: intruder,
          classId: cls.id,
          teamsClassId: 'teams-1',
        }),
      ).toEqual({ ok: false, error: { code } });
    }
    expect(
      await new ImportTeamsRoster(deps).execute({
        actor,
        classId: 'missing' as ClassId,
        teamsClassId: 'teams-1',
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(await world.students.listByClass(actor.schoolId, cls.id)).toHaveLength(3);
  });

  it('needs Teams allowed, and a Teams class of the teacher', async () => {
    const world = makeWorld();
    const { actor, cls, deps } = await teacher(world, { teams: false });
    expect(
      await new ImportTeamsRoster(deps).execute({
        actor,
        classId: cls.id,
        teamsClassId: 'teams-1',
      }),
    ).toEqual({ ok: false, error: { code: 'teams_not_allowed' } });
    const allowed = await teacher(makeWorld());
    expect(
      await new ImportTeamsRoster(allowed.deps).execute({
        actor: allowed.actor,
        classId: allowed.cls.id,
        teamsClassId: 'other',
      }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
  });

  it('adds every new name to an empty class, once', async () => {
    const world = makeWorld();
    const { user: actor } = await signedUp(world);
    const deps = microsoft(world);
    valueOf(await connect(deps, actor, true));
    const cls = valueOf(await new CreateClass(world).execute({ actor, details: { name: 'Art' } }));
    expect(
      valueOf(
        await new ImportTeamsRoster(deps).execute({
          actor,
          classId: cls.id,
          teamsClassId: 'teams-1',
        }),
      ),
    ).toEqual({ added: 2, skipped: 1 });
  });
});

describe('Sharing an assignment to Teams', () => {
  it('posts a link to the app with the title, instructions and due date at the end of the day', async () => {
    const { deps, base } = await teacher(makeWorld());
    const shared = valueOf(
      await new ShareAssignmentToTeams(deps).execute({
        ...base,
        teamsClassId: 'teams-1',
        timeZone: 'America/Puerto_Rico',
      }),
    );
    expect(shared.url).toContain('teams.test');
    expect(deps.teams.assignments.at(-1)).toEqual({
      classId: 'teams-1',
      request: {
        title: 'Space quiz',
        instructions: '',
        resource: { kind: 'link', name: 'TeacherHubPro', url: 'https://app.test' },
        dueAt: new Date('2026-10-01T03:59:00Z'),
        assignAt: null,
      },
    });
  });

  it('shares only an assignment with questions or files, with no due date when it has none', async () => {
    const world = makeWorld();
    const { deps, base, assign } = await teacher(world);
    const undated = await assign('Undated', 'Pruebas cortas', 10);
    const share = (assignmentId: typeof undated.id) =>
      new ShareAssignmentToTeams(deps).execute({
        ...base,
        assignmentId,
        teamsClassId: 'teams-1',
        timeZone: 'UTC',
      });
    expect(await share(undated.id)).toEqual({ ok: false, error: { code: 'not_shareable' } });
    expect(deps.teams.assignments).toEqual([]);

    valueOf(
      await new SaveQuestions(world).execute({
        ...base,
        assignmentId: undated.id,
        questions: [{ id: 'q1' as QuestionId, type: 'short_answer', prompt: 'Why?', points: 2 }],
      }),
    );
    valueOf(await share(undated.id));
    expect(deps.teams.assignments.at(-1)?.request.dueAt).toBeNull();
  });

  it("never shares another school's or another teacher's assignment", async () => {
    const { actor, deps, base } = await teacher(makeWorld());
    for (const [intruder, code] of [
      [outsider, 'not_found'],
      [colleagueOf(actor), 'forbidden'],
    ] as const) {
      expect(
        await new ShareAssignmentToTeams(deps).execute({
          ...base,
          actor: intruder,
          teamsClassId: 'teams-1',
          timeZone: 'UTC',
        }),
      ).toEqual({ ok: false, error: { code } });
    }
    expect(deps.teams.assignments).toEqual([]);
  });

  it('needs Teams allowed', async () => {
    const { deps, base } = await teacher(makeWorld(), { teams: false });
    expect(
      await new ShareAssignmentToTeams(deps).execute({
        ...base,
        teamsClassId: 'teams-1',
        timeZone: 'UTC',
      }),
    ).toEqual({ ok: false, error: { code: 'teams_not_allowed' } });
  });
});

describe('Posting a Word document to Teams', () => {
  async function poster(world: World, options: { teams?: boolean } = {}) {
    const { user: actor } = await signedUp(world);
    const deps = microsoft(world);
    valueOf(await connect(deps, actor, options.teams ?? true));
    const post = (changes: Partial<Parameters<PostWordToTeams['execute']>[0]> = {}) =>
      new PostWordToTeams(deps).execute({
        actor,
        teamsClassId: 'teams-1',
        title: 'Unit 3 test',
        instructions: 'Type your answers in the document.',
        dueDate: '2026-12-01',
        fileName: 'unit-3.docx',
        bytes: docx,
        timeZone: 'America/Puerto_Rico',
        ...changes,
      });
    return { actor, deps, post };
  }

  it('posts the document unchanged so each student gets their own copy', async () => {
    const { deps, post } = await poster(makeWorld());
    expect(valueOf(await post())).toEqual({
      url: expect.stringContaining('teams.test') as string,
    });
    expect(deps.teams.assignments.at(-1)).toEqual({
      classId: 'teams-1',
      request: {
        title: 'Unit 3 test',
        instructions: 'Type your answers in the document.',
        resource: { kind: 'wordCopy', fileName: 'unit-3.docx', bytes: docx },
        dueAt: new Date('2026-12-02T03:59:00Z'),
        assignAt: null,
      },
    });
  });

  it('schedules the post for later, with no due date when none is given', async () => {
    const { deps, post } = await poster(makeWorld());
    const later = new Date('2026-09-03T12:00:00Z');
    valueOf(await post({ scheduledAt: later, dueDate: null, instructions: null }));
    expect(deps.teams.assignments.at(-1)?.request).toMatchObject({
      assignAt: later,
      dueAt: null,
      instructions: '',
    });
    expect(await post({ scheduledAt: new Date('2026-09-01T08:01:00Z') })).toEqual({
      ok: false,
      error: { field: 'scheduledAt', code: 'out_of_range' },
    });
  });

  it('checks the class, title, file and due date before calling Microsoft', async () => {
    const { deps, post } = await poster(makeWorld());
    const big = new Uint8Array(maxAttachmentBytes + 1);
    big.set([0x50, 0x4b]);
    for (const [changes, error] of [
      [{ teamsClassId: ' ' }, { field: 'teamsClassId', code: 'required' }],
      [{ title: ' ' }, { field: 'title', code: 'required' }],
      [{ instructions: 'x'.repeat(5001) }, { field: 'instructions', code: 'too_long' }],
      [{ fileName: 'unit-3.pdf' }, { field: 'file', code: 'not_allowed' }],
      [{ bytes: new TextEncoder().encode('%PDF') }, { field: 'file', code: 'invalid_format' }],
      [{ bytes: big }, { field: 'file', code: 'too_large' }],
      [{ dueDate: '12/01/2026' }, { field: 'dueDate', code: 'invalid_format' }],
    ] as const) {
      expect(await post(changes)).toEqual({ ok: false, error });
    }
    expect(deps.teams.assignments).toEqual([]);
  });

  it('needs Microsoft connected with Teams allowed, in the same school', async () => {
    const notAllowed = await poster(makeWorld(), { teams: false });
    expect(await notAllowed.post()).toEqual({ ok: false, error: { code: 'teams_not_allowed' } });
    const { deps } = await poster(makeWorld());
    expect(
      await new PostWordToTeams(deps).execute({
        actor: outsider,
        teamsClassId: 'teams-1',
        title: 'T',
        instructions: null,
        dueDate: null,
        fileName: 'a.docx',
        bytes: docx,
        timeZone: 'UTC',
      }),
    ).toEqual({ ok: false, error: { code: 'microsoft_not_connected' } });
  });

  it('reports a Teams failure so the teacher can try again', async () => {
    const { deps, post } = await poster(makeWorld());
    deps.teams.failWith = 'unavailable';
    expect(await post()).toEqual({ ok: false, error: { code: 'teams_failed' } });
  });
});
