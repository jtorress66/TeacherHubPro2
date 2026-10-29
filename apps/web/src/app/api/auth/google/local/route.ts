import { NextResponse } from 'next/server';
import type { Email } from '@thp/domain';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../container.ts';

export const dynamic = 'force-dynamic';

/**
 * The in-app stand-in for Google's account picker posts here (GOOGLE_AUTH_PROVIDER=local only).
 * It signs a code for the chosen test account and returns to the normal Google callback.
 */
export async function POST(request: Request): Promise<Response> {
  const app = getAppContainer();
  const data = await request.formData();
  const locale = data.get('locale');
  const state = data.get('state');
  const email = data.get('email');
  const name = data.get('name');
  const callback = `${app.appUrl}/api/auth/google/callback`;
  const issue = app.issueLocalGoogleCode;
  if (issue === null) return new Response(null, { status: 404 });
  if (
    typeof state !== 'string' ||
    data.get('redirect_uri') !== callback ||
    typeof email !== 'string'
  ) {
    return NextResponse.redirect(
      `${app.appUrl}/${isLocale(locale) ? locale : defaultLocale}/login?error=google_failed`,
      303,
    );
  }
  const code = issue({
    email: email.trim().toLowerCase() as Email,
    emailVerified: data.get('verified') === 'on',
    name: typeof name === 'string' ? name : '',
    picture: null,
  });
  return NextResponse.redirect(
    `${callback}?${new URLSearchParams({ code, state }).toString()}`,
    303,
  );
}
