import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';

/** TeacherHubPro's public signing keys, for schools' course systems. */
export async function GET(): Promise<Response> {
  const lti = getAppContainer().lti;
  if (lti === null) return new Response(null, { status: 404 });
  return Response.json(await lti.toolKeys.publicKeySet(), {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}
