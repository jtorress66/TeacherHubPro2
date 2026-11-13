import type { MessageKey } from '@thp/i18n';

export interface MicrosoftNotice {
  readonly role: 'status' | 'alert';
  readonly key: MessageKey;
}

/** What Connected tools says after connecting Microsoft (or allowing Teams) (the callback's `?microsoft=` outcome). */
const notices: Readonly<Record<string, MicrosoftNotice>> = {
  connected: { role: 'status', key: 'microsoft.connectedNotice' },
  teams: { role: 'status', key: 'teams.allowedNotice' },
  failed: { role: 'alert', key: 'microsoft.failedNotice' },
  microsoft_failed: { role: 'alert', key: 'microsoft.failedNotice' },
  microsoft_admin_approval: { role: 'alert', key: 'errors.microsoft_admin_approval' },
  teams_admin_approval: { role: 'alert', key: 'errors.teams_admin_approval' },
  teams_school_account: { role: 'alert', key: 'errors.teams_school_account' },
  teams_declined: { role: 'alert', key: 'errors.teams_declined' },
};

export function microsoftNotice(outcome: string | undefined): MicrosoftNotice | null {
  return outcome !== undefined && Object.hasOwn(notices, outcome)
    ? (notices[outcome] ?? null)
    : null;
}
