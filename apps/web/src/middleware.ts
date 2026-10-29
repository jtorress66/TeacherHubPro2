import { NextResponse, type NextRequest } from 'next/server';
import { routeLocale } from './i18n/route-locale.ts';
import { signedOutRedirect } from './server/app-guard.ts';
import { SESSION_COOKIE } from './server/cookies.ts';

const languageCookie = 'teacherhub_language';
const oneYear = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const route = routeLocale({
    pathname,
    search,
    saved: request.cookies.get(languageCookie)?.value,
  });
  const loginPath =
    route.kind === 'next' ? signedOutRedirect(pathname, request.cookies.has(SESSION_COOKIE)) : null;

  const response =
    route.kind === 'redirect'
      ? NextResponse.redirect(new URL(route.to, request.url))
      : loginPath === null
        ? NextResponse.next()
        : NextResponse.redirect(new URL(loginPath, request.url));
  response.cookies.set(languageCookie, route.save, { path: '/', maxAge: oneYear, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
