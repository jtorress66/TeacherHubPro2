import { describe, expect, it } from 'vitest';
import type { LtiPlatformId, SchoolId } from '../shared/ids.ts';
import { createLtiPlatform, type LtiPlatformInput } from './lti-platform.ts';

const id = 'platform-1' as LtiPlatformId;
const now = new Date('2026-11-12T12:00:00Z');

const input = (overrides: Partial<LtiPlatformInput> = {}): LtiPlatformInput => ({
  schoolId: 'school-1' as SchoolId,
  name: '  Lincoln Canvas  ',
  issuer: ' https://lms.lincoln.edu ',
  clientId: ' 10000000000001 ',
  deploymentIds: ' 1:abc , 2:def ',
  authLoginUrl: 'https://lms.lincoln.edu/api/lti/authorize_redirect',
  authTokenUrl: 'https://lms.lincoln.edu/login/oauth2/token',
  jwksUrl: 'https://lms.lincoln.edu/api/lti/security/jwks',
  ...overrides,
});

describe('createLtiPlatform', () => {
  it('records a school’s course system, trimmed, with its deployments split on commas', () => {
    expect(createLtiPlatform(input(), id, now)).toEqual({
      ok: true,
      value: {
        id,
        schoolId: 'school-1',
        name: 'Lincoln Canvas',
        issuer: 'https://lms.lincoln.edu',
        clientId: '10000000000001',
        deploymentIds: ['1:abc', '2:def'],
        authLoginUrl: 'https://lms.lincoln.edu/api/lti/authorize_redirect',
        authTokenUrl: 'https://lms.lincoln.edu/login/oauth2/token',
        jwksUrl: 'https://lms.lincoln.edu/api/lti/security/jwks',
        createdAt: now,
      },
    });
  });

  it('accepts deployments as a list, dropping blanks and repeats', () => {
    const made = createLtiPlatform(input({ deploymentIds: [' a ', '', 'b', 'a'] }), id, now);
    expect(made.ok && made.value.deploymentIds).toEqual(['a', 'b']);
  });

  it.each([
    ['name', { name: '  ' }, 'required'],
    ['issuer', { issuer: '' }, 'required'],
    ['clientId', { clientId: ' ' }, 'required'],
    ['deploymentIds', { deploymentIds: ' , ' }, 'required'],
    ['deploymentIds', { deploymentIds: [] }, 'required'],
    ['deploymentIds', { deploymentIds: 'x'.repeat(256) }, 'too_long'],
    ['issuer', { issuer: 'x'.repeat(501) }, 'too_long'],
    ['authLoginUrl', { authLoginUrl: '' }, 'required'],
    ['authLoginUrl', { authLoginUrl: 'not a url' }, 'invalid_format'],
    ['authTokenUrl', { authTokenUrl: 'http://lms.lincoln.edu/token' }, 'invalid_format'],
    ['jwksUrl', { jwksUrl: 'ftp://lms.lincoln.edu/jwks' }, 'invalid_format'],
  ] as const)('refuses a bad %s', (field, overrides, code) => {
    expect(createLtiPlatform(input(overrides), id, now)).toEqual({
      ok: false,
      error: { field, code },
    });
  });

  it('refuses more than 50 deployments', () => {
    const many = Array.from({ length: 51 }, (_, index) => `d${String(index)}`);
    expect(createLtiPlatform(input({ deploymentIds: many }), id, now)).toEqual({
      ok: false,
      error: { field: 'deploymentIds', code: 'too_long' },
    });
  });

  it('allows plain http only for this computer, for testing', () => {
    for (const host of ['localhost:3100', '127.0.0.1']) {
      const made = createLtiPlatform(input({ jwksUrl: `http://${host}/jwks` }), id, now);
      expect(made.ok).toBe(true);
    }
    expect(
      createLtiPlatform(input({ jwksUrl: 'http://localhost.evil.com/jwks' }), id, now),
    ).toEqual({ ok: false, error: { field: 'jwksUrl', code: 'invalid_format' } });
  });
});
