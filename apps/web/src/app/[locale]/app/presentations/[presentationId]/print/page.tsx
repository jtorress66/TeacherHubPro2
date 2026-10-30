import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PresentationId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { SlideView } from '../../../../../../components/slide-view.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; presentationId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Every slide, one per printed page, for printing or the browser's Save as PDF. */
export default async function PrintPresentationPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { presentationId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getPresentation.execute({
    actor: user,
    presentationId: presentationId as PresentationId,
  });
  if (!found.ok) notFound();
  const presentation = found.value;

  return (
    <article className="stack print-slides" data-testid="print-slides">
      <p className="actions no-print">
        <Link href={`/${locale}/app/presentations/${presentation.id}`}>
          ← {t('presentations.back')}
        </Link>
        <PrintButton locale={locale} />
      </p>
      {presentation.slides.map((slide, index) => (
        <section key={index} className="print-slide">
          <SlideView slide={slide} theme={presentation.theme} />
        </section>
      ))}
    </article>
  );
}
