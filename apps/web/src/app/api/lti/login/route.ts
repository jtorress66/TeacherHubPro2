import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import {
  encodeLtiLogin,
  LTI_LOGIN_COOKIE,
  ltiLoginCookieOptions,
  ltiProblemFor,
  parseLtiLogin,
} from '../../../../server/lti.ts';

export const dynamic = 'force-dynamic';

const problem = (appUrl: string, reason: string) =>
  NextResponse.redirect(`${appUrl}/${defaultLocale}/lti/problem?reason=${reason}`, 303);

/**
 * A course system starts a launch here (OIDC third-party initiated login, GET or POST): we
 * remember a fresh state and nonce in a short-lived cookie and send the browser to the course
 * system's sign-in, which posts the launch back to /api/lti/launch.
 */
async function startLogin(params: URLSearchParams | FormData): Promise<NextResponse> {
  const app = getAppContainer();
  if (app.lti === null) return new NextResponse(null, { status: 404 });
  const request = parseLtiLogin(params);
  if (request === null) return problem(app.appUrl, 'failed');
  const started = await app.lti.startLogin.execute(request);
  if (!started.ok) return problem(app.appUrl, ltiProblemFor(started.error.code));
  const { redirectUrl, ...saved } = started.value;
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(LTI_LOGIN_COOKIE, encodeLtiLogin(saved), ltiLoginCookieOptions(app.appUrl));
  return response;
}

export function GET(request: NextRequest): Promise<NextResponse> {
  return startLogin(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return startLogin(await request.formData());
}
