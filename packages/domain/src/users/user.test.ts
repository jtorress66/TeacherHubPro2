import { describe, expect, it } from 'vitest';
import { type SchoolId, type UserId } from '../shared/ids.ts';
import { errorOf, valueOf } from '../test-support.ts';
import { isAdminOf, roles } from './roles.ts';
import { createUser, markOnboardingStarted, updateProfile } from './user.ts';

const schoolId = 'school-1' as SchoolId;
const otherSchool = 'school-2' as SchoolId;
const base = { id: 'user-1' as UserId, schoolId, email: 'Ana@Mail.com', name: 'Ana López' };

describe('createUser', () => {
  it('defaults to a teacher who speaks English and has not started onboarding', () => {
    expect(valueOf(createUser(base))).toEqual({
      ...base,
      email: 'ana@mail.com',
      role: 'teacher',
      language: 'en',
      picture: null,
      onboardingStatus: 'not_started',
    });
  });

  it('keeps a chosen role, language and picture', () => {
    const user = valueOf(
      createUser({ ...base, role: 'school_admin', language: 'es', picture: 'https://p/a.png' }),
    );

    expect([user.role, user.language, user.picture]).toEqual([
      'school_admin',
      'es',
      'https://p/a.png',
    ]);
  });

  it('rejects an unsupported language, a blank name and a bad email', () => {
    expect(errorOf(createUser({ ...base, language: 'ru' }))).toEqual({
      field: 'language',
      code: 'invalid_format',
    });
    expect(errorOf(createUser({ ...base, name: ' ' }))).toEqual({
      field: 'name',
      code: 'required',
    });
    expect(errorOf(createUser({ ...base, email: 'x' }))).toEqual({
      field: 'email',
      code: 'invalid_format',
    });
  });
});

describe('createUser picture', () => {
  it('rejects a picture address that is not https', () => {
    expect(errorOf(createUser({ ...base, picture: 'ftp://p/a.png' }))).toEqual({
      field: 'picture',
      code: 'invalid_format',
    });
  });
});

describe('roles', () => {
  it('has teacher, school admin and super admin', () => {
    expect([...roles]).toEqual(['teacher', 'school_admin', 'super_admin']);
  });

  it('a school admin administers only their own school', () => {
    const admin = valueOf(createUser({ ...base, role: 'school_admin' }));

    expect(isAdminOf(admin, schoolId)).toBe(true);
    expect(isAdminOf(admin, otherSchool)).toBe(false);
  });

  it('a super admin administers every school and a teacher none', () => {
    const superAdmin = valueOf(createUser({ ...base, role: 'super_admin' }));
    const teacher = valueOf(createUser(base));

    expect(isAdminOf(superAdmin, otherSchool)).toBe(true);
    expect(isAdminOf(teacher, schoolId)).toBe(false);
  });
});

describe('updateProfile', () => {
  it('changes the name, language and picture', () => {
    const user = valueOf(createUser(base));
    expect(
      valueOf(
        updateProfile(user, { name: ' Ana María ', language: 'es', picture: 'https://p/b.png' }),
      ),
    ).toMatchObject({ name: 'Ana María', language: 'es', picture: 'https://p/b.png' });
  });

  it('keeps the picture when none is given', () => {
    const user = valueOf(createUser({ ...base, picture: 'https://p/a.png' }));
    expect(valueOf(updateProfile(user, { name: 'Ana', language: 'en' })).picture).toBe(
      'https://p/a.png',
    );
  });

  it('rejects a blank name and an unsupported language', () => {
    const user = valueOf(createUser(base));
    expect(errorOf(updateProfile(user, { name: '', language: 'en' }))).toEqual({
      field: 'name',
      code: 'required',
    });
    expect(errorOf(updateProfile(user, { name: 'Ana', language: 'ru' }))).toEqual({
      field: 'language',
      code: 'invalid_format',
    });
  });
});

describe('markOnboardingStarted', () => {
  it('moves a new user to in progress and leaves later states alone', () => {
    const user = valueOf(createUser(base));
    expect(markOnboardingStarted(user).onboardingStatus).toBe('in_progress');

    const done = valueOf(createUser({ ...base, onboardingStatus: 'completed' }));
    expect(markOnboardingStarted(done).onboardingStatus).toBe('completed');
  });
});
