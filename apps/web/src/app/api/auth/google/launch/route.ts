import { NextResponse, type NextRequest } from 'next/server';
import { getAppContainer } from '../../../../../container.ts';
import { LANGUAGE_COOKIE, SESSION_COOKIE } from '../../../../../server/cookies.ts';
import { googleLaunchPath } from '../../../../../server/google-launch.ts';

export const dynamic = 'force-dynamic';

/** The Google apps menu shortcut: the dashboard if signed in, else Google sign-in at once. */
export function GET(request: NextRequest): NextResponse {
  const path = googleLaunchPath({
    hasSession: request.cookies.has(SESSION_COOKIE),
    savedLanguage: request.cookies.get(LANGUAGE_COOKIE)?.value,
  });
  return NextResponse.redirect(`${getAppContainer().appUrl}${path}`);
}
