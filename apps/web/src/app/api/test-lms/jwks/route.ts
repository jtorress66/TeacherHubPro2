import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';

/** The pretend course system's public keys (LTI_PROVIDER=local only). */
export async function GET(): Promise<Response> {
  const testLms = getAppContainer().lti?.testLms ?? null;
  if (testLms === null) return new Response(null, { status: 404 });
  return Response.json(await testLms.publicKeySet());
}
