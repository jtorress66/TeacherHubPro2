import { describe, expect, it } from 'vitest';
import { aiUsageWindowDays, type SchoolId, type User, type UserId } from '@thp/domain';
import {
  FakeGoogleIdentity,
  InMemoryPasswordTokenRepository,
  InMemoryUserDirectory,
} from '@thp/testing';
import {
  AuthenticateSession,
  BlockDomain,
  ConfirmEmail,
  ListAllUsers,
  ListBlockedDomains,
  LogIn,
  PasswordLinks,
  ReinstateUser,
  RequestGeneration,
  ResendEmailConfirmation,
  SetPassword,
  SignInWithGoogle,
  SignUp,
  SuspendUser,
  UnblockDomain,
  checkAiAccess,
} from '../src/index.ts';
import { valueOf } from './classroom.ts';
import {
  advanceDays,
  emailedToken,
  googleProfile,
  makeWorld,
  password,
  signUpInput,
  signedUp,
  signedUpUnconfirmed,
  type World,
} from './world.ts';

const refused = (code: string) => ({ ok: false, error: { code } });

/** The world with a user directory, as the super admin pages have. */
function protectionWorld() {
  const world = makeWorld();
  const stores = {
    schools: world.schools,
    users: world.users,
    classes: world.classes,
    students: world.students,
    lessonPlans: world.lessonPlans,
    presentations: world.presentations,
    generations: world.generations,
    grades: world.grades,
    subscriptions: world.subscriptions,
  };
  return {
    ...world,
    userDirectory: new InMemoryUserDirectory(stores),
    schoolDirectory: {
      listAll: () => Promise.resolve(world.schools.all()),
      delete: () => Promise.resolve('not_found' as const),
    },
  };
}
type ProtectionWorld = ReturnType<typeof protectionWorld>;

async function rootIn(world: World): Promise<User> {
  const { user } = await signedUp(world, 'root@platform.edu');
  const root: User = { ...user, role: 'super_admin' };
  await world.users.save(root);
  return root;
}

const askForWorksheet = (world: World, actor: User) =>
  new RequestGeneration(world).execute({
    actor,
    type: 'worksheet',
    subject: 'math',
    grade: '5',
    topic: 'Fractions',
    language: 'en',
  });

describe('SignUp: adults only', () => {
  it('refuses a sign-up without the adult and role box ticked', async () => {
    const world = makeWorld();
    expect(await new SignUp(world).execute({ ...signUpInput(), adult: false })).toEqual(
      refused('adult_required'),
    );
    expect(world.users.all()).toHaveLength(0);
  });

  it('refuses a temporary email address, subdomains included', async () => {
    const world = makeWorld();
    for (const email of ['kid@mailinator.com', 'kid@inbox.yopmail.com']) {
      expect(await new SignUp(world).execute(signUpInput(email))).toEqual(
        refused('throwaway_email'),
      );
    }
    expect(world.users.all()).toHaveLength(0);
  });

  it('refuses an email at a blocked domain or one of its subdomains', async () => {
    const world = makeWorld();
    await world.blockedDomains.save({
      domain: 'students.district.org',
      createdAt: world.clock.now(),
      createdBy: null,
    });
    for (const email of ['kid@students.district.org', 'kid@g7.students.district.org']) {
      expect(await new SignUp(world).execute(signUpInput(email))).toEqual(
        refused('blocked_domain'),
      );
    }
    expect((await new SignUp(world).execute(signUpInput('teacher@district.org'))).ok).toBe(true);
  });
});

describe('Email confirmation', () => {
  it('starts unconfirmed and emails a confirmation link whose secret is stored only as a hash', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    expect(user.emailConfirmedAt).toBeNull();
    const mail = world.mailer.outbox.find((m) => m.to === user.email);
    expect(mail?.subject).toBe('[es] confirm Ana López');
    expect(mail?.text).toMatch(/^confirm: https:\/\/app\.teacherhub\.test\/es\/confirm-email#/u);
    const secret = emailedToken(world, user.email);
    const stored = world.emailConfirmations.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(await world.tokenHasher.hash(secret));
    expect(stored[0]?.tokenHash).not.toContain(secret);
  });

  it('confirms once from the link; the link cannot be used again', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    const token = emailedToken(world, user.email);
    const confirmed = valueOf(await new ConfirmEmail(world).execute({ token }));
    expect(confirmed.emailConfirmedAt).toEqual(world.clock.now());
    expect((await world.users.findById(user.schoolId, user.id))?.emailConfirmedAt).toEqual(
      world.clock.now(),
    );
    expect(await new ConfirmEmail(world).execute({ token })).toEqual(refused('invalid_link'));
  });

  it('refuses an expired, unknown or blank link', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    const token = emailedToken(world, user.email);
    advanceDays(world, 3);
    expect(await new ConfirmEmail(world).execute({ token })).toEqual(refused('invalid_link'));
    expect(await new ConfirmEmail(world).execute({ token: 'made-up' })).toEqual(
      refused('invalid_link'),
    );
    expect(await new ConfirmEmail(world).execute({ token: ' ' })).toEqual(refused('invalid_link'));
  });

  it('resends a new link that replaces the old one', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    const first = emailedToken(world, user.email);
    valueOf(await new ResendEmailConfirmation(world).execute({ actor: user }));
    const second = emailedToken(world, user.email);
    expect(second).not.toBe(first);
    expect(await new ConfirmEmail(world).execute({ token: first })).toEqual(
      refused('invalid_link'),
    );
    expect((await new ConfirmEmail(world).execute({ token: second })).ok).toBe(true);
  });

  it('resends at most 5 times a day per account', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    const resend = new ResendEmailConfirmation(world);
    for (let i = 0; i < 5; i += 1) valueOf(await resend.execute({ actor: user }));
    expect(await resend.execute({ actor: user })).toEqual(refused('resend_limit'));
    const other = await signedUpUnconfirmed(world, 'ben@school.edu');
    expect((await resend.execute({ actor: other.user })).ok).toBe(true);
    advanceDays(world, 1);
    expect((await resend.execute({ actor: user })).ok).toBe(true);
  });

  it('sends nothing to an account that is already confirmed', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    const before = world.mailer.outbox.length;
    expect(await new ResendEmailConfirmation(world).execute({ actor: user })).toEqual({
      ok: true,
      value: 'already_confirmed',
    });
    expect(world.mailer.outbox).toHaveLength(before);
  });
});

describe('AI tools need a confirmed email', () => {
  it('refuses AI until the email is confirmed, then allows it', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    expect(await checkAiAccess(world, user)).toEqual(refused('email_unconfirmed'));
    expect(await askForWorksheet(world, user)).toEqual(refused('email_unconfirmed'));

    const confirmed = valueOf(
      await new ConfirmEmail(world).execute({ token: emailedToken(world, user.email) }),
    );
    expect(await checkAiAccess(world, confirmed)).toEqual({ ok: true, value: true });
    expect((await askForWorksheet(world, confirmed)).ok).toBe(true);
  });

  it('lets a super admin use AI without confirming', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world);
    expect(await checkAiAccess(world, { ...user, role: 'super_admin' })).toEqual({
      ok: true,
      value: true,
    });
  });
});

describe('Automatic confirmation', () => {
  it('confirms a new Google account straight away', async () => {
    const world = makeWorld();
    const signedIn = valueOf(
      await new SignInWithGoogle(world).execute({
        code: 'good-code',
        redirectUri: 'https://app/cb',
        language: 'en',
        defaultSchoolName: 'My School',
      }),
    );
    expect(signedIn.user.emailConfirmedAt).toEqual(world.clock.now());
    expect((await checkAiAccess(world, signedIn.user)).ok).toBe(true);
  });

  it('confirms an existing account the first time it signs in with Google', async () => {
    const world = makeWorld();
    const { user } = await signedUpUnconfirmed(world, googleProfile.email);
    advanceDays(world, 1);
    const signedIn = valueOf(
      await new SignInWithGoogle(world).execute({
        code: 'good-code',
        redirectUri: 'https://app/cb',
        language: 'en',
        defaultSchoolName: 'My School',
      }),
    );
    expect(signedIn.user.id).toBe(user.id);
    expect(signedIn.user.emailConfirmedAt).toEqual(world.clock.now());
    expect((await world.users.findById(user.schoolId, user.id))?.emailConfirmedAt).toEqual(
      world.clock.now(),
    );
  });

  it('confirms an account whose password is set from an emailed link', async () => {
    const world = { ...makeWorld(), passwordTokens: new InMemoryPasswordTokenRepository() };
    const { user } = await signedUpUnconfirmed(world);
    valueOf(await new PasswordLinks(world).send(user, 'reset'));
    const token = /set-password#(\S+)/u.exec(
      world.mailer.outbox.filter((m) => m.text.startsWith('reset')).at(-1)?.text ?? '',
    )?.[1];
    const saved = valueOf(
      await new SetPassword(world).execute({ token: token ?? '', password: 'a new long password' }),
    );
    expect(saved.emailConfirmedAt).toEqual(world.clock.now());
    expect((await world.users.findById(user.schoolId, user.id))?.emailConfirmedAt).toEqual(
      world.clock.now(),
    );
  });
});

describe('Suspension', () => {
  async function setUp() {
    const world = protectionWorld();
    const root = await rootIn(world);
    const { user: teacher, sessionToken } = await signedUp(world, 'tina@school.edu');
    return { world, root, teacher, sessionToken };
  }

  it('ends every session and refuses password log in, Google sign-in and old sessions', async () => {
    const { world, root, teacher, sessionToken } = await setUp();
    await new LogIn(world).execute({ email: teacher.email, password });
    expect(world.sessions.all().filter((s) => s.userId === teacher.id)).toHaveLength(2);

    const suspended = valueOf(
      await new SuspendUser(world).execute({
        actor: root,
        schoolId: teacher.schoolId,
        userId: teacher.id,
      }),
    );
    expect(suspended.suspendedAt).toEqual(world.clock.now());
    expect(world.sessions.all().filter((s) => s.userId === teacher.id)).toHaveLength(0);

    expect(await new AuthenticateSession(world).execute(sessionToken)).toEqual(
      refused('unauthenticated'),
    );
    expect(await new LogIn(world).execute({ email: teacher.email, password })).toEqual(
      refused('account_suspended'),
    );
    const google = {
      ...world,
      google: new FakeGoogleIdentity({
        'tina-code': { ...googleProfile, email: teacher.email },
      }),
    };
    expect(
      await new SignInWithGoogle(google).execute({
        code: 'tina-code',
        redirectUri: 'https://app/cb',
        language: 'en',
        defaultSchoolName: 'My School',
      }),
    ).toEqual(refused('account_suspended'));
  });

  it('does not tell a wrong password apart from a suspended account', async () => {
    const { world, root, teacher } = await setUp();
    valueOf(
      await new SuspendUser(world).execute({
        actor: root,
        schoolId: teacher.schoolId,
        userId: teacher.id,
      }),
    );
    expect(
      await new LogIn(world).execute({ email: teacher.email, password: 'wrong password!' }),
    ).toEqual(refused('invalid_credentials'));
  });

  it('refuses a session of an account suspended directly in storage', async () => {
    const { world, teacher, sessionToken } = await setUp();
    await world.users.save({ ...teacher, suspendedAt: world.clock.now() });
    expect(await new AuthenticateSession(world).execute(sessionToken)).toEqual(
      refused('account_suspended'),
    );
    expect(world.sessions.all().filter((s) => s.userId === teacher.id)).toHaveLength(0);
  });

  it('reinstates: the person can log in again', async () => {
    const { world, root, teacher } = await setUp();
    const target = { actor: root, schoolId: teacher.schoolId, userId: teacher.id };
    valueOf(await new SuspendUser(world).execute(target));
    const back = valueOf(await new ReinstateUser(world).execute(target));
    expect(back.suspendedAt).toBeNull();
    expect((await new LogIn(world).execute({ email: teacher.email, password })).ok).toBe(true);
  });

  it('never suspends yourself or another super admin', async () => {
    const { world, root } = await setUp();
    expect(
      await new SuspendUser(world).execute({
        actor: root,
        schoolId: root.schoolId,
        userId: root.id,
      }),
    ).toEqual(refused('own_account'));
    const { user } = await signedUp(world, 'second@platform.edu');
    const second: User = { ...user, role: 'super_admin' };
    await world.users.save(second);
    expect(
      await new SuspendUser(world).execute({
        actor: root,
        schoolId: second.schoolId,
        userId: second.id,
      }),
    ).toEqual(refused('forbidden'));
  });

  it('is not found for an unknown account', async () => {
    const { world, root } = await setUp();
    const target = { actor: root, schoolId: 'nope' as SchoolId, userId: 'nobody' as UserId };
    expect(await new SuspendUser(world).execute(target)).toEqual(refused('not_found'));
    expect(await new ReinstateUser(world).execute(target)).toEqual(refused('not_found'));
  });
});

describe('Blocked domains', () => {
  it('normalizes the domain, suspends existing accounts there (not super admins) and lists them', async () => {
    const world = protectionWorld();
    const root = await rootIn(world);
    const { user: kid } = await signedUp(world, 'kid@students.district.org');
    const { user: deep } = await signedUp(world, 'kid2@g7.students.district.org');
    const { user: teacher } = await signedUp(world, 'teacher@district.org');
    const { user: admin } = await signedUp(world, 'boss@students.district.org');
    const superAtDomain: User = { ...admin, role: 'super_admin' };
    await world.users.save(superAtDomain);

    const blocked = valueOf(
      await new BlockDomain(world).execute({ actor: root, domain: '  @Students.District.ORG ' }),
    );
    expect(blocked.domain).toBe('students.district.org');
    expect(blocked.suspended.map((u) => u.id).sort()).toEqual([kid.id, deep.id].sort());
    for (const user of [kid, deep]) {
      expect((await world.users.findById(user.schoolId, user.id))?.suspendedAt).toEqual(
        world.clock.now(),
      );
    }
    for (const user of [teacher, superAtDomain]) {
      expect((await world.users.findById(user.schoolId, user.id))?.suspendedAt).toBeNull();
    }
    expect(world.sessions.all().filter((s) => s.userId === kid.id)).toHaveLength(0);

    const list = valueOf(await new ListBlockedDomains(world).execute({ actor: root }));
    expect(list).toEqual([
      { domain: 'students.district.org', createdAt: world.clock.now(), createdBy: root.id },
    ]);
    expect(await new SignUp(world).execute(signUpInput('new@students.district.org'))).toEqual(
      refused('blocked_domain'),
    );

    valueOf(
      await new UnblockDomain(world).execute({ actor: root, domain: 'students.district.org' }),
    );
    expect(valueOf(await new ListBlockedDomains(world).execute({ actor: root }))).toEqual([]);
    expect(
      await new UnblockDomain(world).execute({ actor: root, domain: 'students.district.org' }),
    ).toEqual(refused('not_found'));
  });

  it('refuses invalid input', async () => {
    const world = protectionWorld();
    const root = await rootIn(world);
    expect(await new BlockDomain(world).execute({ actor: root, domain: 'not a domain' })).toEqual({
      ok: false,
      error: { field: 'domain', code: 'invalid_format' },
    });
    expect(await new BlockDomain(world).execute({ actor: root, domain: '' })).toEqual({
      ok: false,
      error: { field: 'domain', code: 'required' },
    });
  });

  it('refuses a new Google account at a blocked domain', async () => {
    const world = protectionWorld();
    const root = await rootIn(world);
    valueOf(await new BlockDomain(world).execute({ actor: root, domain: 'gmail.com' }));
    expect(
      await new SignInWithGoogle(world).execute({
        code: 'good-code',
        redirectUri: 'https://app/cb',
        language: 'en',
        defaultSchoolName: 'My School',
      }),
    ).toEqual(refused('blocked_domain'));
  });
});

describe('AI use in the super admin user list', () => {
  it('shows each account’s AI drafts in the last 30 days and flags heavy use', async () => {
    const world = protectionWorld();
    const root = await rootIn(world);
    const { user: busy } = await signedUp(world, 'busy@school.edu');
    const { user: calm } = await signedUp(world, 'calm@school.edu');
    const job = (ownerId: UserId, schoolId: SchoolId) =>
      world.jobs.enqueue({ schoolId, ownerId, kind: 'assistant.generate', payload: {} });
    await job(calm.id, calm.schoolId);
    advanceDays(world, aiUsageWindowDays + 1);
    for (let i = 0; i < 150; i += 1) await job(busy.id, busy.schoolId);
    await job(calm.id, calm.schoolId);

    const rows = valueOf(await new ListAllUsers(world).execute({ actor: root }));
    const row = (id: UserId) => rows.find((r) => r.user.id === id);
    expect(row(busy.id)).toMatchObject({ aiDrafts: 150, heavyAiUse: true });
    expect(row(calm.id)).toMatchObject({ aiDrafts: 1, heavyAiUse: false });
    expect(row(root.id)).toMatchObject({ aiDrafts: 0, heavyAiUse: false });
  });
});

describe('Super admin protections refuse everyone else', () => {
  it('refuses teachers and school admins', async () => {
    const world: ProtectionWorld = protectionWorld();
    const { user: teacher } = await signedUp(world, 'tina@school.edu');
    const { user: other } = await signedUp(world, 'omar@school.edu');
    const principal: User = { ...teacher, role: 'school_admin' };
    const target = { schoolId: other.schoolId, userId: other.id };
    for (const actor of [teacher, principal]) {
      for (const run of [
        () => new SuspendUser(world).execute({ actor, ...target }),
        () => new ReinstateUser(world).execute({ actor, ...target }),
        () => new BlockDomain(world).execute({ actor, domain: 'school.edu' }),
        () => new UnblockDomain(world).execute({ actor, domain: 'school.edu' }),
        () => new ListBlockedDomains(world).execute({ actor }),
        () => new ListAllUsers(world).execute({ actor }),
      ]) {
        expect(await run()).toEqual(refused('forbidden'));
      }
    }
    expect((await world.users.findById(other.schoolId, other.id))?.suspendedAt).toBeNull();
    expect(await world.blockedDomains.list()).toEqual([]);
  });
});
