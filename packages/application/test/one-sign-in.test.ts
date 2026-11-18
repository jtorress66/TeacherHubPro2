import { describe, expect, it } from 'vitest';
import type { DeviceKeys, UserId } from '@thp/domain';
import {
  AuthenticateSession,
  ConfirmSignIn,
  DescribeSignInConfirmation,
  LogIn,
  ResumeSignIn,
  SignInWithGoogle,
  signInConfirmTicketLifetimeMs,
  type SignInBrowser,
  type SignInStep,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import { launch, ltiWorld, registered } from './lti-world.ts';
import { googleProfile, makeWorld, password, signedUp, type World } from './world.ts';

const minute = 60 * 1000;

const firefoxOnLinux =
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const safariOnIphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

/** A browser with no session cookie yet. */
const freshBrowser = (userAgent: string | null = firefoxOnLinux): SignInBrowser => ({
  sessionToken: null,
  userAgent,
});

/** The sign-up form, sent from Safari on an iPhone. */
const signedUpOnPhone = (world: World) => signedUp(world, undefined, safariOnIphone);

const logIn = (world: World, browser: SignInBrowser = freshBrowser()) =>
  new LogIn(world).execute({ email: 'ana@school.edu', password, browser });

const stepOf = async (
  result: Promise<{ ok: true; value: { signIn: SignInStep } } | { ok: false; error: unknown }>,
): Promise<SignInStep> => valueOf(await result).signIn;

const ticketOf = (step: SignInStep): string => (step.kind === 'confirm' ? step.ticket : '');
const tokenOf = (step: SignInStep): string => (step.kind === 'signedIn' ? step.sessionToken : '');

const activeHashes = async (world: World, userId: UserId) =>
  (await world.sessions.listActiveForUser(userId, world.clock.now())).map((s) => s.tokenHash);

const hashOf = (world: World, token: string) => world.tokenHasher.hash(token);

describe('signing in while the account is in use on another device', () => {
  it('asks first, naming the other device, and starts no session yet', async () => {
    const world = makeWorld();
    const { sessionToken: phone, user } = await signedUpOnPhone(world);
    world.clock.advanceBy(12 * minute);

    const step = await stepOf(logIn(world));

    const phoneDevice: DeviceKeys = { browser: 'safari', os: 'iphone' };
    expect(step).toEqual({
      kind: 'confirm',
      ticket: expect.any(String) as string,
      otherDevice: phoneDevice,
      otherLastSeenAt: new Date('2026-09-01T08:00:00.000Z'),
    });
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, phone)]);
  });

  it('replaces the other session silently when it was idle for 30 minutes', async () => {
    const world = makeWorld();
    const { sessionToken: phone, user } = await signedUpOnPhone(world);
    world.clock.advanceBy(30 * minute);

    const step = await stepOf(logIn(world));

    expect(step.kind).toBe('signedIn');
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, tokenOf(step))]);
    expect(await world.sessions.findByTokenHash(await hashOf(world, phone))).toMatchObject({
      endedReason: 'replaced',
      endedAt: world.clock.now(),
    });
  });

  it("does not warn about this browser's own session, such as another tab", async () => {
    const world = makeWorld();
    const { sessionToken, user } = await signedUpOnPhone(world);

    const step = await stepOf(logIn(world, { sessionToken, userAgent: safariOnIphone }));

    expect(step.kind).toBe('signedIn');
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, tokenOf(step))]);
  });

  it('records the new session’s device as browser and system keys only', async () => {
    const world = makeWorld();
    await signedUpOnPhone(world);
    world.clock.advanceBy(31 * minute);

    const step = await stepOf(logIn(world));

    const session = await world.sessions.findByTokenHash(await hashOf(world, tokenOf(step)));
    expect(session?.device).toEqual({ browser: 'firefox', os: 'linux' });
  });

  it('only asks after the right password, so it never reveals an account', async () => {
    const world = makeWorld();
    await signedUpOnPhone(world);

    expect(
      await new LogIn(world).execute({
        email: 'ana@school.edu',
        password: 'wrong password!',
        browser: freshBrowser(),
      }),
    ).toEqual({ ok: false, error: { code: 'invalid_credentials' } });
  });
});

describe('DescribeSignInConfirmation', () => {
  it('names the other device and how many minutes ago it was active', async () => {
    const world = makeWorld();
    await signedUpOnPhone(world);
    world.clock.advanceBy(12 * minute);
    const ticket = ticketOf(await stepOf(logIn(world)));
    world.clock.advanceBy(2 * minute + 30_000);

    expect(valueOf(await new DescribeSignInConfirmation(world).execute({ ticket }))).toEqual({
      device: { browser: 'safari', os: 'iphone' },
      minutesAgo: 14,
    });
  });

  it('has no device for a session started before devices were recorded', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUpOnPhone(world);
    const hash = await hashOf(world, sessionToken);
    const old = await world.sessions.findByTokenHash(hash);
    if (old) await world.sessions.save({ ...old, device: null });

    const ticket = ticketOf(await stepOf(logIn(world)));

    expect(valueOf(await new DescribeSignInConfirmation(world).execute({ ticket }))).toEqual({
      device: null,
      minutesAgo: 0,
    });
  });

  it('refuses an expired or tampered ticket', async () => {
    const world = makeWorld();
    await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    const refused = { ok: false, error: { code: 'sign_in_expired' } };

    expect(await new DescribeSignInConfirmation(world).execute({ ticket: `${ticket}x` })).toEqual(
      refused,
    );
    world.clock.advanceBy(signInConfirmTicketLifetimeMs);
    expect(await new DescribeSignInConfirmation(world).execute({ ticket })).toEqual(refused);
  });
});

describe('ConfirmSignIn (Continue here)', () => {
  it('starts the new session and ends every other session of the account', async () => {
    const world = makeWorld();
    const { sessionToken: phone, user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));

    const confirmed = valueOf(
      await new ConfirmSignIn(world).execute({ ticket, userAgent: firefoxOnLinux }),
    );

    expect(confirmed.user.id).toBe(user.id);
    expect(await activeHashes(world, user.id)).toEqual([
      await hashOf(world, confirmed.sessionToken),
    ]);
    expect(await new AuthenticateSession(world).execute(phone)).toEqual({
      ok: false,
      error: { code: 'session_replaced' },
    });
    expect(
      (await world.sessions.findByTokenHash(await hashOf(world, confirmed.sessionToken)))?.device,
    ).toEqual({ browser: 'firefox', os: 'linux' });
  });

  it('refuses an expired, tampered or other kind of ticket, and changes nothing', async () => {
    const world = makeWorld();
    const { sessionToken: phone, user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    const confirm = (t: string) =>
      new ConfirmSignIn(world).execute({ ticket: t, userAgent: firefoxOnLinux });
    const refused = { ok: false, error: { code: 'sign_in_expired' } };
    const linkTicket = world.ticketSigner.sign(
      { purpose: 'lti-link', userId: user.id, schoolId: user.schoolId },
      new Date(world.clock.now().getTime() + minute),
    );

    expect(await confirm('not a ticket')).toEqual(refused);
    expect(await confirm(`${ticket.slice(0, -2)}xx`)).toEqual(refused);
    expect(await confirm(linkTicket)).toEqual(refused);
    world.clock.advanceBy(signInConfirmTicketLifetimeMs);
    expect(await confirm(ticket)).toEqual(refused);
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, phone)]);
  });

  it('refuses a suspended account', async () => {
    const world = makeWorld();
    const { user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    await world.users.save({ ...user, suspendedAt: world.clock.now() });

    expect(await new ConfirmSignIn(world).execute({ ticket, userAgent: null })).toEqual({
      ok: false,
      error: { code: 'account_suspended' },
    });
  });

  it('works once: the same ticket cannot sign in again', async () => {
    const world = makeWorld();
    const { user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    const confirm = () => new ConfirmSignIn(world).execute({ ticket, userAgent: firefoxOnLinux });
    const first = valueOf(await confirm());

    expect(await confirm()).toEqual({ ok: false, error: { code: 'sign_in_expired' } });
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, first.sessionToken)]);
  });

  it('is not used up by showing the question first, or by a refusal', async () => {
    const world = makeWorld();
    const { user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    await new DescribeSignInConfirmation(world).execute({ ticket });
    await world.users.save({ ...user, suspendedAt: world.clock.now() });
    await new ConfirmSignIn(world).execute({ ticket, userAgent: null });
    await world.users.save({ ...user, suspendedAt: null });

    expect((await new ConfirmSignIn(world).execute({ ticket, userAgent: null })).ok).toBe(true);
  });

  it('lasts five minutes', () => {
    expect(signInConfirmTicketLifetimeMs).toBe(5 * minute);
  });
});

describe('AuthenticateSession and activity', () => {
  it('records activity at most every five minutes', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUpOnPhone(world);
    const hash = await hashOf(world, sessionToken);
    const authenticate = new AuthenticateSession(world);
    const lastSeen = async () => (await world.sessions.findByTokenHash(hash))?.lastSeenAt;
    let writes = 0;
    const touch = world.sessions.touch.bind(world.sessions);
    world.sessions.touch = (tokenHash, at) => {
      writes += 1;
      return touch(tokenHash, at);
    };

    world.clock.advanceBy(4 * minute);
    await authenticate.execute(sessionToken);
    await authenticate.execute(sessionToken);
    expect(await lastSeen()).toEqual(new Date('2026-09-01T08:00:00.000Z'));
    world.clock.advanceBy(minute);
    await authenticate.execute(sessionToken);
    await authenticate.execute(sessionToken);

    expect(await lastSeen()).toEqual(world.clock.now());
    expect(writes).toBe(1);
  });

  it('tells an ended session apart from an unknown one, until it expires', async () => {
    const world = makeWorld();
    const { sessionToken: phone } = await signedUpOnPhone(world);
    world.clock.advanceBy(31 * minute);
    await logIn(world);
    const authenticate = new AuthenticateSession(world);

    expect(await authenticate.execute(phone)).toEqual({
      ok: false,
      error: { code: 'session_replaced' },
    });
    world.clock.advanceBy(30 * 24 * 60 * minute);
    expect(await authenticate.execute(phone)).toEqual({
      ok: false,
      error: { code: 'session_expired' },
    });
    expect(await world.sessions.findByTokenHash(await hashOf(world, phone))).toBeNull();
  });
});

describe('every way of signing in goes through the same check', () => {
  it('signing in with Google asks first when the account is in use elsewhere', async () => {
    const world = makeWorld();
    const google = new SignInWithGoogle(world);
    const input = {
      code: 'good-code',
      redirectUri: 'https://app/cb',
      language: 'en',
      defaultSchoolName: 'My school',
    };
    const first = valueOf(
      await google.execute({ ...input, browser: freshBrowser(safariOnIphone) }),
    );
    expect(first.signIn.kind).toBe('signedIn');

    const second = valueOf(await google.execute({ ...input, browser: freshBrowser() }));

    expect(second.user.email).toBe(googleProfile.email);
    expect(second.signIn).toMatchObject({
      kind: 'confirm',
      otherDevice: { browser: 'safari', os: 'iphone' },
    });
    const ticket = ticketOf(second.signIn);
    expect(
      valueOf(await new ConfirmSignIn(world).execute({ ticket, userAgent: firefoxOnLinux })).user
        .email,
    ).toBe(googleProfile.email);
  });

  it('a course system launch asks first when the account is in use elsewhere', async () => {
    const world = ltiWorld();
    const { teacher, platform } = await registered(world);
    await world.ltiUserLinks.link(platform.id, 'canvas-user-1', teacher.id, world.clock.now());
    const first = valueOf(await launch(world, {}, {}, freshBrowser(safariOnIphone)));
    expect(first).toMatchObject({ kind: 'signedIn', signIn: { kind: 'signedIn' } });

    const second = valueOf(await launch(world));

    expect(second).toMatchObject({
      kind: 'signedIn',
      language: teacher.language,
      signIn: { kind: 'confirm', otherDevice: { browser: 'safari', os: 'iphone' } },
    });
  });

  it('a new account records the device it signed up on', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world, undefined, firefoxOnLinux);

    const session = await world.sessions.findByTokenHash(await hashOf(world, sessionToken));
    expect(session?.device).toEqual({ browser: 'firefox', os: 'linux' });
  });
});

describe('ResumeSignIn (asked again where the browser’s own cookie can be read)', () => {
  it('goes straight in when the only active session is this browser’s own', async () => {
    const world = makeWorld();
    const { sessionToken: phone, user } = await signedUpOnPhone(world);
    // A course system posts its launch from another site, so the cookie was not sent then.
    const ticket = ticketOf(await stepOf(logIn(world)));

    const step = valueOf(
      await new ResumeSignIn(world).execute({
        ticket,
        browser: { sessionToken: phone, userAgent: safariOnIphone },
      }),
    );

    expect(step.kind).toBe('signedIn');
    expect(await activeHashes(world, user.id)).toEqual([await hashOf(world, tokenOf(step))]);
  });

  it('still asks when another device is active', async () => {
    const world = makeWorld();
    await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));

    const step = valueOf(
      await new ResumeSignIn(world).execute({ ticket, browser: freshBrowser() }),
    );

    expect(step).toMatchObject({ kind: 'confirm', otherDevice: { browser: 'safari' } });
  });

  it('works once: the same ticket cannot be resumed again', async () => {
    const world = makeWorld();
    const { sessionToken: phone } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    const resume = () =>
      new ResumeSignIn(world).execute({
        ticket,
        browser: { sessionToken: phone, userAgent: safariOnIphone },
      });

    expect((await resume()).ok).toBe(true);
    expect(await resume()).toEqual({ ok: false, error: { code: 'sign_in_expired' } });
  });

  it('refuses an expired ticket, and a suspended account', async () => {
    const world = makeWorld();
    const { user } = await signedUpOnPhone(world);
    const ticket = ticketOf(await stepOf(logIn(world)));
    const resume = () => new ResumeSignIn(world).execute({ ticket, browser: freshBrowser() });

    await world.users.save({ ...user, suspendedAt: world.clock.now() });
    expect(await resume()).toEqual({ ok: false, error: { code: 'account_suspended' } });
    world.clock.advanceBy(signInConfirmTicketLifetimeMs);
    expect(await resume()).toEqual({ ok: false, error: { code: 'sign_in_expired' } });
  });
});
