import { describe, expect, it } from 'vitest';
import { ltiClaim, type SchoolId, type User } from '@thp/domain';
import { aUser } from '@thp/testing';
import {
  CompleteLtiLaunch,
  DescribeLtiLink,
  LinkLtiAccount,
  ListLtiPlatforms,
  LtiSetUpForSchool,
  RegisterLtiPlatform,
  RemoveLtiPlatform,
  StartLtiLogin,
  ltiLinkTicketLifetimeMs,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import {
  asAdmin,
  details,
  forbidden,
  issuer,
  launch,
  launchClaims,
  ltiWorld,
  registered,
  startLogin,
  tokens,
  type LtiWorld,
} from './lti-world.ts';
import { signedUp } from './world.ts';

describe('RegisterLtiPlatform, ListLtiPlatforms and RemoveLtiPlatform', () => {
  it('lets a school admin register, list and remove their school’s course system', async () => {
    const world = ltiWorld();
    const { user } = await signedUp(world);
    const admin = asAdmin(user);

    const platform = valueOf(
      await new RegisterLtiPlatform(world).execute({ actor: admin, details: details() }),
    );

    expect(platform).toMatchObject({
      schoolId: admin.schoolId,
      name: 'Lincoln Canvas',
      deploymentIds: ['dep-1', 'dep-2'],
      createdAt: world.clock.now(),
    });
    expect(valueOf(await new ListLtiPlatforms(world).execute({ actor: admin }))).toEqual([
      platform,
    ]);
    valueOf(await new RemoveLtiPlatform(world).execute({ actor: admin, platformId: platform.id }));
    expect(valueOf(await new ListLtiPlatforms(world).execute({ actor: admin }))).toEqual([]);
  });

  it('reports the first wrong field', async () => {
    const world = ltiWorld();
    const { user } = await signedUp(world);

    expect(
      await new RegisterLtiPlatform(world).execute({
        actor: asAdmin(user),
        details: details({ jwksUrl: 'http://lms.lincoln.edu/jwks' }),
      }),
    ).toEqual({ ok: false, error: { field: 'jwksUrl', code: 'invalid_format' } });
  });

  it('refuses a course system and client ID that is already registered, in any school', async () => {
    const world = ltiWorld();
    await registered(world);
    const otherAdmin = aUser({
      id: 'other-admin' as User['id'],
      schoolId: 'other-school' as SchoolId,
      role: 'school_admin',
    });

    expect(
      await new RegisterLtiPlatform(world).execute({ actor: otherAdmin, details: details() }),
    ).toEqual({ ok: false, error: { field: 'clientId', code: 'duplicate' } });
    expect(
      (
        await new RegisterLtiPlatform(world).execute({
          actor: otherAdmin,
          details: details({ clientId: 'client-2' }),
        })
      ).ok,
    ).toBe(true);
  });

  it('refuses teachers', async () => {
    const world = ltiWorld();
    const { platform, teacher } = await registered(world);

    expect(
      await new RegisterLtiPlatform(world).execute({ actor: teacher, details: details() }),
    ).toEqual(forbidden);
    expect(await new ListLtiPlatforms(world).execute({ actor: teacher })).toEqual(forbidden);
    expect(
      await new RemoveLtiPlatform(world).execute({ actor: teacher, platformId: platform.id }),
    ).toEqual(forbidden);
  });

  it('never shows or removes another school’s course system', async () => {
    const world = ltiWorld();
    const { platform, admin } = await registered(world);
    const otherAdmin = aUser({
      id: 'other-admin' as User['id'],
      schoolId: 'other-school' as SchoolId,
      role: 'school_admin',
    });

    expect(valueOf(await new ListLtiPlatforms(world).execute({ actor: otherAdmin }))).toEqual([]);
    expect(
      await new RemoveLtiPlatform(world).execute({ actor: otherAdmin, platformId: platform.id }),
    ).toEqual({ ok: false, error: { code: 'not_found' } });
    expect(
      await new ListLtiPlatforms(world).execute({ actor: otherAdmin, schoolId: admin.schoolId }),
    ).toEqual(forbidden);
    expect(valueOf(await new ListLtiPlatforms(world).execute({ actor: admin }))).toEqual([
      platform,
    ]);
  });

  it('lets a super admin manage any school’s course systems', async () => {
    const world = ltiWorld();
    const { platform, admin } = await registered(world);
    const root = aUser({
      id: 'root' as User['id'],
      schoolId: 'platform-school' as SchoolId,
      role: 'super_admin',
    });

    expect(
      valueOf(await new ListLtiPlatforms(world).execute({ actor: root, schoolId: admin.schoolId })),
    ).toEqual([platform]);
    valueOf(
      await new RemoveLtiPlatform(world).execute({
        actor: root,
        platformId: platform.id,
        schoolId: admin.schoolId,
      }),
    );
    expect(valueOf(await new ListLtiPlatforms(world).execute({ actor: admin }))).toEqual([]);
  });
});

describe('LtiSetUpForSchool', () => {
  it('tells any teacher whether their own school has a course system set up', async () => {
    const world = ltiWorld();
    const { teacher } = await registered(world);
    const elsewhere = aUser({ id: 'x' as User['id'], schoolId: 'other-school' as SchoolId });

    expect(valueOf(await new LtiSetUpForSchool(world).execute({ actor: teacher }))).toBe(true);
    expect(valueOf(await new LtiSetUpForSchool(world).execute({ actor: elsewhere }))).toBe(false);
  });
});

describe('StartLtiLogin', () => {
  it('sends the browser to the course system’s sign-in with a fresh state and nonce', async () => {
    const world = ltiWorld();
    const { platform } = await registered(world);

    const started = valueOf(
      await new StartLtiLogin(world).execute({
        issuer,
        loginHint: 'hint-1',
        targetLinkUri: 'https://app.teacherhub.test/api/lti/launch',
        ltiMessageHint: 'message-hint',
        clientId: null,
        deploymentId: 'dep-2',
      }),
    );

    expect(started.platformId).toBe(platform.id);
    expect(started.schoolId).toBe(platform.schoolId);
    expect(started.state).not.toBe(started.nonce);
    const url = new URL(started.redirectUrl);
    expect(`${url.origin}${url.pathname}`).toBe('https://lms.lincoln.edu/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scope: 'openid',
      response_type: 'id_token',
      response_mode: 'form_post',
      prompt: 'none',
      client_id: 'client-1',
      redirect_uri: 'https://app.teacherhub.test/api/lti/launch',
      login_hint: 'hint-1',
      lti_message_hint: 'message-hint',
      state: started.state,
      nonce: started.nonce,
    });
  });

  it('keeps any query the course system’s sign-in address already has', async () => {
    const world = ltiWorld();
    const { user } = await signedUp(world);
    valueOf(
      await new RegisterLtiPlatform(world).execute({
        actor: asAdmin(user),
        details: details({ authLoginUrl: 'https://lms.lincoln.edu/auth?tenant=7' }),
      }),
    );
    const started = valueOf(
      await new StartLtiLogin(world).execute({
        issuer,
        loginHint: 'hint-1',
        targetLinkUri: 'https://app.teacherhub.test/',
        ltiMessageHint: null,
        clientId: 'client-1',
        deploymentId: null,
      }),
    );
    const url = new URL(started.redirectUrl);
    expect(url.searchParams.get('tenant')).toBe('7');
    expect(url.searchParams.has('lti_message_hint')).toBe(false);
  });

  it('refuses a course system nobody registered, or a deployment it did not list', async () => {
    const world = ltiWorld();
    await registered(world);
    const start = (overrides: { issuer?: string; clientId?: string; deploymentId?: string }) =>
      new StartLtiLogin(world).execute({
        issuer: overrides.issuer ?? issuer,
        loginHint: 'hint-1',
        targetLinkUri: 'https://app.teacherhub.test/',
        ltiMessageHint: null,
        clientId: overrides.clientId ?? null,
        deploymentId: overrides.deploymentId ?? null,
      });

    expect(await start({ issuer: 'https://unknown.example' })).toEqual({
      ok: false,
      error: { code: 'unknown_platform' },
    });
    expect(await start({ clientId: 'client-9' })).toEqual({
      ok: false,
      error: { code: 'unknown_platform' },
    });
    expect(await start({ deploymentId: 'dep-9' })).toEqual({
      ok: false,
      error: { code: 'unknown_deployment' },
    });
  });

  it('needs the client ID when two schools use the same course system', async () => {
    const world = ltiWorld();
    await registered(world);
    const otherAdmin = aUser({
      id: 'other-admin' as User['id'],
      schoolId: 'other-school' as SchoolId,
      role: 'school_admin',
    });
    valueOf(
      await new RegisterLtiPlatform(world).execute({
        actor: otherAdmin,
        details: details({ clientId: 'client-2' }),
      }),
    );
    const start = (clientId: string | null) =>
      new StartLtiLogin(world).execute({
        issuer,
        loginHint: 'hint-1',
        targetLinkUri: 'https://app.teacherhub.test/',
        ltiMessageHint: null,
        clientId,
        deploymentId: null,
      });

    expect(await start(null)).toEqual({ ok: false, error: { code: 'ambiguous_platform' } });
    expect(valueOf(await start('client-2')).schoolId).toBe('other-school');
  });

  it('refuses a login without the required values', async () => {
    const world = ltiWorld();
    await registered(world);

    expect(
      await new StartLtiLogin(world).execute({
        issuer,
        loginHint: ' ',
        targetLinkUri: 'https://app.teacherhub.test/',
        ltiMessageHint: null,
        clientId: null,
        deploymentId: null,
      }),
    ).toEqual({ ok: false, error: { code: 'invalid_request' } });
  });
});

describe('CompleteLtiLaunch', () => {
  it('asks a teacher who has not linked their account yet to sign in once, with a short-lived ticket', async () => {
    const world = ltiWorld();
    const { platform } = await registered(world);

    const outcome = valueOf(await launch(world));

    expect(outcome).toMatchObject({ kind: 'needsLink', locale: 'es' });
    const ticket = outcome.kind === 'needsLink' ? outcome.ticket : '';
    expect(world.ticketSigner.verify(ticket, world.clock.now())).toEqual({
      purpose: 'lti-link',
      platformId: platform.id,
      subject: 'canvas-user-1',
      schoolId: platform.schoolId,
    });
    world.clock.advanceBy(ltiLinkTicketLifetimeMs);
    expect(world.ticketSigner.verify(ticket, world.clock.now())).toBeNull();
    expect(ltiLinkTicketLifetimeMs).toBe(15 * 60 * 1000);
  });

  it('signs a linked teacher straight in, in their own language', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());

    const outcome = valueOf(await launch(world));

    expect(outcome).toMatchObject({ kind: 'signedIn', language: teacher.language });
    const token = outcome.kind === 'signedIn' ? outcome.sessionToken : '';
    const session = await world.sessions.findByTokenHash(await world.tokenHasher.hash(token));
    expect(session?.userId).toBe(teacher.id);
  });

  it('refuses a suspended teacher, as logging in does', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.users.save({ ...teacher, suspendedAt: world.clock.now() });
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());

    expect(await launch(world)).toEqual({ ok: false, error: { code: 'account_suspended' } });
  });

  it('asks again when the linked account is gone or now belongs to another school', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.users.save({ ...teacher, schoolId: 'other-school' as SchoolId });
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());

    expect(valueOf(await launch(world)).kind).toBe('needsLink');
  });

  it('shows students a not-yet page and keeps nothing about them', async () => {
    const world = ltiWorld();
    await registered(world);

    const outcome = await launch(world, {
      [ltiClaim.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
      [ltiClaim.launchPresentation]: undefined,
    });

    expect(outcome).toEqual({ ok: true, value: { kind: 'learnerNotYet', locale: null } });
  });

  it('refuses a launch whose state does not match the login', async () => {
    const world = ltiWorld();
    await registered(world);
    const saved = await startLogin(world);
    const idToken = await tokens.sign(launchClaims(world, saved));
    const complete = new CompleteLtiLaunch(world);

    expect(await complete.execute({ idToken, state: 'forged', saved })).toEqual({
      ok: false,
      error: { code: 'state_mismatch' },
    });
    expect(await complete.execute({ idToken, state: saved.state, saved: null })).toEqual({
      ok: false,
      error: { code: 'state_mismatch' },
    });
  });

  it('refuses a token that is not signed by the course system', async () => {
    const world = ltiWorld();
    await registered(world);
    const saved = await startLogin(world);
    const idToken = await tokens.signWithOtherKey(launchClaims(world, saved));

    expect(
      await new CompleteLtiLaunch(world).execute({ idToken, state: saved.state, saved }),
    ).toEqual({ ok: false, error: { code: 'invalid_token' } });
  });

  it('refuses a launch the domain rejects, with its reason', async () => {
    const world = ltiWorld();
    await registered(world);

    expect(await launch(world, { [ltiClaim.deploymentId]: 'dep-9' })).toEqual({
      ok: false,
      error: { code: 'unknown_deployment' },
    });
    expect(await launch(world, { nonce: 'other' })).toEqual({
      ok: false,
      error: { code: 'wrong_nonce' },
    });
  });

  it('refuses a launch for a course system that was removed, or from another school', async () => {
    const world = ltiWorld();
    const { admin, platform } = await registered(world);

    expect(await launch(world, {}, { schoolId: 'other-school' as SchoolId })).toEqual({
      ok: false,
      error: { code: 'unknown_platform' },
    });
    const saved = await startLogin(world);
    valueOf(await new RemoveLtiPlatform(world).execute({ actor: admin, platformId: platform.id }));
    const idToken = await tokens.sign(launchClaims(world, saved));
    expect(
      await new CompleteLtiLaunch(world).execute({ idToken, state: saved.state, saved }),
    ).toEqual({ ok: false, error: { code: 'unknown_platform' } });
  });

  it('refuses the same launch token twice', async () => {
    const world = ltiWorld();
    await registered(world);
    const saved = await startLogin(world);
    const idToken = await tokens.sign(launchClaims(world, saved));
    const complete = new CompleteLtiLaunch(world);

    expect((await complete.execute({ idToken, state: saved.state, saved })).ok).toBe(true);
    expect(await complete.execute({ idToken, state: saved.state, saved })).toEqual({
      ok: false,
      error: { code: 'replayed' },
    });
  });
});

const membershipsUrl = 'https://lms.lincoln.edu/api/lti/courses/9/names_and_roles';
const fromCourse = {
  [ltiClaim.context]: { id: 'course-9', title: 'Science 5' },
  [ltiClaim.namesRoleService]: {
    context_memberships_url: membershipsUrl,
    service_versions: ['2.0'],
  },
};

describe('CompleteLtiLaunch and LinkLtiAccount remember the teacher’s course', () => {
  it('remembers the course a linked teacher launched from, and when', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());

    expect(valueOf(await launch(world, fromCourse)).kind).toBe('signedIn');

    expect(await world.ltiCourses.listForTeacher(teacher.schoolId, teacher.id)).toEqual([
      {
        platformId: platform.id,
        schoolId: teacher.schoolId,
        teacherId: teacher.id,
        contextId: 'course-9',
        title: 'Science 5',
        membershipsUrl,
        lastLaunchedAt: world.clock.now(),
      },
    ]);
  });

  it('remembers nothing for a launch outside a course, or a refused one', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());

    expect(valueOf(await launch(world)).kind).toBe('signedIn');
    await world.users.save({ ...teacher, suspendedAt: world.clock.now() });
    expect((await launch(world, fromCourse)).ok).toBe(false);

    expect(await world.ltiCourses.listForTeacher(teacher.schoolId, teacher.id)).toEqual([]);
  });

  it('carries the course in the link ticket and remembers it once the teacher links', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    const outcome = valueOf(await launch(world, fromCourse));
    const ticket = outcome.kind === 'needsLink' ? outcome.ticket : '';
    expect(world.ticketSigner.verify(ticket, world.clock.now())).toMatchObject({
      contextId: 'course-9',
      contextTitle: 'Science 5',
      membershipsUrl,
    });
    expect(await world.ltiCourses.listForTeacher(teacher.schoolId, teacher.id)).toEqual([]);

    valueOf(await new LinkLtiAccount(world).execute({ actor: teacher, ticket }));

    expect(await world.ltiCourses.listForTeacher(teacher.schoolId, teacher.id)).toEqual([
      expect.objectContaining({
        platformId: platform.id,
        contextId: 'course-9',
        title: 'Science 5',
        membershipsUrl,
      }),
    ]);
  });

  it('remembers a course without a class list address, which cannot be imported', async () => {
    const world = ltiWorld();
    const { teacher } = await registered(world);
    const outcome = valueOf(await launch(world, { [ltiClaim.context]: { id: 'course-3' } }));
    const ticket = outcome.kind === 'needsLink' ? outcome.ticket : '';

    valueOf(await new LinkLtiAccount(world).execute({ actor: teacher, ticket }));

    expect(await world.ltiCourses.listForTeacher(teacher.schoolId, teacher.id)).toEqual([
      expect.objectContaining({ contextId: 'course-3', title: 'course-3', membershipsUrl: null }),
    ]);
  });

  it('remembers nothing when another school’s teacher tries to link', async () => {
    const world = ltiWorld();
    await registered(world);
    const outcome = valueOf(await launch(world, fromCourse));
    const ticket = outcome.kind === 'needsLink' ? outcome.ticket : '';
    const elsewhere = aUser({ id: 'x' as User['id'], schoolId: 'other-school' as SchoolId });

    expect(await new LinkLtiAccount(world).execute({ actor: elsewhere, ticket })).toEqual(
      forbidden,
    );
    expect(await world.ltiCourses.listForTeacher(elsewhere.schoolId, elsewhere.id)).toEqual([]);
  });
});

describe('DescribeLtiLink and LinkLtiAccount', () => {
  async function ticketFor(world: LtiWorld): Promise<string> {
    const outcome = valueOf(await launch(world));
    if (outcome.kind !== 'needsLink') throw new Error(outcome.kind);
    return outcome.ticket;
  }

  it('links the signed-in teacher, so the next launch signs them straight in', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    const ticket = await ticketFor(world);

    expect(valueOf(await new DescribeLtiLink(world).execute({ ticket }))).toEqual({
      platformName: 'Lincoln Canvas',
    });
    expect(valueOf(await new LinkLtiAccount(world).execute({ actor: teacher, ticket }))).toEqual({
      platformName: 'Lincoln Canvas',
    });

    expect(await world.ltiUserLinks.findUserId(platform.id, 'canvas-user-1')).toBe(teacher.id);
    expect(valueOf(await launch(world)).kind).toBe('signedIn');
  });

  it('refuses a teacher of another school', async () => {
    const world = ltiWorld();
    const { platform } = await registered(world);
    const ticket = await ticketFor(world);
    const elsewhere = aUser({ id: 'x' as User['id'], schoolId: 'other-school' as SchoolId });

    expect(await new LinkLtiAccount(world).execute({ actor: elsewhere, ticket })).toEqual(
      forbidden,
    );
    expect(await world.ltiUserLinks.findUserId(platform.id, 'canvas-user-1')).toBeNull();
  });

  it('refuses an expired, forged or foreign ticket', async () => {
    const world = ltiWorld();
    const { teacher } = await registered(world);
    const ticket = await ticketFor(world);
    const liveTicket = world.ticketSigner.sign(
      { role: 'host', schoolId: teacher.schoolId, sessionId: 's', userId: teacher.id },
      new Date(world.clock.now().getTime() + 60_000),
    );
    const expired = { ok: false, error: { code: 'link_expired' } };

    for (const bad of [`${ticket}x`, liveTicket]) {
      expect(await new LinkLtiAccount(world).execute({ actor: teacher, ticket: bad })).toEqual(
        expired,
      );
      expect(await new DescribeLtiLink(world).execute({ ticket: bad })).toEqual(expired);
    }
    world.clock.advanceBy(ltiLinkTicketLifetimeMs);
    expect(await new LinkLtiAccount(world).execute({ actor: teacher, ticket })).toEqual(expired);
  });

  it('refuses a ticket for a course system that was removed since', async () => {
    const world = ltiWorld();
    const { admin, teacher, platform } = await registered(world);
    const ticket = await ticketFor(world);
    valueOf(await new RemoveLtiPlatform(world).execute({ actor: admin, platformId: platform.id }));
    const gone = { ok: false, error: { code: 'unknown_platform' } };

    expect(await new DescribeLtiLink(world).execute({ ticket })).toEqual(gone);
    expect(await new LinkLtiAccount(world).execute({ actor: teacher, ticket })).toEqual(gone);
  });
});
