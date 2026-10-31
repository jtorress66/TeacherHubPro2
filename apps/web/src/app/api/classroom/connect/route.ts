import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import {
  encodeOAuthState,
  OAUTH_STATE_COOKIE,
  oauthStateCookieOptions,
} from '../../../../server/cookies.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** Starts connecting Google Classroom: remembers a random state, then asks Google for consent. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(requested) ? requested : defaultLocale;
  await requireUser(locale);
  const app = getAppContainer();
  const state = app.tokens.generate();
  const response = NextResponse.redirect(
    app.startClassroomConnect.execute({
      state,
      redirectUri: `${app.appUrl}/api/classroom/callback`,
    }),
  );
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    encodeOAuthState(state, locale),
    oauthStateCookieOptions(app.appUrl),
  );
  return response;
}
