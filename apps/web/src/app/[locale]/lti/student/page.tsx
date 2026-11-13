import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { notListed } from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('lti.studentTitle'),
    robots: notListed,
  };
}

/** Students who open TeacherHubPro from a course system: not available yet, nothing kept. */
export default async function LtiStudentPage(props: LocaleParams) {
  const t = createTranslator(await localeFrom(props));
  return (
    <main className="student-page stack">
      <section className="card stack">
        <h1>{t('lti.studentTitle')}</h1>
        <p>{t('lti.studentText')}</p>
      </section>
    </main>
  );
}
