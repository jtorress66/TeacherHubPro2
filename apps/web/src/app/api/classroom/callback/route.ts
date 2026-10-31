import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { decodeOAuthState, OAUTH_STATE_COOKIE } from '../../../../server/cookies.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** Google returns here with a code; the state must match. The access is kept encrypted. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  const saved = decodeOAuthState(request.cookies.get(OAUTH_STATE_COOKIE)?.value);
  const locale = saved?.locale ?? defaultLocale;
  const { user } = await requireUser(locale);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const settings = `${app.appUrl}/${locale}/app/settings`;
  const connected =
    saved !== null && code !== null && state === saved.state
      ? await app.finishClassroomConnect.execute({
          actor: user,
          code,
          redirectUri: `${app.appUrl}/api/classroom/callback`,
        })
      : null;
  const response = NextResponse.redirect(
    `${settings}?classroom=${connected?.ok === true ? 'connected' : 'failed'}`,
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
