import { describe, expect, it } from 'vitest';
import type { LtiErrorCode } from '@thp/application';
import type { LtiPlatformId, SchoolId } from '@thp/domain';
import {
  afterLogInPath,
  decodeLtiLogin,
  encodeLtiLogin,
  ltiCourseOption,
  readLtiCourseOption,
  localeFromLti,
  ltiLinkCookieOptions,
  ltiLoginCookieOptions,
  ltiProblemFor,
  ltiProblemFrom,
  ltiToolValues,
  parseLtiLogin,
} from './lti.ts';

describe('parseLtiLogin', () => {
  it('reads a course system’s login request, from a query or a form', () => {
    const query = new URLSearchParams({
      iss: ' https://lms.example.edu ',
      login_hint: 'hint',
      target_link_uri: 'https://app.test/api/lti/launch',
      lti_message_hint: 'message',
      client_id: 'client-1',
      lti_deployment_id: 'dep-1',
    });
    expect(parseLtiLogin(query)).toEqual({
      issuer: 'https://lms.example.edu',
      loginHint: 'hint',
      targetLinkUri: 'https://app.test/api/lti/launch',
      ltiMessageHint: 'message',
      clientId: 'client-1',
      deploymentId: 'dep-1',
    });
    const form = new FormData();
    form.set('iss', 'https://lms.example.edu');
    form.set('login_hint', 'hint');
    form.set('target_link_uri', 'https://app.test/');
    expect(parseLtiLogin(form)).toEqual({
      issuer: 'https://lms.example.edu',
      loginHint: 'hint',
      targetLinkUri: 'https://app.test/',
      ltiMessageHint: null,
      clientId: null,
      deploymentId: null,
    });
  });

  it('refuses a request without the issuer, login hint or target', () => {
    expect(parseLtiLogin(new URLSearchParams({ iss: 'x', login_hint: 'h' }))).toBeNull();
    expect(
      parseLtiLogin(new URLSearchParams({ iss: ' ', login_hint: 'h', target_link_uri: 't' })),
    ).toBeNull();
  });
});

describe('the login cookie', () => {
  const saved = {
    state: 'state-1',
    nonce: 'nonce-1',
    platformId: 'platform.1' as LtiPlatformId,
    schoolId: 'school-1' as SchoolId,
  };

  it('keeps the state, nonce and platform between the login and the launch', () => {
    expect(decodeLtiLogin(encodeLtiLogin(saved))).toEqual(saved);
  });

  it('reads nothing from a missing or changed cookie', () => {
    expect(decodeLtiLogin(undefined)).toBeNull();
    expect(decodeLtiLogin('garbage')).toBeNull();
    expect(decodeLtiLogin(Buffer.from('{"state":1}').toString('base64url'))).toBeNull();
    expect(decodeLtiLogin(Buffer.from('[]').toString('base64url'))).toBeNull();
  });

  it('crosses sites over https (the launch is a cross-site form post), lax on plain http', () => {
    expect(ltiLoginCookieOptions('https://teacherhubpro.com')).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/api/lti',
      maxAge: 600,
    });
    expect(ltiLoginCookieOptions('http://localhost:3100')).toMatchObject({
      secure: false,
      sameSite: 'lax',
    });
  });

  it('keeps the link ticket for fifteen minutes, for the whole site', () => {
    expect(ltiLinkCookieOptions('https://teacherhubpro.com')).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });
  });
});

describe('LTI pages', () => {
  it('shows each refusal as one of a few friendly problems', () => {
    const cases: [LtiErrorCode, string][] = [
      ['unknown_platform', 'not_set_up'],
      ['ambiguous_platform', 'not_set_up'],
      ['unknown_deployment', 'not_set_up'],
      ['link_expired', 'expired'],
      ['state_mismatch', 'expired'],
      ['replayed', 'expired'],
      ['expired', 'expired'],
      ['account_suspended', 'suspended'],
      ['forbidden', 'wrong_school'],
      ['invalid_token', 'failed'],
      ['wrong_audience', 'failed'],
      ['invalid_request', 'failed'],
    ];
    for (const [code, problem] of cases) expect(ltiProblemFor(code)).toBe(problem);
  });

  it('accepts only known problems from an address', () => {
    expect(ltiProblemFrom('expired')).toBe('expired');
    expect(ltiProblemFrom('<script>')).toBe('failed');
    expect(ltiProblemFrom(undefined)).toBe('failed');
  });

  it('speaks the course system’s language when it is one of ours', () => {
    expect(localeFromLti('es-PR')).toBe('es');
    expect(localeFromLti('zh_Hans')).toBe('zh');
    expect(localeFromLti('FR')).toBe('fr');
    expect(localeFromLti('ja-JP')).toBe('en');
    expect(localeFromLti(null)).toBe('en');
  });

  it('returns to the linking page after logging in while a link is waiting', () => {
    expect(afterLogInPath('es', true)).toBe('/es/lti/link');
    expect(afterLogInPath('es', false)).toBe('/es/app');
  });

  it('lists the values a school’s IT team pastes into its course system', () => {
    expect(ltiToolValues('https://teacherhubpro.com')).toEqual({
      loginUrl: 'https://teacherhubpro.com/api/lti/login',
      launchUrl: 'https://teacherhubpro.com/api/lti/launch',
      jwksUrl: 'https://teacherhubpro.com/api/lti/jwks',
      domain: 'teacherhubpro.com',
    });
  });
});

describe('ltiCourseOption and readLtiCourseOption', () => {
  it('names a teacher’s course in one form value and reads it back', () => {
    const course = { platformId: 'p-1' as LtiPlatformId, contextId: 'course 9, "spring"/A' };

    expect(readLtiCourseOption(ltiCourseOption(course))).toEqual(course);
  });

  it('reads nothing from a value it did not make', () => {
    for (const value of [
      '',
      'garbage',
      '%%%',
      null,
      Buffer.from('{"a":1}').toString('base64url'),
    ]) {
      expect(readLtiCourseOption(value)).toBeNull();
    }
  });
});
