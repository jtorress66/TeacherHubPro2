import { defaultLocale, isLocale } from '@thp/i18n';

/**
 * Where the Google apps menu shortcut leads: a signed-in teacher goes to the dashboard, anyone
 * else straight into Google sign-in (which also creates a new teacher's account), so it is one
 * click from Google to TeacherHubPro.
 */
export function googleLaunchPath(input: {
  readonly hasSession: boolean;
  readonly savedLanguage: string | undefined;
}): string {
  const locale = isLocale(input.savedLanguage) ? input.savedLanguage : defaultLocale;
  return input.hasSession ? `/${locale}/app` : `/api/auth/google/start?locale=${locale}`;
}
