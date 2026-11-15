import { NextResponse, type NextRequest } from 'next/server';
import { sessionLifetimeDays } from '@thp/domain';
import { getAppContainer } from '../../../../container.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../server/cookies.ts';
import {
  confirmSignInPath,
  localeOfPath,
  safeNextPath,
  SIGN_IN_CONFIRM_COOKIE,
  signInConfirmCookieOptions,
  signInProblem,
} from '../../../../server/sign-in-confirm.ts';

export const dynamic = 'force-dynamic';

/**
 * A course system launch that needed asking comes back here, on this site, where the browser sends
 * its own session cookie. A browser already signed in to the account goes straight on; otherwise
 * the person is asked on the confirmation page. The ticket is never logged.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  const fallback = safeNextPath(request.nextUrl.searchParams.get('next'));
  const locale = localeOfPath(fallback ?? '/');
  const next = fallback ?? `/${locale}/app`;
  const ticket = request.cookies.get(SIGN_IN_CONFIRM_COOKIE)?.value;
  const resumed =
    ticket === undefined
      ? null
      : await app.resumeSignIn.execute({
          ticket,
          browser: {
            sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
            userAgent: request.headers.get('user-agent'),
          },
        });
  if (!resumed?.ok) {
    const reason = signInProblem(resumed?.error);
    const response = NextResponse.redirect(`${app.appUrl}/${locale}/login?error=${reason}`, 303);
    response.cookies.delete(SIGN_IN_CONFIRM_COOKIE);
    return response;
  }
  const step = resumed.value;
  if (step.kind === 'confirm') {
    const response = NextResponse.redirect(`${app.appUrl}${confirmSignInPath(locale, next)}`, 303);
    response.cookies.set(
      SIGN_IN_CONFIRM_COOKIE,
      step.ticket,
      signInConfirmCookieOptions(app.appUrl),
    );
    return response;
  }
  const response = NextResponse.redirect(`${app.appUrl}${next}`, 303);
  response.cookies.delete(SIGN_IN_CONFIRM_COOKIE);
  const expires = new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000);
  response.cookies.set(
    SESSION_COOKIE,
    step.sessionToken,
    sessionCookieOptions(app.appUrl, expires),
  );
  return response;
}
