import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AssignmentId, ClassId, JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  GradeWithAiForm,
  ReviewForm,
} from '../../../../../../../../components/assignment-tools.tsx';
import { JobProgress } from '../../../../../../../../components/job-progress.tsx';
import { getAppContainer } from '../../../../../../../../container.ts';
import { requireUser } from '../../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string; assignmentId: string }>;
  readonly searchParams: Promise<{ job?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Every student's answers: code scores at once, AI suggestions on request, the teacher decides. */
export default async function SubmissionsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, assignmentId } = await props.params;
  const { job } = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const listed = await app.listSubmissions.execute({
    actor: user,
    classId: classId as ClassId,
    assignmentId: assignmentId as AssignmentId,
  });
  if (!listed.ok) notFound();
  const { assignment, rows } = listed.value;
  const running =
    job === undefined ? null : await app.getJob.execute({ actor: user, jobId: job as JobId });
  const base = `/${locale}/app/classes/${classId}/assignments/${assignmentId}`;
  const ids = { locale, classId, assignmentId };
  const questionsById = new Map(assignment.questions.map((q) => [q.id as string, q]));

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('grading.back')}</Link>
      </p>
      <h1>
        {t('grading.title')}: {assignment.title}
      </h1>
      <p>{t('grading.intro')}</p>
      {running?.ok === true && running.value.status !== 'completed' ? (
        <JobProgress
          locale={locale}
          jobId={running.value.id}
          retryHref={`${base}/submissions`}
          labels={{
            working: t('grading.working'),
            failed: t('drafts.failed'),
            tryAgain: t('drafts.tryAgain'),
            open: t('grading.done'),
          }}
        />
      ) : (
        <GradeWithAiForm {...ids} />
      )}
      <ol className="question-list">
        {rows.map(({ student, submission }) => {
          const name = `${student.firstName} ${student.lastName}`;
          const status = submission?.status ?? 'none';
          return (
            <li
              key={student.id}
              className="card stack"
              data-testid={`submission-${student.lastName}`}
            >
              <h2>
                {name} <span className="chip">{t(`grading.status_${status}`)}</span>
                {submission?.late === true ? (
                  <span className="chip">{t('grading.late')}</span>
                ) : null}
              </h2>
              {submission === null ? null : (
                <>
                  {submission.aiDraft === null ? null : (
                    <p>
                      {t('grading.draft', {
                        score: submission.aiDraft.score,
                        max: submission.maxPoints,
                      })}
                    </p>
                  )}
                  {submission.aiFailure === null ? null : (
                    <p className="notice">{t('grading.aiFailed')}</p>
                  )}
                  {submission.status === 'confirmed' ? (
                    <p role="status">
                      {t('grading.confirmed', {
                        score: submission.finalScore ?? 0,
                        max: submission.maxPoints,
                      })}
                    </p>
                  ) : null}
                  <dl className="facts">
                    {assignment.questions.map((question) => {
                      const scored = submission.questionScores[question.id];
                      return (
                        <div key={question.id}>
                          <dt>{questionsById.get(question.id)?.prompt}</dt>
                          <dd>
                            {submission.answers[question.id] ?? t('grading.noAnswer')}
                            {scored === undefined ? null : (
                              <span className="muted small">
                                {' '}
                                ·{' '}
                                {t('grading.scoreFor', {
                                  score: scored.score,
                                  points: question.points,
                                })}{' '}
                                ({t(`grading.source_${scored.source}`)})
                                {scored.feedback === null ? '' : ` · ${scored.feedback}`}
                              </span>
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  {submission.status === 'confirmed' ? null : (
                    <ReviewForm
                      {...ids}
                      submissionId={submission.id}
                      studentName={name}
                      score={submission.aiDraft?.score ?? null}
                      maxPoints={submission.maxPoints}
                      hasDraft={submission.aiDraft !== null}
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
