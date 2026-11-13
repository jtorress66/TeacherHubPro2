import type { NextRequest } from 'next/server';
import { getAppContainer } from '../../../../container.ts';
import { autoPostPage, readTestLmsLoginHint } from '../../../../server/test-lms.ts';

export const dynamic = 'force-dynamic';

/**
 * The pretend course system's sign-in (LTI_PROVIDER=local only): it answers TeacherHubPro's
 * authentication request at once with a signed launch, posted back to the launch address, for the
 * user and role it put in its own login hint.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const app = getAppContainer();
  const testLms = app.lti?.testLms ?? null;
  if (testLms === null) return new Response(null, { status: 404 });
  const params = request.nextUrl.searchParams;
  const user = readTestLmsLoginHint(params.get('login_hint'));
  const clientId = params.get('client_id');
  const nonce = params.get('nonce');
  const state = params.get('state');
  const launchUrl = `${app.appUrl}/api/lti/launch`;
  if (
    user === null ||
    clientId === null ||
    nonce === null ||
    state === null ||
    params.get('redirect_uri') !== launchUrl ||
    params.get('response_mode') !== 'form_post'
  ) {
    return new Response('Bad authentication request', { status: 400 });
  }
  // The pretend course system passes its page language along in the message hint.
  const locale = params.get('lti_message_hint');
  const idToken = await testLms.launchToken({
    clientId,
    subject: user.subject,
    role: user.role,
    nonce,
    ...(locale === null ? {} : { locale }),
  });
  return new Response(autoPostPage(launchUrl, { id_token: idToken, state }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
