import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { GenerationId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { CopyButton } from '../../../../../components/assistant-forms.tsx';
import { ListenButton } from '../../../../../components/listen-button.tsx';
import { Markdown } from '../../../../../components/markdown.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { deleteGenerationAction } from '../../../../_lib/assistant-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; generationId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One piece of content from the teacher's history; anyone else gets a 404. */
export default async function GenerationPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { generationId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getGeneration.execute({
    actor: user,
    generationId: generationId as GenerationId,
  });
  if (!found.ok) notFound();
  const generation = found.value;
  const assistant = `/${locale}/app/assistant`;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <p>
        <Link href={assistant}>← {t('assistant.back')}</Link>
      </p>
      <h1>
        {t(`assistant.type_${generation.type}`)}: {generation.topic}
      </h1>
      <p className="hint">
        {t(`assistant.subject_${generation.subject}`)} · {generation.grade} ·{' '}
        {t('assistant.madeOn', { date: day.format(generation.createdAt) })}
      </p>
      <div className="button-row">
        <CopyButton locale={locale} text={generation.content} />
        <ListenButton locale={locale} language={generation.language} text={generation.content} />
        <Link className="button secondary" href={`${assistant}/${generation.id}/print`}>
          {t('assistant.print')}
        </Link>
        <form action={deleteGenerationAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="generationId" value={generation.id} />
          <button type="submit" className="button secondary">
            {t('assistant.delete')}
          </button>
        </form>
      </div>
      <article className="card generated" lang={generation.language}>
        <Markdown source={generation.content} />
      </article>
    </section>
  );
}
