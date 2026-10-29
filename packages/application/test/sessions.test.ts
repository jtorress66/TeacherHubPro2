import { describe, expect, it } from 'vitest';
import { InMemorySubscriptionRepository, InMemoryUserRepository } from '@thp/testing';
import { AuthenticateSession, LogIn, LogOut } from '../src/index.ts';
import { advanceDays, makeWorld, password, signedUp } from './world.ts';

describe('LogIn', () => {
  it('signs in with the right password and starts a new session', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);

    const result = await new LogIn(world).execute({ email: ' ANA@school.edu ', password });

    expect(result.ok && result.value.user.id).toBe(user.id);
    expect(world.sessions.all()).toHaveLength(2);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const world = makeWorld();
    await signedUp(world);
    const logIn = new LogIn(world);
    const refused = { ok: false, error: { code: 'invalid_credentials' } };

    expect(await logIn.execute({ email: 'ana@school.edu', password: 'wrong password!' })).toEqual(refused);
    expect(await logIn.execute({ email: 'nobody@school.edu', password })).toEqual(refused);
    expect(await logIn.execute({ email: 'not an email', password })).toEqual(refused);
  });

  it('still checks a password hash when the email is unknown, so timing does not reveal accounts', async () => {
    const world = makeWorld();
    const checked: string[] = [];
    const verify = world.passwordHasher.verify.bind(world.passwordHasher);
    world.passwordHasher.verify = (candidate, hash) => {
      checked.push(hash);
      return verify(candidate, hash);
    };

    await new LogIn(world).execute({ email: 'nobody@school.edu', password });

    expect(checked).toHaveLength(1);
  });

  it('refuses a password sign-in for an account created with Google', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    world.credentials = new (world.credentials.constructor as new () => typeof world.credentials)();

    expect(await new LogIn(world).execute({ email: user.email, password })).toEqual({
      ok: false,
      error: { code: 'invalid_credentials' },
    });
  });

  it('upgrades an old password hash after a successful sign-in', async () => {
    const world = makeWorld();
    const { user } = await signedUp(world);
    await world.credentials.save({ userId: user.id, passwordHash: `legacy$${password}` });

    await new LogIn(world).execute({ email: user.email, password });

    const credential = await world.credentials.findByUserId(user.id);
    expect(credential?.passwordHash.startsWith('fake$')).toBe(true);
  });
});

describe('AuthenticateSession', () => {
  it('turns a session token into the teacher, their school and their access', async () => {
    const world = makeWorld();
    const { user, school, subscription, sessionToken } = await signedUp(world);

    expect(await new AuthenticateSession(world).execute(sessionToken)).toEqual({
      ok: true,
      value: { user, school, subscription, access: { hasAccess: true, trialDaysLeft: 7 } },
    });
  });

  it('refuses an unknown token', async () => {
    expect(await new AuthenticateSession(makeWorld()).execute('token-nope')).toEqual({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('deletes an expired session and asks the teacher to sign in again', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world);
    advanceDays(world, 31);

    expect(await new AuthenticateSession(world).execute(sessionToken)).toEqual({
      ok: false,
      error: { code: 'session_expired' },
    });
    expect(world.sessions.all()).toHaveLength(0);
  });

  it('reports that access has ended once the trial is over', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world);
    advanceDays(world, 8);

    const result = await new AuthenticateSession(world).execute(sessionToken);
    expect(result.ok && result.value.access).toEqual({ hasAccess: false, trialDaysLeft: 0 });
  });
});

describe('AuthenticateSession edge cases', () => {
  it('refuses a session whose user no longer exists', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world);
    world.users = new InMemoryUserRepository();

    expect(await new AuthenticateSession(world).execute(sessionToken)).toEqual({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('gives no access to a school without a subscription', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world);
    world.subscriptions = new InMemorySubscriptionRepository();

    const result = await new AuthenticateSession(world).execute(sessionToken);
    expect(result.ok && result.value).toMatchObject({
      subscription: null,
      access: { hasAccess: false, trialDaysLeft: null },
    });
  });
});

describe('LogOut', () => {
  it('deletes the session so the token no longer works', async () => {
    const world = makeWorld();
    const { sessionToken } = await signedUp(world);

    await new LogOut(world).execute(sessionToken);

    expect((await new AuthenticateSession(world).execute(sessionToken)).ok).toBe(false);
  });
});
