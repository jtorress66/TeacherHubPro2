import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import {
  MICROSOFT_OAUTH_COOKIE,
  encodePkceOAuth,
  oauthStateCookieOptions,
} from '../../../../server/cookies.ts';
import { codeChallenge } from '../../../../server/pkce.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/**
 * Starts connecting Microsoft: remembers a random state and PKCE verifier in a short-lived
 * cookie, then asks Microsoft for consent with the verifier's challenge. With `teams=1` (and
 * Teams switched on), it also asks for Teams.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(requested) ? requested : defaultLocale;
  await requireUser(locale);
  const app = getAppContainer();
  if (app.microsoft === null) return new NextResponse(null, { status: 404 });
  const teams = app.teams !== null && request.nextUrl.searchParams.get('teams') === '1';
  const state = app.tokens.generate();
  const verifier = app.tokens.generate();
  const response = NextResponse.redirect(
    app.microsoft.startConnect.execute({
      state,
      codeChallenge: codeChallenge(verifier),
      redirectUri: `${app.appUrl}/api/microsoft/callback`,
      teams,
    }),
  );
  response.cookies.set(
    MICROSOFT_OAUTH_COOKIE,
    encodePkceOAuth({ state, verifier, locale, teams }),
    oauthStateCookieOptions(app.appUrl),
  );
  return response;
}
