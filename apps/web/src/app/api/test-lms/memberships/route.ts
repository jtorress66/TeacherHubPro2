import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';

/** The test course's class list (LTI_PROVIDER=local only), for a token the token address granted. */
export async function GET(request: Request): Promise<Response> {
  const testLms = getAppContainer().lti?.testLms ?? null;
  if (testLms === null) return new Response(null, { status: 404 });
  const list = await testLms.classList(request.headers.get('authorization'));
  if (list === null) return new Response(null, { status: 401 });
  return Response.json(list, {
    headers: {
      'Content-Type': 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json',
      'Cache-Control': 'no-store',
    },
  });
}
