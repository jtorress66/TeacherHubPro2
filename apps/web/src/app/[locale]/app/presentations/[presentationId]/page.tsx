import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PresentationId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { SlideEditor } from '../../../../../components/slide-editor.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { deletePresentationAction } from '../../../../_lib/assistant-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; presentationId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The slide editor for the teacher's own presentation; anyone else gets a 404. */
export default async function PresentationPage(props: Props) {
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
  const base = `/${locale}/app/presentations`;

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('presentations.back')}</Link>
      </p>
      <h1>{presentation.name}</h1>
      <div className="button-row">
        <Link className="button" href={`${base}/${presentation.id}/present`}>
          {t('presentations.present')}
        </Link>
        <Link className="button secondary" href={`${base}/${presentation.id}/print`}>
          {t('presentations.print')}
        </Link>
        <form action={deletePresentationAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="presentationId" value={presentation.id} />
          <button type="submit" className="button secondary">
            {t('presentations.delete')}
          </button>
        </form>
      </div>
      <SlideEditor locale={locale} presentation={presentation} language={user.language} />
    </section>
  );
}
