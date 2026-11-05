import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PrepBatch, PrepBatchId, PrepProgress } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { PrepRefresher, PrepReview } from '../../../../../components/prep-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { formatDate } from '../../../../../server/lesson-plan-display.ts';
import { deletePrepAction, resumePrepAction } from '../../../../_lib/prep-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; batchId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

const steps = [1, 2, 3, 4] as const;

function Steps({ progress, locale }: { readonly progress: PrepProgress; readonly locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <section className="card stack" aria-labelledby="prep-progress-heading">
      <h2 id="prep-progress-heading">{t('prep.progress')}</h2>
      <ol className="list prep-steps">
        {steps.map((step) => {
          const state =
            step < progress.step ? 'done' : step === progress.step ? 'current' : 'waiting';
          return (
            <li
              key={step}
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              {t(`prep.step_${String(step) as '1' | '2' | '3' | '4'}`)}:{' '}
              <span className="hint">
                {state === 'done'
                  ? t('prep.stepDone')
                  : state === 'current'
                    ? t('prep.stepCurrent')
                    : t('prep.stepWaiting')}
              </span>
            </li>
          );
        })}
      </ol>
      <p>
        <progress value={progress.done} max={progress.total} aria-label={t('prep.progress')} />{' '}
        {t('prep.progressCount', { done: progress.done, total: progress.total })}
      </p>
    </section>
  );
}

function BatchForm(props: {
  readonly locale: Locale;
  readonly batchId: string;
  readonly action: (data: FormData) => Promise<void>;
  readonly label: string;
  readonly secondary?: boolean;
}) {
  return (
    <form action={props.action}>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="batchId" value={props.batchId} />
      <button type="submit" className={props.secondary === true ? 'button secondary' : 'button'}>
        {props.label}
      </button>
    </form>
  );
}

function Published({ batch, locale }: { readonly batch: PrepBatch; readonly locale: Locale }) {
  const t = createTranslator(locale);
  const published = batch.published;
  if (published === null) return null;
  const app = `/${locale}/app`;
  return (
    <section className="card stack" aria-labelledby="prep-published-heading">
      <h2 id="prep-published-heading">{t('prep.published')}</h2>
      <p>{t('prep.publishedIntro')}</p>
      <ul className="list">
        {published.planId === null ? null : (
          <li>
            <Link href={`${app}/plans/${published.planId}`}>{t('prep.openPlan')}</Link>
          </li>
        )}
        {published.presentationIds.map((id, index) => (
          <li key={id}>
            <Link href={`${app}/presentations/${id}`}>
              {t('prep.openPresentation', { number: index + 1 })}
            </Link>
          </li>
        ))}
        {published.generationIds.map((id, index) => (
          <li key={id}>
            <Link href={`${app}/assistant/${id}`}>
              {t('prep.openWorksheet', { number: index + 1 })}
            </Link>
          </li>
        ))}
        {published.assignmentId === null ? null : (
          <li>
            <Link href={`${app}/classes/${batch.classId}/assignments/${published.assignmentId}`}>
              {t('prep.openQuiz')}
            </Link>
          </li>
        )}
      </ul>
      {batch.parentEmail === null ? null : (
        <p data-testid="prep-emails">
          {t('prep.emailsSent', { count: published.emailsSent })}
          {published.emailsFailed === 0
            ? ''
            : ` · ${t('prep.emailsFailed', { count: published.emailsFailed })}`}
        </p>
      )}
    </section>
  );
}

/**
 * One prep batch: its progress while the agent works, then the side-by-side review with
 * Approve & Publish, then links to what was published. Only the teacher who started it sees it.
 */
export default async function PrepBatchPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { batchId } = await props.params;
  const { user } = await requireUser(locale);
  const view = await getAppContainer().getPrepBatch.execute({
    actor: user,
    batchId: batchId as PrepBatchId,
  });
  if (!view.ok) notFound();
  const { batch, progress, stalled, recipients } = view.value;
  const ids = { locale, batchId: batch.id };

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/prep`}>← {t('prep.back')}</Link>
      </p>
      <h1>{batch.request.prompt}</h1>
      <p className="muted">
        {t('prep.weekOf', { date: formatDate(batch.request.weekStart, locale) })} ·{' '}
        <span className={`badge prep-${batch.status}`} data-testid="prep-status">
          {t(`prep.status_${batch.status}`)}
        </span>
      </p>

      {batch.status === 'running' ? (
        <>
          <Steps progress={progress} locale={locale} />
          {stalled ? (
            <div className="stack">
              <p role="alert" className="alert">
                {t('prep.stalled')}
              </p>
              <BatchForm {...ids} action={resumePrepAction} label={t('prep.resume')} />
            </div>
          ) : (
            <>
              <p role="status">{t('prep.working')}</p>
              <PrepRefresher />
            </>
          )}
        </>
      ) : null}

      {batch.status === 'failed' ? (
        <div className="stack">
          <p role="alert" className="alert">
            {t('prep.failed')}
          </p>
          <BatchForm {...ids} action={resumePrepAction} label={t('prep.retry')} />
        </div>
      ) : null}

      {batch.status === 'ready' ? (
        <section className="stack" aria-labelledby="prep-review-heading">
          <h2 id="prep-review-heading">{t('prep.review')}</h2>
          <p className="hint">{t('prep.reviewIntro')}</p>
          <PrepReview
            locale={locale}
            batchId={batch.id}
            items={batch.items}
            parentEmail={batch.parentEmail}
            recipients={recipients}
          />
        </section>
      ) : null}

      {batch.status === 'published' ? <Published batch={batch} locale={locale} /> : null}

      {batch.status === 'running' ? null : (
        <BatchForm {...ids} action={deletePrepAction} label={t('prep.delete')} secondary />
      )}
    </section>
  );
}
