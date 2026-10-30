import type { ClassId, StudentId } from '@thp/domain';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../../../container.ts';
import {
  reportCardFileName,
  reportCardPages,
} from '../../../../../../../server/report-card-document.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../../_lib/time-zone.ts';

export const dynamic = 'force-dynamic';

const notFound = (): Response => new Response(null, { status: 404 });

/** A class's report cards as a PDF: one student with `?student=`, otherwise everyone. */
export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string; classId: string }> },
): Promise<Response> {
  const { locale: requested, classId } = await context.params;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const student = new URL(request.url).searchParams.get('student');
  const cards = await app.getReportCards.execute({
    actor: user,
    classId: classId as ClassId,
    ...(student ? { studentIds: [student as StudentId] } : {}),
  });
  if (!cards.ok) return notFound();
  const pages = reportCardPages(cards.value, locale, app.today(await teacherTimeZone()));
  if (pages === null) return notFound();

  const pdf = await app.reportCardRenderer.render(pages);
  return new Response(new Blob([pdf.slice()], { type: 'application/pdf' }), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${reportCardFileName(cards.value, locale)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
