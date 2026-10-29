import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../container.ts';
import {
  encodeOAuthState,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from '../../../../../server/cookies.ts';

export const dynamic = 'force-dynamic';

/** Starts Google sign-in: remembers a random state in a cookie, then sends the browser to Google. */
export function GET(request: NextRequest): NextResponse {
  const app = getAppContainer();
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(requested) ? requested : defaultLocale;
  const state = app.tokens.generate();
  const response = NextResponse.redirect(
    app.google.authorizationUrl(state, `${app.appUrl}/api/auth/google/callback`),
  );
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    encodeOAuthState(state, locale),
    oauthStateCookieOptions(app.appUrl),
  );
  return response;
}
