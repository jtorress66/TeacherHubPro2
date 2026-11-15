import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { notListed } from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('lti.askTeacherTitle'),
    robots: notListed,
  };
}

/**
 * A student who opened an assignment or game from their course system but is not on its class
 * list in TeacherHubPro (not imported yet, or another class). Nothing else is said or kept.
 */
export default async function LtiAskTeacherPage(props: LocaleParams) {
  const t = createTranslator(await localeFrom(props));
  return (
    <main className="student-page stack">
      <section className="card stack">
        <h1>{t('lti.askTeacherTitle')}</h1>
        <p>{t('lti.askTeacherText')}</p>
      </section>
    </main>
  );
}
