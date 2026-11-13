import { describe, expect, it } from 'vitest';
import type { LtiPlatformId, SchoolId } from '../shared/ids.ts';
import { checkLaunch, ltiClaim, ltiRoles } from './lti-launch.ts';
import type { LtiPlatform } from './lti-platform.ts';

const platform: LtiPlatform = {
  id: 'platform-1' as LtiPlatformId,
  schoolId: 'school-1' as SchoolId,
  name: 'Lincoln Canvas',
  issuer: 'https://lms.lincoln.edu',
  clientId: 'client-1',
  deploymentIds: ['dep-1', 'dep-2'],
  authLoginUrl: 'https://lms.lincoln.edu/authorize',
  authTokenUrl: 'https://lms.lincoln.edu/token',
  jwksUrl: 'https://lms.lincoln.edu/jwks',
  createdAt: new Date('2026-11-01T00:00:00Z'),
};

const now = new Date('2026-11-12T12:00:00Z');
const seconds = now.getTime() / 1000;
const ctx = { platform, expectedNonce: 'nonce-1', now };

const claims = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  iss: 'https://lms.lincoln.edu',
  aud: 'client-1',
  sub: 'lms-user-7',
  exp: seconds + 600,
  iat: seconds - 5,
  nonce: 'nonce-1',
  given_name: 'Ana',
  [ltiClaim.version]: '1.3.0',
  [ltiClaim.messageType]: 'LtiResourceLinkRequest',
  [ltiClaim.deploymentId]: 'dep-2',
  [ltiClaim.roles]: [ltiRoles.instructor],
  [ltiClaim.context]: { id: 'course-9', title: 'Science 5' },
  [ltiClaim.resourceLink]: { id: 'link-3' },
  [ltiClaim.launchPresentation]: { locale: 'es-PR' },
  ...overrides,
});

const failsWith = (code: string, overrides: Record<string, unknown>) => {
  expect(checkLaunch(claims(overrides), ctx)).toEqual({ ok: false, error: { code } });
};

describe('checkLaunch', () => {
  it('accepts a teacher’s launch from a registered deployment', () => {
    expect(checkLaunch(claims(), ctx)).toEqual({
      ok: true,
      value: {
        platformId: 'platform-1',
        subject: 'lms-user-7',
        role: 'teacher',
        contextId: 'course-9',
        contextTitle: 'Science 5',
        resourceLinkId: 'link-3',
        givenName: 'Ana',
        locale: 'es-PR',
        expiresAt: new Date((seconds + 600) * 1000),
      },
    });
  });

  it('leaves out what the platform did not send', () => {
    const minimal = claims();
    for (const key of [
      'given_name',
      ltiClaim.context,
      ltiClaim.resourceLink,
      ltiClaim.launchPresentation,
    ]) {
      Reflect.deleteProperty(minimal, key);
    }
    const checked = checkLaunch(minimal, ctx);
    expect(checked.ok && checked.value).toMatchObject({
      contextId: null,
      contextTitle: null,
      resourceLinkId: null,
      givenName: null,
      locale: null,
    });
  });

  it('refuses something that is not a set of claims', () => {
    for (const value of [null, 'token', 42, ['a']]) {
      expect(checkLaunch(value, ctx)).toEqual({ ok: false, error: { code: 'malformed' } });
    }
  });

  it('refuses a launch from another issuer', () => {
    failsWith('wrong_issuer', { iss: 'https://evil.example' });
  });

  it('refuses a launch meant for another tool', () => {
    failsWith('wrong_audience', { aud: 'client-2' });
    failsWith('wrong_audience', { aud: ['client-2', 'client-3'] });
    failsWith('wrong_audience', { aud: 7 });
  });

  it('accepts a list of audiences that names this tool, with the authorized party when several', () => {
    expect(checkLaunch(claims({ aud: ['client-1'] }), ctx).ok).toBe(true);
    expect(checkLaunch(claims({ aud: ['client-1', 'other'], azp: 'client-1' }), ctx).ok).toBe(true);
    failsWith('wrong_authorized_party', { aud: ['client-1', 'other'] });
    failsWith('wrong_authorized_party', { aud: ['client-1', 'other'], azp: 'other' });
  });

  it('refuses an expired token', () => {
    failsWith('expired', { exp: seconds });
    failsWith('expired', { exp: seconds - 60 });
    failsWith('malformed', { exp: 'tomorrow' });
  });

  it('refuses a token issued more than five minutes in the future', () => {
    expect(checkLaunch(claims({ iat: seconds + 300 }), ctx).ok).toBe(true);
    failsWith('issued_in_future', { iat: seconds + 301 });
    failsWith('malformed', { iat: undefined });
  });

  it('refuses a token answering another login', () => {
    failsWith('wrong_nonce', { nonce: 'nonce-2' });
    failsWith('wrong_nonce', { nonce: undefined });
  });

  it('refuses anything but an LTI 1.3 resource link launch', () => {
    failsWith('wrong_version', { [ltiClaim.version]: '1.1' });
    failsWith('wrong_message_type', { [ltiClaim.messageType]: 'LtiDeepLinkingRequest' });
  });

  it('refuses a deployment the school did not register', () => {
    failsWith('unknown_deployment', { [ltiClaim.deploymentId]: 'dep-9' });
    failsWith('unknown_deployment', { [ltiClaim.deploymentId]: undefined });
  });

  it('refuses a launch without a user', () => {
    failsWith('missing_subject', { sub: '' });
    failsWith('missing_subject', { sub: undefined });
  });

  it.each([
    ltiRoles.instructor,
    ltiRoles.administrator,
    ltiRoles.institutionInstructor,
    ltiRoles.institutionAdministrator,
    ltiRoles.institutionFaculty,
  ])('treats %s as a teacher', (role) => {
    const checked = checkLaunch(
      claims({
        [ltiClaim.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner', role],
      }),
      ctx,
    );
    expect(checked.ok && checked.value.role).toBe('teacher');
  });

  it('treats everyone else, or a launch without roles, as a learner', () => {
    for (const roles of [
      ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
      ['Instructor'],
      [],
      'not a list',
      [7],
      undefined,
    ]) {
      const checked = checkLaunch(claims({ [ltiClaim.roles]: roles }), ctx);
      expect(checked.ok && checked.value.role).toBe('learner');
    }
  });

  it('ignores context and link details of the wrong shape', () => {
    const checked = checkLaunch(
      claims({
        [ltiClaim.context]: 'course',
        [ltiClaim.resourceLink]: { id: 5 },
        [ltiClaim.launchPresentation]: { locale: '' },
        given_name: '  ',
      }),
      ctx,
    );
    expect(checked.ok && checked.value).toMatchObject({
      contextId: null,
      contextTitle: null,
      resourceLinkId: null,
      givenName: null,
      locale: null,
    });
  });
});
