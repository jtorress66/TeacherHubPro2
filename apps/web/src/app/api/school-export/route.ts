import type { NextRequest } from 'next/server';
import { localDateIn } from '@thp/domain';
import { createTranslator, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../container.ts';
import { attachmentDisposition } from '../../../server/download.ts';
import { schoolExportFiles, schoolExportName } from '../../../server/school-export-view.ts';
import { requireUser } from '../../_lib/auth.ts';
import { teacherTimeZone } from '../../_lib/time-zone.ts';

export const dynamic = 'force-dynamic';

/** All of the school's data as one ZIP of spreadsheets, for its admins or account owner. */
export async function GET(request: NextRequest): Promise<Response> {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = isLocale(requested) ? requested : 'en';
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const data = await app.exportSchoolData.execute({ actor: user });
  if (!data.ok) return new Response(null, { status: 404 });
  const t = createTranslator(locale);
  const timeZone = await teacherTimeZone();
  const zip = await app.zipFiles.zip(schoolExportFiles(data.value, t, timeZone));
  return new Response(new Blob([zip.slice()], { type: 'application/zip' }), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': attachmentDisposition(
        schoolExportName(t, localDateIn(new Date(), timeZone)),
      ),
      'Cache-Control': 'private, no-store',
    },
  });
}
