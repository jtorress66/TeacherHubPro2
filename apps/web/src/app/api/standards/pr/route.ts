import { defaultLocale } from '@thp/i18n';
import { requireUser } from '../../../_lib/auth.ts';
import { prCodesFor } from '../../../../server/pr-standards-api.ts';

export const dynamic = 'force-dynamic';

/** Puerto Rico codes for one subject and grade (or school level), for signed-in teachers. */
export async function GET(request: Request): Promise<Response> {
  await requireUser(defaultLocale, { needsAccess: false });
  const result = prCodesFor(new URL(request.url).searchParams);
  if (result.status === 400) return new Response(null, { status: 400 });
  return Response.json(result.codes, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
