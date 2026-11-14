import type { NextRequest } from 'next/server';
import { createTranslator, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../container.ts';
import { approvalsCsv, approvalsQueryFrom } from '../../../server/approvals-view.ts';
import { attachmentDisposition } from '../../../server/download.ts';
import { requireUser } from '../../_lib/auth.ts';
import { teacherTimeZone } from '../../_lib/time-zone.ts';

export const dynamic = 'force-dynamic';

/** The approvals page as a CSV file, with the same filters and the same rules on who sees what. */
export async function GET(request: NextRequest): Promise<Response> {
  const search = request.nextUrl.searchParams;
  const requested = search.get('locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const timeZone = await teacherTimeZone();
  const listed = await getAppContainer().listApprovals.execute({
    actor: user,
    schoolId: school.id,
    filter: approvalsQueryFrom(Object.fromEntries(search), timeZone),
  });
  if (!listed.ok) return new Response(null, { status: 404 });
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
  const t = createTranslator(locale);
  return new Response(approvalsCsv(listed.value.rows, t, when), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': attachmentDisposition(`${t('approvals.title')}.csv`),
      'Cache-Control': 'private, no-store',
    },
  });
}
