import type { NextRequest } from 'next/server';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { testLmsDeepLinkingData, testLmsPlaced } from '../../../../server/test-lms.ts';

export const dynamic = 'force-dynamic';

/**
 * Where the pretend course system takes TeacherHubPro's answer to "Add content" (LTI_PROVIDER=local
 * only): the posted JWT must be signed by one of TeacherHubPro's published keys, from the client ID
 * the request went to, for this course system, and hand back its data. The placed links go back to
 * the test course page in its address, since the pretend course system keeps nothing.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const app = getAppContainer();
  const lti = app.lti;
  const testLms = lti?.testLms ?? null;
  if (lti === null || testLms === null) return new Response(null, { status: 404 });
  const query = request.nextUrl.searchParams;
  const clientId = query.get('client');
  const jwt = (await request.formData()).get('JWT');
  if (clientId === null || typeof jwt !== 'string') {
    return new Response('Bad deep linking response', { status: 400 });
  }
  const placed = await testLms.readDeepLinkingResponse(jwt, await lti.toolKeys.publicKeySet(), {
    clientId,
    data: testLmsDeepLinkingData,
  });
  if (placed === null) return new Response('Bad deep linking response', { status: 400 });
  const language = query.get('locale');
  const locale = isLocale(language) ? language : defaultLocale;
  const page = new URLSearchParams({ client: clientId, placed: testLmsPlaced(placed) });
  const teacher = query.get('teacher');
  if (teacher !== null) page.set('teacher', teacher);
  return Response.redirect(`${app.appUrl}/${locale}/test-lms?${page.toString()}`, 303);
}
