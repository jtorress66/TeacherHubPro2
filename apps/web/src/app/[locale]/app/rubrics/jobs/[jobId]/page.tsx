import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { JobProgress } from '../../../../../../components/job-progress.tsx';
import { KeepRubricDraftForm } from '../../../../../../components/rubric-forms.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; jobId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * Waits for the rubric draft. The teacher decides: nothing is saved until they keep it.
 * Only the job's owner can open this page.
 */
export default async function RubricProgressPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { user } = await requireUser(locale);
  const job = await getAppContainer().getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();

  return (
    <section className="stack">
      <h1>{t('rubrics.aiDraft')}</h1>
      {job.value.status === 'completed' ? (
        <KeepRubricDraftForm locale={locale} jobId={job.value.id} />
      ) : (
        <JobProgress
          locale={locale}
          jobId={job.value.id}
          retryHref={`/${locale}/app/rubrics`}
          labels={{
            working: t('rubrics.working'),
            failed: t('drafts.failed'),
            tryAgain: t('drafts.tryAgain'),
            open: t('rubrics.open'),
          }}
        />
      )}
    </section>
  );
}
