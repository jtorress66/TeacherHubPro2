import { getAppContainer } from '../../../../../../container.ts';

export const dynamic = 'force-dynamic';

/** A score for one of the test course's columns (LTI_PROVIDER=local only), with the score scope. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ item: string }> },
): Promise<Response> {
  const gradebook = getAppContainer().lti?.testLms?.gradebook ?? null;
  if (gradebook === null) return new Response(null, { status: 404 });
  const { item } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const taken = await gradebook.postScore(request.headers.get('authorization'), item, body);
  return taken.body === null
    ? new Response(null, { status: taken.status })
    : Response.json(taken.body, { status: taken.status });
}
