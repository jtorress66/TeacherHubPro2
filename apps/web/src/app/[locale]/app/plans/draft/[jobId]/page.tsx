import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { DraftProgress } from '../../../../../../components/planner-forms.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; jobId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Waits for the draft job; only its owner can open this page. */
export default async function DraftProgressPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { user } = await requireUser(locale);
  const job = await getAppContainer().getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();

  return (
    <section className="stack">
      <h1>{t('drafts.title')}</h1>
      <DraftProgress locale={locale} jobId={job.value.id} />
    </section>
  );
}
