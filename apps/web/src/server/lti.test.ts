import { describe, expect, it } from 'vitest';
import type { LtiErrorCode } from '@thp/application';
import type { AssignmentId, ClassId, GameId, LtiPlatformId, SchoolId } from '@thp/domain';
import {
  afterLinkPath,
  afterLogInPath,
  decodeLtiLogin,
  encodeLtiLogin,
  ltiCourseOption,
  readLtiCourseOption,
  localeFromLti,
  ltiItemPath,
  ltiLinkCookieOptions,
  ltiLoginCookieOptions,
  ltiPlaceCookieOptions,
  ltiPlaceErrorKey,
  ltiPlaceProblemFor,
  ltiProblemFor,
  ltiProblemFrom,
  ltiToolValues,
  parseLtiLogin,
  placedItemValue,
  readPlacedItems,
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

describe('content placed in a course', () => {
  it('keeps the choice ticket for thirty minutes, for the whole site', () => {
    expect(ltiPlaceCookieOptions('https://teacherhubpro.com')).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1800,
    });
    expect(ltiPlaceCookieOptions('http://localhost:3100').secure).toBe(false);
  });

  it('opens a placed assignment or game on its own page', () => {
    expect(
      ltiItemPath('es', {
        kind: 'assignment',
        classId: 'class-1' as ClassId,
        assignmentId: 'a-1' as AssignmentId,
      }),
    ).toBe('/es/app/classes/class-1/assignments/a-1');
    expect(ltiItemPath('fr', { kind: 'game', gameId: 'g-1' as GameId })).toBe('/fr/app/games/g-1');
  });

  it('names each item in one form value and reads the chosen ones back', () => {
    const quiz = { kind: 'assignment', id: 'a-1' as AssignmentId } as const;
    const planets = { kind: 'game', id: 'g-1' as GameId } as const;
    expect(readPlacedItems([placedItemValue(quiz), placedItemValue(planets)])).toEqual([
      quiz,
      planets,
    ]);
    expect(readPlacedItems(['lesson:x', 'game:', 'game:../x', 'nonsense', 7, null])).toEqual([]);
  });

  it('goes on to the picker after linking while a choice is waiting', () => {
    expect(afterLinkPath('de', true)).toBe('/de/app/lti/place');
    expect(afterLinkPath('de', false)).toBe('/de/app');
  });

  it('explains why content could not be listed or placed', () => {
    expect(ltiPlaceProblemFor('forbidden')).toBe('other_account');
    expect(ltiPlaceProblemFor('link_expired')).toBe('expired');
    expect(ltiPlaceProblemFor('unknown_platform')).toBe('not_set_up');
    expect(ltiPlaceErrorKey('nothing_chosen')).toBe('lti.placeNothingChosen');
    expect(ltiPlaceErrorKey('too_many_items')).toBe('lti.placeTooMany');
    expect(ltiPlaceErrorKey('not_placeable')).toBe('lti.placeNotPlaceable');
    expect(ltiPlaceErrorKey('forbidden')).toBe('lti.problem_other_account');
    expect(ltiPlaceErrorKey('link_expired')).toBe('lti.problem_expired');
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
