import { getAppContainer } from '../../../../container.ts';
import { readServiceTokenRequest } from '../../../../server/test-lms.ts';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/**
 * The pretend course system's OAuth token address (LTI_PROVIDER=local only): it grants a class
 * list token for a client assertion signed by one of TeacherHubPro's published keys.
 */
export async function POST(request: Request): Promise<Response> {
  const lti = getAppContainer().lti;
  const testLms = lti?.testLms ?? null;
  if (lti === null || testLms === null) return new Response(null, { status: 404 });
  const form = new URLSearchParams(await request.text());
  const token = await testLms.grantServiceToken(
    readServiceTokenRequest(form),
    await lti.toolKeys.publicKeySet(),
  );
  if (token === null) {
    return Response.json({ error: 'invalid_client' }, { status: 401, headers: noStore });
  }
  return Response.json(
    { access_token: token, token_type: 'Bearer', expires_in: 300, scope: form.get('scope') },
    { headers: noStore },
  );
}
