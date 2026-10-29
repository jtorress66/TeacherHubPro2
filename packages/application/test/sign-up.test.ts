import { describe, expect, it } from 'vitest';
import { SignUp } from '../src/index.ts';
import { makeWorld, password, signUpInput, signedUp } from './world.ts';

describe('SignUp', () => {
  it('creates a teacher, their own school, a 7-day trial, a password and a session', async () => {
    const world = makeWorld();
    const { user, school, subscription, sessionToken } = await signedUp(world);

    expect(user).toMatchObject({ email: 'ana@school.edu', name: 'Ana López', role: 'teacher' });
    expect(user.schoolId).toBe(school.id);
    expect(school.name).toBe('Mi escuela');
    expect(subscription).toMatchObject({
      schoolId: school.id,
      ownerId: user.id,
      status: 'trialing',
      trialEndsAt: new Date('2026-09-08T08:00:00.000Z'),
    });
    expect(await world.users.findById(school.id, user.id)).toEqual(user);
    expect(await world.schools.findById(school.id)).toEqual(school);
    expect(await world.subscriptions.findById(school.id, subscription.id)).toEqual(subscription);
    const credential = await world.credentials.findByUserId(user.id);
    expect(credential && (await world.passwordHasher.verify(password, credential.passwordHash))).toBe(
      true,
    );
    expect(sessionToken).toMatch(/^token-/);
  });

  it('uses the language of the page the teacher signed up on', async () => {
    const { user } = await signedUp(makeWorld());
    expect(user.language).toBe('es');
  });

  it('never stores the raw session token, only its hash', async () => {
    const world = makeWorld();
    const { sessionToken, user } = await signedUp(world);

    const stored = world.sessions.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(await world.tokenHasher.hash(sessionToken));
    expect(stored[0]?.tokenHash).not.toContain(sessionToken);
    expect(stored[0]?.userId).toBe(user.id);
  });

  it('refuses an email that already has an account, whatever its case', async () => {
    const world = makeWorld();
    await signedUp(world);

    expect(await new SignUp(world).execute(signUpInput('ANA@School.edu'))).toEqual({
      ok: false,
      error: { code: 'email_taken' },
    });
  });

  it('refuses a weak password, a bad email and a blank name', async () => {
    const signUp = new SignUp(makeWorld());

    expect(await signUp.execute({ ...signUpInput(), password: 'short' })).toEqual({
      ok: false,
      error: { field: 'password', code: 'too_short' },
    });
    expect(await signUp.execute({ ...signUpInput(), email: 'ana@' })).toEqual({
      ok: false,
      error: { field: 'email', code: 'invalid_format' },
    });
    expect(await signUp.execute({ ...signUpInput(), name: ' ' })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
  });

  it('reports a blank default school name instead of creating a nameless school', async () => {
    const world = makeWorld();
    expect(await new SignUp(world).execute({ ...signUpInput(), defaultSchoolName: ' ' })).toEqual({
      ok: false,
      error: { field: 'name', code: 'required' },
    });
    expect(await world.users.findByEmail(signUpInput().email as never)).toBeNull();
  });

  it('falls back to English for a language the app does not offer', async () => {
    const result = await new SignUp(makeWorld()).execute({ ...signUpInput(), language: 'ru' });
    expect(result.ok && result.value.user.language).toBe('en');
  });
});
