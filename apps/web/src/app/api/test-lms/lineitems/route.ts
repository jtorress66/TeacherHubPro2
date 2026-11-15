import type { NextRequest } from 'next/server';
import type { LocalAnswer } from '@thp/adapters';
import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';

const answer = ({ status, body }: LocalAnswer, contentType: string) =>
  Response.json(body, {
    status,
    headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
  });

/**
 * The test course's gradebook columns (LTI_PROVIDER=local only), for a token the token address
 * granted with the line item scope: the list (by `resource_id`, when asked) and adding one.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const gradebook = getAppContainer().lti?.testLms?.gradebook ?? null;
  if (gradebook === null) return new Response(null, { status: 404 });
  const listed = await gradebook.listLineItems(
    request.headers.get('authorization'),
    request.nextUrl.searchParams.get('resource_id'),
  );
  return answer(listed, 'application/vnd.ims.lis.v2.lineitemcontainer+json');
}

export async function POST(request: NextRequest): Promise<Response> {
  const gradebook = getAppContainer().lti?.testLms?.gradebook ?? null;
  if (gradebook === null) return new Response(null, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const made = await gradebook.createLineItem(request.headers.get('authorization'), body);
  return answer(made, 'application/vnd.ims.lis.v2.lineitem+json');
}
