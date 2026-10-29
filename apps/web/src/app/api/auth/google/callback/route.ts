import { NextResponse, type NextRequest } from 'next/server';
import { sessionLifetimeDays } from '@thp/domain';
import { createTranslator, defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../container.ts';
import {
  decodeOAuthState,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../../../../server/cookies.ts';

export const dynamic = 'force-dynamic';

/** Google sends the browser back here with a code; the state must match the one we set. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  const saved = decodeOAuthState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const locale = saved?.locale ?? defaultLocale;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const failed = (reason: string) => {
    const response = NextResponse.redirect(`${app.appUrl}/${locale}/login?error=${reason}`);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  };
  if (saved === null || code === null || state !== saved.state) return failed('google_failed');

  const result = await app.signInWithGoogle.execute({
    code,
    redirectUri: `${app.appUrl}/api/auth/google/callback`,
    language: locale,
    defaultSchoolName: createTranslator(locale)('defaults.schoolName'),
  });
  if (!result.ok) return failed(result.error.code);

  const response = NextResponse.redirect(`${app.appUrl}/${locale}/app`);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  const expires = new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000);
  response.cookies.set(
    SESSION_COOKIE,
    result.value.sessionToken,
    sessionCookieOptions(app.appUrl, expires),
  );
  return response;
}
