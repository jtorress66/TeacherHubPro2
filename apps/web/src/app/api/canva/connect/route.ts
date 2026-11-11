import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import {
  CANVA_OAUTH_COOKIE,
  encodePkceOAuth,
  oauthStateCookieOptions,
} from '../../../../server/cookies.ts';
import { codeChallenge } from '../../../../server/pkce.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/**
 * Starts connecting Canva: remembers a random state and PKCE verifier in a short-lived cookie,
 * then asks Canva for consent with the verifier's challenge.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(requested) ? requested : defaultLocale;
  await requireUser(locale);
  const app = getAppContainer();
  if (app.canva === null) return new NextResponse(null, { status: 404 });
  const state = app.tokens.generate();
  const verifier = app.tokens.generate();
  const response = NextResponse.redirect(
    app.canva.startConnect.execute({
      state,
      codeChallenge: codeChallenge(verifier),
      redirectUri: `${app.appUrl}/api/canva/callback`,
    }),
  );
  response.cookies.set(
    CANVA_OAUTH_COOKIE,
    encodePkceOAuth({ state, verifier, locale }),
    oauthStateCookieOptions(app.appUrl),
  );
  return response;
}
