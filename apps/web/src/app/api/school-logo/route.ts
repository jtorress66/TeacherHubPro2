import { defaultLocale } from '@thp/i18n';
import { getAppContainer } from '../../../container.ts';
import { requireUser } from '../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

/** The signed-in teacher's own school logo, for the settings preview. */
export async function GET(): Promise<Response> {
  const { user } = await requireUser(defaultLocale, { needsAccess: false });
  const logo = await getAppContainer().getSchoolLogo.execute({ actor: user });
  if (!logo.ok || logo.value === null) return new Response(null, { status: 404 });
  return new Response(new Blob([logo.value.bytes.slice()], { type: logo.value.contentType }), {
    headers: {
      'Content-Type': logo.value.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
