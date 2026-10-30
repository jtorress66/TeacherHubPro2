import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { PresentationRequestForm } from '../../../../../components/assistant-forms.tsx';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function PresentationDraftPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  await requireUser(locale);

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/presentations`}>← {t('presentations.back')}</Link>
      </p>
      <h1>{t('presentations.generate')}</h1>
      <p>{t('presentations.generateIntro')}</p>
      <PresentationRequestForm locale={locale} />
    </section>
  );
}
