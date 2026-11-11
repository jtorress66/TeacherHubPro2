import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { MICROSOFT_OAUTH_COOKIE, decodePkceOAuth } from '../../../../server/cookies.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** Microsoft returns here with a code; the state must match. The access is kept encrypted. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  const saved = decodePkceOAuth(request.cookies.get(MICROSOFT_OAUTH_COOKIE)?.value);
  const locale = saved?.locale ?? defaultLocale;
  const { user } = await requireUser(locale);
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const connected =
    app.microsoft !== null && saved !== null && code !== null && state === saved.state
      ? await app.microsoft.finishConnect.execute({
          actor: user,
          code,
          codeVerifier: saved.verifier,
          redirectUri: `${app.appUrl}/api/microsoft/callback`,
        })
      : null;
  const response = NextResponse.redirect(
    `${app.appUrl}/${locale}/app/settings?microsoft=${connected?.ok === true ? 'connected' : 'failed'}`,
  );
  response.cookies.delete(MICROSOFT_OAUTH_COOKIE);
  return response;
}
