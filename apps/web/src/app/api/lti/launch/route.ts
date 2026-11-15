import { NextResponse, type NextRequest } from 'next/server';
import type { LtiLaunchOutcome } from '@thp/application';
import { sessionLifetimeDays } from '@thp/domain';
import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../../server/cookies.ts';
import {
  SIGN_IN_CONFIRM_COOKIE,
  signInConfirmCookieOptions,
} from '../../../../server/sign-in-confirm.ts';
import {
  decodeLtiLogin,
  localeFromLti,
  ltiItemPath,
  LTI_LINK_COOKIE,
  LTI_LOGIN_COOKIE,
  LTI_PLACE_COOKIE,
  ltiLinkCookieOptions,
  ltiPlaceCookieOptions,
  ltiProblemFor,
} from '../../../../server/lti.ts';

export const dynamic = 'force-dynamic';

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

type SignedInOutcome = Extract<LtiLaunchOutcome, { readonly signIn: unknown }>;

/** The app page a signed-in teacher lands on. */
function signedInPath(outcome: SignedInOutcome): string {
  if (outcome.kind === 'pickContent') return `/${outcome.language}/app/lti/place`;
  if (outcome.kind === 'openItem') return ltiItemPath(outcome.language, outcome.target);
  return `/${outcome.language}/app`;
}

/** Where each kind of launch lands, with the cookies it needs. */
function landing(appUrl: string, outcome: LtiLaunchOutcome): NextResponse {
  if (outcome.kind === 'learnerNotYet') {
    return NextResponse.redirect(`${appUrl}/${localeFromLti(outcome.locale)}/lti/student`, 303);
  }
  if (outcome.kind === 'needsLink') {
    const locale = localeFromLti(outcome.locale);
    const response = NextResponse.redirect(`${appUrl}/${locale}/lti/link`, 303);
    response.cookies.set(LTI_LINK_COOKIE, outcome.ticket, ltiLinkCookieOptions(appUrl));
    if (outcome.placeTicket !== null) {
      response.cookies.set(LTI_PLACE_COOKIE, outcome.placeTicket, ltiPlaceCookieOptions(appUrl));
    }
    return response;
  }
  const { signIn } = outcome;
  const next = signedInPath(outcome);
  // The browser's own cookie is not sent with a launch posted from the course system's site, so
  // a sign-in that needs asking is resumed on this site, where it is.
  const response = NextResponse.redirect(
    signIn.kind === 'signedIn'
      ? `${appUrl}${next}`
      : `${appUrl}/api/auth/resume-sign-in?${new URLSearchParams({ next }).toString()}`,
    303,
  );
  if (signIn.kind === 'signedIn') {
    const expires = new Date(Date.now() + sessionLifetimeDays * 24 * 60 * 60 * 1000);
    response.cookies.set(
      SESSION_COOKIE,
      signIn.sessionToken,
      sessionCookieOptions(appUrl, expires),
    );
  } else {
    response.cookies.set(SIGN_IN_CONFIRM_COOKIE, signIn.ticket, signInConfirmCookieOptions(appUrl));
  }
  if (outcome.kind === 'pickContent') {
    response.cookies.set(LTI_PLACE_COOKIE, outcome.ticket, ltiPlaceCookieOptions(appUrl));
  }
  return response;
}

/**
 * The course system posts the launch here (form_post: id_token and state). The state must match
 * the login's cookie; the token is checked, then the teacher is signed in (and sent on to choose
 * content to add, or to the placed item they opened), asked to link their account, or (a student)
 * told it is not available yet. Tokens are never logged.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const app = getAppContainer();
  if (app.lti === null) return new NextResponse(null, { status: 404 });
  const data = await request.formData();
  const completed = await app.lti.completeLaunch.execute({
    idToken: field(data, 'id_token'),
    state: field(data, 'state'),
    saved: decodeLtiLogin(request.cookies.get(LTI_LOGIN_COOKIE)?.value),
    // Usually missing: the course system posts from its own site, so Lax cookies stay behind.
    browser: {
      sessionToken: request.cookies.get(SESSION_COOKIE)?.value ?? null,
      userAgent: request.headers.get('user-agent'),
    },
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
