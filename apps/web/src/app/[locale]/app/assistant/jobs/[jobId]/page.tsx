import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { GenerationJobResult } from '@thp/application';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { JobProgress } from '../../../../../../components/job-progress.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; jobId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Waits for the assistant's job, then opens what it wrote. Only its owner can open this page. */
export default async function GenerationProgressPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { user } = await requireUser(locale);
  const job = await getAppContainer().getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const assistant = `/${locale}/app/assistant`;
  if (job.value.status === 'completed') {
    const { generationId } = job.value.result as GenerationJobResult;
    redirect(`${assistant}/${generationId}`);
  }

  return (
    <section className="stack">
      <h1>{t('assistant.title')}</h1>
      <JobProgress
        locale={locale}
        jobId={job.value.id}
        retryHref={assistant}
        labels={{
          working: t('assistant.working'),
          failed: t('drafts.failed'),
          tryAgain: t('drafts.tryAgain'),
          open: t('assistant.open'),
        }}
      />
    </section>
  );
}
