import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { ContentForm } from '../../../../components/assistant-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The AI assistant: ask for content, and see everything made so far. */
export default async function AssistantPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const history = await getAppContainer().listGenerations.execute({ actor: user });
  const items = history.ok ? history.value : [];
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <h1>{t('assistant.title')}</h1>
      <p>{t('assistant.intro')}</p>
      <ContentForm locale={locale} />
      <h2>{t('assistant.history')}</h2>
      {items.length === 0 ? (
        <p>{t('assistant.historyEmpty')}</p>
      ) : (
        <ul className="list" aria-label={t('assistant.history')}>
          {items.map((item) => (
            <li key={item.id}>
              <Link href={`/${locale}/app/assistant/${item.id}`}>
                {t(`assistant.type_${item.type}`)}: {item.topic}
              </Link>{' '}
              <span className="hint">
                {t(`assistant.subject_${item.subject}`)} · {item.grade} ·{' '}
                {day.format(item.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
