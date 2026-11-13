import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { ltiProblemFrom } from '../../../../server/lti.ts';
import { notListed } from '../../../../server/marketing-pages.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('lti.problemTitle'),
    robots: notListed,
  };
}

/** Why TeacherHubPro could not open from a course system, in plain words (never details). */
export default async function LtiProblemPage(
  props: LocaleParams & { readonly searchParams: Promise<{ reason?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const problem = ltiProblemFrom((await props.searchParams).reason);
  return (
    <main className="student-page stack">
      <section className="card stack">
        <h1>{t('lti.problemTitle')}</h1>
        <p role="alert">{t(`lti.problem_${problem}`)}</p>
      </section>
    </main>
  );
}
