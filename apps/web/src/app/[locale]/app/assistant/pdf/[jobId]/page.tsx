import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { JobProgress } from '../../../../../../components/job-progress.tsx';
import { QuestionBuilder } from '../../../../../../components/question-builder.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { makeGoogleQuizAction } from '../../../../../_lib/assignment-actions.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; jobId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * A test PDF read without a class: waits for the job, then the teacher checks the questions and
 * makes a Google Forms quiz from them. Only the job's owner can open this page.
 */
export default async function QuizReviewPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const job = await app.getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const assistant = `/${locale}/app/assistant`;

  if (job.value.status === 'completed') {
    const imported = await app.getImportedTest.execute({ actor: user, jobId: job.value.id });
    if (!imported.ok || imported.value.classId !== null) notFound();
    const connected = (await app.listClassroomCourses.execute({ actor: user })).ok;
    return (
      <section className="stack">
        <p>
          <Link href={assistant}>← {t('googleQuiz.back')}</Link>
        </p>
        <h1>
          {t('pdfTest.reviewTitle')}: {imported.value.title}
        </h1>
        <p>{t('pdfTest.reviewIntro')}</p>
        <p className="hint">{t('forms.note')}</p>
        <QuestionBuilder
          locale={locale}
          classId=""
          assignmentId=""
          questions={imported.value.test.questions}
          instructions={imported.value.test.instructions}
          locked={false}
          imported
          save={{
            action: makeGoogleQuizAction,
            hidden: { title: imported.value.title },
            label: t('forms.make'),
            ...(connected
              ? {}
              : {
                  instead: (
                    <div className="stack">
                      <p className="muted">{t('pdfTest.connectFirst')}</p>
                      <p>
                        <a className="button" href={`/api/classroom/connect?locale=${locale}`}>
                          {t('pdfTest.connect')}
                        </a>
                      </p>
                    </div>
                  ),
                }),
          }}
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
        retryHref={assistant}
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
