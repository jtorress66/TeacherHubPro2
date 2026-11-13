import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@thp/domain';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer, type MicrosoftFeature } from '../../../../container.ts';
import { MICROSOFT_OAUTH_COOKIE, decodePkceOAuth } from '../../../../server/cookies.ts';
import { requireUser } from '../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/**
 * What happened, for Settings to say: connected, Teams allowed, or the reason it was not (a
 * refusal Microsoft sent back instead of a code, or a code that did not work).
 */
async function outcomeOf(
  microsoft: MicrosoftFeature,
  params: URLSearchParams,
  saved: { readonly verifier: string; readonly teams: boolean },
  actor: User,
  redirectUri: string,
): Promise<string> {
  const error = params.get('error');
  if (error !== null) {
    const description = params.get('error_description');
    return microsoft.explainRefusal.execute({ error, description, teams: saved.teams }).code;
  }
  const code = params.get('code');
  if (code === null) return 'failed';
  const connected = await microsoft.finishConnect.execute({
    actor,
    code,
    codeVerifier: saved.verifier,
    redirectUri,
    teams: saved.teams,
  });
  if (connected.ok) return connected.value.teams ? 'teams' : 'connected';
  return 'field' in connected.error ? 'failed' : connected.error.code;
}

/**
 * Microsoft returns here with a code or a refusal; the state must match either way. The access
 * is kept encrypted.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  const saved = decodePkceOAuth(request.cookies.get(MICROSOFT_OAUTH_COOKIE)?.value);
  const locale = saved?.locale ?? defaultLocale;
  const { user } = await requireUser(locale);
  const params = request.nextUrl.searchParams;
  const outcome =
    app.microsoft !== null && saved !== null && params.get('state') === saved.state
      ? await outcomeOf(app.microsoft, params, saved, user, `${app.appUrl}/api/microsoft/callback`)
      : 'failed';
  const response = NextResponse.redirect(
    `${app.appUrl}/${locale}/app/integrations?microsoft=${encodeURIComponent(outcome)}`,
  );
  response.cookies.delete(MICROSOFT_OAUTH_COOKIE);
  return response;
}
