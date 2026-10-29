import { describe, expect, it } from 'vitest';
import { logInForm, parseForm, profileForm, schoolForm, signUpForm, upgradeForm } from './forms.ts';

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

describe('parseForm', () => {
  it('reads the sign-up form, defaulting the locale to English', () => {
    expect(parseForm(signUpForm, form({ name: 'Ana', email: 'a@b.co', password: 'pw' }))).toEqual({
      ok: true,
      value: { name: 'Ana', email: 'a@b.co', password: 'pw', locale: 'en' },
    });
  });

  it('keeps a supported locale and ignores an unsupported one', () => {
    const fields = { email: 'a@b.co', password: 'pw' };
    expect(parseForm(logInForm, form({ ...fields, locale: 'es' }))).toMatchObject({
      value: { locale: 'es' },
    });
    expect(parseForm(logInForm, form({ ...fields, locale: 'ru' }))).toMatchObject({
      value: { locale: 'en' },
    });
  });

  it('reports each missing field as required', () => {
    expect(parseForm(logInForm, form({}))).toEqual({
      ok: false,
      error: { email: 'required', password: 'required' },
    });
  });

  it('reads optional school fields as null when blank', () => {
    expect(parseForm(schoolForm, form({ name: 'Escuela Luz', phone: '' }))).toEqual({
      ok: true,
      value: { name: 'Escuela Luz', address: null, phone: null, email: null, locale: 'en' },
    });
  });

  it('reads the profile form', () => {
    expect(parseForm(profileForm, form({ name: 'Ana', language: 'es', locale: 'es' }))).toEqual({
      ok: true,
      value: { name: 'Ana', language: 'es', locale: 'es' },
    });
  });

  it('reads a plan and a whole number of teachers', () => {
    expect(parseForm(upgradeForm, form({ plan: 'school', quantity: '12' }))).toEqual({
      ok: true,
      value: { plan: 'school', quantity: 12, locale: 'en' },
    });
    expect(parseForm(upgradeForm, form({ plan: 'individual_yearly' }))).toMatchObject({
      value: { quantity: 1 },
    });
    expect(parseForm(upgradeForm, form({ plan: 'gold', quantity: 'many' }))).toEqual({
      ok: false,
      error: { plan: 'invalid_format', quantity: 'invalid_format' },
    });
  });
});
