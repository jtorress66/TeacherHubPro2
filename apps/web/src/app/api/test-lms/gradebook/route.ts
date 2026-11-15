import type { NextRequest } from 'next/server';
import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';

/**
 * What the test course's gradebook holds for one tool client (LTI_PROVIDER=local only), so a
 * developer or a test can see which scores arrived. The pretend course has no real people in it.
 */
export function GET(request: NextRequest): Response {
  const gradebook = getAppContainer().lti?.testLms?.gradebook ?? null;
  const client = request.nextUrl.searchParams.get('client');
  if (gradebook === null || client === null) return new Response(null, { status: 404 });
  return Response.json(gradebook.view(client), { headers: { 'Cache-Control': 'no-store' } });
}
