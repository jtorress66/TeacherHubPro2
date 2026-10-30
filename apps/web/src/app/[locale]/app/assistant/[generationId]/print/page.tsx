import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GenerationId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { Markdown } from '../../../../../../components/markdown.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; generationId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The content alone on the page, for printing or the browser's Save as PDF. */
export default async function PrintGenerationPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { generationId } = await props.params;
  const { user, school } = await requireUser(locale);
  const found = await getAppContainer().getGeneration.execute({
    actor: user,
    generationId: generationId as GenerationId,
  });
  if (!found.ok) notFound();
  const generation = found.value;

  return (
    <article className="stack print-plan" data-testid="print-generation" lang={generation.language}>
      <p className="actions no-print">
        <Link href={`/${locale}/app/assistant/${generation.id}`}>← {t('assistant.back')}</Link>
        <PrintButton locale={locale} />
      </p>
      <p className="muted small">{school.name}</p>
      <Markdown source={generation.content} />
    </article>
  );
}
