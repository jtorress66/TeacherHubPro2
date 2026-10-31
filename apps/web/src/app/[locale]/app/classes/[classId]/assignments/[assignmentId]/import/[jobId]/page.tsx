import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { JobProgress } from '../../../../../../../../../components/job-progress.tsx';
import { QuestionBuilder } from '../../../../../../../../../components/question-builder.tsx';
import { getAppContainer } from '../../../../../../../../../container.ts';
import { requireUser } from '../../../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{
    locale: string;
    classId: string;
    assignmentId: string;
    jobId: string;
  }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * Waits for the PDF to be read, then shows its questions in the builder. Nothing is saved until
 * the teacher saves. Only the job's owner can open this page.
 */
export default async function PdfImportPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, assignmentId, jobId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const job = await app.getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const base = `/${locale}/app/classes/${classId}/assignments/${assignmentId}/questions`;

  if (job.value.status === 'completed') {
    const imported = await app.getImportedTest.execute({ actor: user, jobId: job.value.id });
    if (!imported.ok || imported.value.assignmentId !== assignmentId) notFound();
    return (
      <section className="stack">
        <h1>{t('pdfImport.title')}</h1>
        <QuestionBuilder
          locale={locale}
          classId={classId}
          assignmentId={assignmentId}
          questions={imported.value.test.questions}
          instructions={imported.value.test.instructions}
          locked={false}
          imported
        />
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>{t('pdfImport.title')}</h1>
      <JobProgress
        locale={locale}
        jobId={job.value.id}
        retryHref={base}
        labels={{
          working: t('pdfImport.working'),
          failed: t('drafts.failed'),
          tryAgain: t('drafts.tryAgain'),
          open: t('pdfImport.open'),
        }}
      />
    </section>
  );
}
