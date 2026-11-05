import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { TestDocActions } from '../../../../../../components/assignment-tools.tsx';
import { JobProgress } from '../../../../../../components/job-progress.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; jobId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * A test PDF being laid out as a Google Doc for Classroom: waits for the AI to read it, then the
 * teacher makes the Doc, checks it, and posts it. Only the job's owner can open this page.
 */
export default async function TestDocPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const job = await app.getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const assistant = `/${locale}/app/assistant`;
  const back = (
    <p>
      <Link href={assistant}>← {t('googleQuiz.back')}</Link>
    </p>
  );

  if (job.value.status === 'completed') {
    const test = await app.getTranscribedTest.execute({ actor: user, jobId: job.value.id });
    if (!test.ok) notFound();
    return (
      <section className="stack">
        {back}
        <h1>{test.value.title}</h1>
        <p>{t('pdfDoc.intro')}</p>
        <TestDocActions locale={locale} jobId={job.value.id} />
      </section>
    );
  }

  return (
    <section className="stack">
      {back}
      <h1>{t('pdfDoc.title')}</h1>
      <JobProgress
        locale={locale}
        jobId={job.value.id}
        retryHref={assistant}
        labels={{
          working: t('pdfImport.working'),
          failed: t('drafts.failed'),
          tryAgain: t('drafts.tryAgain'),
          open: t('pdfDoc.continue'),
        }}
      />
    </section>
  );
}
