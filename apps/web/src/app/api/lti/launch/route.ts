import { NextResponse, type NextRequest } from 'next/server';
import type { LtiLaunchOutcome } from '@thp/application';
import { sessionLifetimeDays } from '@thp/domain';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../server/cookies.ts';
import {
  decodeLtiLogin,
  localeFromLti,
  LTI_LINK_COOKIE,
  LTI_LOGIN_COOKIE,
  ltiLinkCookieOptions,
  ltiProblemFor,
} from '../../../../server/lti.ts';

export const dynamic = 'force-dynamic';

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

/** Where each kind of launch lands, with the cookie it needs. */
function landing(appUrl: string, outcome: LtiLaunchOutcome): NextResponse {
  if (outcome.kind === 'signedIn') {
    const response = NextResponse.redirect(`${appUrl}/${outcome.language}/app`, 303);
    const expires = new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000);
    response.cookies.set(
      SESSION_COOKIE,
      outcome.sessionToken,
      sessionCookieOptions(appUrl, expires),
    );
    return response;
  }
  const locale = localeFromLti(outcome.locale);
  if (outcome.kind === 'learnerNotYet') {
    return NextResponse.redirect(`${appUrl}/${locale}/lti/student`, 303);
  }
  const response = NextResponse.redirect(`${appUrl}/${locale}/lti/link`, 303);
  response.cookies.set(LTI_LINK_COOKIE, outcome.ticket, ltiLinkCookieOptions(appUrl));
  return response;
}

/**
 * The course system posts the launch here (form_post: id_token and state). The state must match
 * the login's cookie; the token is checked, then the teacher is signed in, asked to link their
 * account, or (a student) told it is not available yet. Tokens are never logged.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  if (app.lti === null) return new NextResponse(null, { status: 404 });
  const data = await request.formData();
  const completed = await app.lti.completeLaunch.execute({
    idToken: field(data, 'id_token'),
    state: field(data, 'state'),
    saved: decodeLtiLogin(request.cookies.get(LTI_LOGIN_COOKIE)?.value),
  });
  const response = completed.ok
    ? landing(app.appUrl, completed.value)
    : NextResponse.redirect(
        `${app.appUrl}/${defaultLocale}/lti/problem?reason=${ltiProblemFor(completed.error.code)}`,
        303,
      );
  response.cookies.delete({ name: LTI_LOGIN_COOKIE, path: '/api/lti' });
  return response;
}
