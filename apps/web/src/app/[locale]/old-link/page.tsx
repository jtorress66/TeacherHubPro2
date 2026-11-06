import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * Where an assignment or game link shared from the old app lands. Those links matched students
 * by a typed name; work now comes from each student's own link.
 */
export default async function OldLinkPage(props: LocaleParams) {
  const t = createTranslator(await localeFrom(props));
  return (
    <main className="student-page stack">
      <h1>{t('oldLink.title')}</h1>
      <p>{t('oldLink.body')}</p>
      <p className="notice">{t('oldLink.action')}</p>
    </main>
  );
}
