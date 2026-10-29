import { NextResponse, type NextRequest } from 'next/server';
import { routeLocale } from './i18n/route-locale.ts';

const languageCookie = 'teacherhub_language';
const oneYear = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const route = routeLocale({
    pathname,
    search,
    saved: request.cookies.get(languageCookie)?.value,
  });

  const response =
    route.kind === 'redirect'
      ? NextResponse.redirect(new URL(route.to, request.url))
      : NextResponse.next();
  response.cookies.set(languageCookie, route.save, { path: '/', maxAge: oneYear, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
