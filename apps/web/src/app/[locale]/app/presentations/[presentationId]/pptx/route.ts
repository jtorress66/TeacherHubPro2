import type { PresentationId } from '@thp/domain';
import { defaultLocale, isLocale } from '@thp/i18n';
import { getAppContainer } from '../../../../../../container.ts';
import { attachmentDisposition } from '../../../../../../server/download.ts';
import { requireUser } from '../../../../../_lib/auth.ts';

export const dynamic = 'force-dynamic';

const pptxType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** The teacher's own presentation as a PowerPoint file; anyone else gets a 404. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string; presentationId: string }> },
): Promise<Response> {
  const { locale: requested, presentationId } = await context.params;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const { user } = await requireUser(locale);
  const file = await getAppContainer().downloadPresentationFile.execute({
    actor: user,
    presentationId: presentationId as PresentationId,
  });
  if (!file.ok) return new Response(null, { status: 404 });
  return new Response(new Blob([file.value.bytes.slice()], { type: pptxType }), {
    headers: {
      'Content-Type': pptxType,
      'Content-Disposition': attachmentDisposition(file.value.fileName),
      'Cache-Control': 'private, no-store',
    },
  });
}
