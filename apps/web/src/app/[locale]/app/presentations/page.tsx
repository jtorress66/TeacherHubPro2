import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { NewPresentationForm } from '../../../../components/assistant-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The teacher's presentations, newest first, and the two ways to start one. */
export default async function PresentationsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const listed = await getAppContainer().listPresentations.execute({ actor: user });
  const presentations = listed.ok ? listed.value : [];
  const base = `/${locale}/app/presentations`;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <h1>{t('presentations.title')}</h1>
      <p>{t('presentations.intro')}</p>
      <p>
        <Link className="button" href={`${base}/draft`}>
          {t('presentations.generate')}
        </Link>
      </p>
      {presentations.length === 0 ? (
        <p>{t('presentations.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('presentations.title')}>
          {presentations.map((presentation) => (
            <li key={presentation.id}>
              <Link href={`${base}/${presentation.id}`}>{presentation.name}</Link>{' '}
              <span className="hint">
                {t('presentations.slides', { count: presentation.slideCount })} ·{' '}
                {t('presentations.updated', { date: day.format(presentation.updatedAt) })}
              </span>{' '}
              <Link href={`${base}/${presentation.id}/present`}>{t('presentations.present')}</Link>
            </li>
          ))}
        </ul>
      )}
      <h2>{t('presentations.newBlank')}</h2>
      <NewPresentationForm locale={locale} />
    </section>
  );
}
