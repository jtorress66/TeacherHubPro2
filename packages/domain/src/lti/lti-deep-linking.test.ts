import { describe, expect, it } from 'vitest';
import type { AssignmentId, GameId } from '../shared/ids.ts';
import { ltiClaim } from './lti-claims.ts';
import {
  deepLinkingResponse,
  placedItemOf,
  readDeepLinkingSettings,
  type LtiPlacedItem,
} from './lti-deep-linking.ts';

const settings = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  deep_link_return_url: 'https://lms.lincoln.edu/courses/9/deep_linking_response',
  accept_types: ['link', 'ltiResourceLink'],
  accept_presentation_document_targets: ['iframe', 'window'],
  accept_multiple: true,
  data: 'opaque-value-1',
  ...overrides,
});

describe('readDeepLinkingSettings', () => {
  it('keeps where to return, whether several items are accepted and the data to hand back', () => {
    expect(readDeepLinkingSettings(settings())).toEqual({
      ok: true,
      value: {
        returnUrl: 'https://lms.lincoln.edu/courses/9/deep_linking_response',
        acceptMultiple: true,
        data: 'opaque-value-1',
      },
    });
  });

  it('accepts one item only, and no data, unless the course system says otherwise', () => {
    const checked = readDeepLinkingSettings(
      settings({ accept_multiple: undefined, data: undefined }),
    );
    expect(checked).toEqual({
      ok: true,
      value: {
        returnUrl: 'https://lms.lincoln.edu/courses/9/deep_linking_response',
        acceptMultiple: false,
        data: null,
      },
    });
    const notBoolean = readDeepLinkingSettings(settings({ accept_multiple: 'true', data: 7 }));
    expect(notBoolean.ok && notBoolean.value).toMatchObject({ acceptMultiple: false, data: null });
  });

  it('hands the data back exactly as it came, spaces and all', () => {
    const checked = readDeepLinkingSettings(settings({ data: ' a b ' }));
    expect(checked.ok && checked.value.data).toBe(' a b ');
  });

  it('accepts this computer’s address in development and tests', () => {
    const checked = readDeepLinkingSettings(
      settings({ deep_link_return_url: 'http://localhost:3100/api/test-lms/deep-link-return' }),
    );
    expect(checked.ok).toBe(true);
  });

  it('refuses settings without a safe address to return to', () => {
    for (const url of [undefined, '', 'http://lms.lincoln.edu/return', 'not a url', 7]) {
      expect(readDeepLinkingSettings(settings({ deep_link_return_url: url }))).toEqual({
        ok: false,
        error: 'invalid_return_url',
      });
    }
    for (const value of [undefined, null, 'settings', ['a']]) {
      expect(readDeepLinkingSettings(value)).toEqual({ ok: false, error: 'invalid_return_url' });
    }
  });

  it('refuses a course system that does not take links to a tool', () => {
    for (const types of [['link', 'file'], [], 'ltiResourceLink', undefined]) {
      expect(readDeepLinkingSettings(settings({ accept_types: types }))).toEqual({
        ok: false,
        error: 'links_not_accepted',
      });
    }
  });
});

describe('placedItemOf', () => {
  it('reads the assignment or game a placed link opens', () => {
    expect(placedItemOf({ thp_kind: 'assignment', thp_id: 'a-1' })).toEqual({
      kind: 'assignment',
      id: 'a-1',
    });
    expect(placedItemOf({ thp_kind: 'game', thp_id: 'game_7', other: 'x' })).toEqual({
      kind: 'game',
      id: 'game_7',
    });
  });

  it('reads nothing from links that are not ours or do not say what they open', () => {
    for (const custom of [
      undefined,
      null,
      'thp_kind=game',
      {},
      { thp_kind: 'lesson', thp_id: 'a-1' },
      { thp_kind: 'game' },
      { thp_kind: 'game', thp_id: '' },
      { thp_kind: 'game', thp_id: 7 },
      { thp_kind: 'game', thp_id: '../admin' },
      { thp_kind: 'game', thp_id: 'x'.repeat(101) },
      { thp_kind: 'game', thp_id: '$Canvas.course.id' },
    ]) {
      expect(placedItemOf(custom)).toBeNull();
    }
  });
});

describe('deepLinkingResponse', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const seconds = now.getTime() / 1000;
  const assignment: LtiPlacedItem = { kind: 'assignment', id: 'a-1' as AssignmentId };
  const game: LtiPlacedItem = { kind: 'game', id: 'g-2' as GameId };
  const input = {
    platform: { issuer: 'https://lms.lincoln.edu', clientId: 'client-1' },
    deploymentId: 'dep-2',
    data: 'opaque-value-1',
    items: [
      { title: 'Space quiz', item: assignment },
      { title: 'Planets', item: game },
    ],
    launchUrl: 'https://app.teacherhub.test/api/lti/launch',
    nonce: 'nonce-9',
    now,
  };

  it('answers the course system as the tool, for five minutes, with each chosen item', () => {
    expect(deepLinkingResponse(input)).toEqual({
      iss: 'client-1',
      aud: 'https://lms.lincoln.edu',
      iat: seconds,
      exp: seconds + 300,
      nonce: 'nonce-9',
      [ltiClaim.messageType]: 'LtiDeepLinkingResponse',
      [ltiClaim.version]: '1.3.0',
      [ltiClaim.deploymentId]: 'dep-2',
      [ltiClaim.contentItems]: [
        {
          type: 'ltiResourceLink',
          title: 'Space quiz',
          url: 'https://app.teacherhub.test/api/lti/launch',
          custom: { thp_kind: 'assignment', thp_id: 'a-1' },
          window: { targetName: '_blank' },
        },
        {
          type: 'ltiResourceLink',
          title: 'Planets',
          url: 'https://app.teacherhub.test/api/lti/launch',
          custom: { thp_kind: 'game', thp_id: 'g-2' },
          window: { targetName: '_blank' },
        },
      ],
      [ltiClaim.deepLinkingData]: 'opaque-value-1',
    });
  });

  it('leaves the data out when the course system sent none', () => {
    const claims = deepLinkingResponse({ ...input, data: null });
    expect(claims).not.toHaveProperty([ltiClaim.deepLinkingData]);
  });

  it('round-trips each item through its custom parameters', () => {
    const claims = deepLinkingResponse(input);
    const items = claims[ltiClaim.contentItems] as readonly { custom: unknown }[];
    expect(items.map((item) => placedItemOf(item.custom))).toEqual([assignment, game]);
  });
});
