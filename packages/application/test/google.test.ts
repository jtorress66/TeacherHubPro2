import { describe, expect, it } from 'vitest';
import type { Email } from '@thp/domain';
import { SignInWithGoogle } from '../src/index.ts';
import { googleProfile, makeWorld, signedUp } from './world.ts';

const input = (code = 'good-code') => ({
  code,
  redirectUri: 'https://app.teacherhub.test/api/auth/google/callback',
  language: 'en',
  defaultSchoolName: 'My School',
});

describe('SignInWithGoogle', () => {
  it('creates an account with its own school and a trial for a new Google user', async () => {
    const world = makeWorld();

    const result = await new SignInWithGoogle(world).execute(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.user).toMatchObject({
      email: googleProfile.email,
      name: 'Ana Google',
      picture: googleProfile.picture,
      role: 'teacher',
      language: 'en',
    });
    expect(result.value.school.name).toBe('My School');
    expect(result.value.subscription.status).toBe('trialing');
    expect(result.value.created).toBe(true);
    expect(await world.credentials.findByUserId(result.value.user.id)).toBeNull();
  });

  it('signs an existing user with the same verified email into the same account', async () => {
    const world = makeWorld();
    const existing = await signedUp(world, googleProfile.email);

    const result = await new SignInWithGoogle(world).execute(input());

    expect(result.ok && result.value.user.id).toBe(existing.user.id);
    expect(result.ok && result.value.created).toBe(false);
    expect(result.ok && result.value.user.picture).toBe(googleProfile.picture);
  });

  it('refuses an email Google has not verified', async () => {
    expect(await new SignInWithGoogle(makeWorld()).execute(input('unverified-code'))).toEqual({
      ok: false,
      error: { code: 'google_email_unverified' },
    });
  });

  it('refuses a code Google rejects', async () => {
    expect(await new SignInWithGoogle(makeWorld()).execute(input('bad-code'))).toEqual({
      ok: false,
      error: { code: 'google_failed' },
    });
  });

  it('keeps a picture the user already has', async () => {
    const world = makeWorld();
    const existing = await signedUp(world, googleProfile.email);
    await world.users.save({ ...existing.user, picture: 'https://own/picture.png' });

    const result = await new SignInWithGoogle(world).execute(input());
    expect(result.ok && result.value.user.picture).toBe('https://own/picture.png');
  });

  it('uses the email as the name when Google gives none', async () => {
    const world = makeWorld();
    world.google = new (
      world.google.constructor as typeof import('@thp/testing').FakeGoogleIdentity
    )({
      'good-code': { ...googleProfile, name: '', email: 'noname@gmail.com' as Email },
    });

    const result = await new SignInWithGoogle(world).execute(input());
    expect(result.ok && result.value.user.name).toBe('noname@gmail.com');
  });
});
