import type { AssignmentId, ClassId, JobId, User } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { getAppContainer } from '../container.ts';
import { sendLtiGradesAction } from '../app/_lib/lti-grades-actions.ts';
import { ltiCourseOption, readGradeSendResult } from '../server/lti.ts';
import { draftFailureMessage } from '../server/planner-messages.ts';
import { JobProgress } from './job-progress.tsx';

/**
 * "Send grades to {course}": one button per course the assignment (or its graded game) is placed
 * in whose gradebook takes grades, and, after a send, its progress and what it did. Nothing shows
 * when LTI is off or the assignment is in no such course.
 */
export async function SendLtiGrades(props: {
  readonly locale: Locale;
  readonly user: User;
  readonly classId: ClassId;
  readonly assignmentId: AssignmentId;
  /** This page's path: the send comes back here to show its progress. */
  readonly path: string;
  /** The `ltiJob` and `ltiGrades` of the page's address, after a send. */
  readonly jobId: string | undefined;
  readonly problem: string | undefined;
}) {
  const { locale, user, path } = props;
  const t = createTranslator(locale);
  const app = getAppContainer();
  const lti = app.lti;
  if (lti === null) return null;
  const targets = await lti.gradeTargets.execute({
    actor: user,
    classId: props.classId,
    assignmentId: props.assignmentId,
  });
  if (!targets.ok || targets.value.length === 0) return null;
  const job =
    props.jobId === undefined
      ? null
      : await app.getJob.execute({ actor: user, jobId: props.jobId as JobId });
  const running = job?.ok === true ? job.value : null;
  const result = running?.status === 'completed' ? readGradeSendResult(running.result) : null;

  return (
    <section className="card stack" aria-labelledby="lti-grades-heading">
      <h2 id="lti-grades-heading">{t('lti.sendGradesTitle')}</h2>
      <p className="hint">{t('lti.sendGradesIntro')}</p>
      {props.problem === undefined ? null : (
        <p role="alert" className="alert">
          {props.problem === 'refused'
            ? t('drafts.failed_course_system_refused')
            : t('drafts.failed_failed')}
        </p>
      )}
      {running === null || running.status === 'completed' ? null : running.status === 'failed' ? (
        <p role="alert" className="alert">
          {draftFailureMessage(running.error, locale)}
        </p>
      ) : (
        <JobProgress
          locale={locale}
          jobId={running.id}
          retryHref={path}
          labels={{
            working: t('lti.sendingGrades'),
            failed: t('drafts.failed'),
            tryAgain: t('drafts.tryAgain'),
            open: t('lti.sendingGrades'),
          }}
        />
      )}
      {result === null ? null : (
        <div role="status" className="notice stack">
          <p>
            <strong>{t('lti.gradesSentTitle', { course: result.course })}</strong>
          </p>
          <ul className="list">
            <li>{t('lti.gradesSentCount', { count: result.sent })}</li>
            <li>{t('lti.gradesNotConfirmed', { count: result.notConfirmed })}</li>
            <li>{t('lti.gradesNotLinked', { count: result.notLinked })}</li>
            {result.failed === 0 ? null : (
              <li>{t('lti.gradesFailed', { count: result.failed })}</li>
            )}
          </ul>
          {result.notLinked === 0 ? null : <p className="hint">{t('lti.gradesNotLinkedHint')}</p>}
        </div>
      )}
      <div className="button-row">
        {targets.value.map((target) => (
          <form key={ltiCourseOption(target)} action={sendLtiGradesAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="classId" value={props.classId} />
            <input type="hidden" name="assignmentId" value={props.assignmentId} />
            <input type="hidden" name="ltiCourse" value={ltiCourseOption(target)} />
            <input type="hidden" name="returnTo" value={path} />
            <button type="submit" className="button">
              {t('lti.sendGrades', { course: target.title })}
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
