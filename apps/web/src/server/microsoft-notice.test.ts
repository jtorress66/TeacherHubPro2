import { describe, expect, it } from 'vitest';
import { microsoftNotice } from './microsoft-notice.ts';

describe('microsoftNotice', () => {
  it('confirms a connection, and Teams when it was allowed', () => {
    expect(microsoftNotice('connected')).toEqual({
      role: 'status',
      key: 'microsoft.connectedNotice',
    });
    expect(microsoftNotice('teams')).toEqual({ role: 'status', key: 'teams.allowedNotice' });
  });

  it("names the fix when Microsoft refused: the school's administrator, a school account, or try again", () => {
    for (const code of [
      'microsoft_admin_approval',
      'teams_admin_approval',
      'teams_school_account',
      'teams_declined',
    ] as const) {
      expect(microsoftNotice(code)).toEqual({ role: 'alert', key: `errors.${code}` });
    }
    expect(microsoftNotice('failed')).toEqual({ role: 'alert', key: 'microsoft.failedNotice' });
    expect(microsoftNotice('microsoft_failed')).toEqual({
      role: 'alert',
      key: 'microsoft.failedNotice',
    });
  });

  it('shows nothing for no outcome or an unknown one', () => {
    expect(microsoftNotice(undefined)).toBeNull();
    expect(microsoftNotice('errors.not_found')).toBeNull();
  });
});
