'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thp/i18n';

export interface JobStatusReply {
  readonly status: 'queued' | 'running' | 'completed' | 'failed';
  readonly message?: string;
}

/** Polls a job's status for its owner; reading never changes the job. */
export function useJobStatus(
  jobId: string | null,
  locale: Locale,
  intervalMs = 1500,
): JobStatusReply | null {
  const [reply, setReply] = useState<JobStatusReply | null>(null);

  useEffect(() => {
    setReply(null);
  }, [jobId]);

  useEffect(() => {
    if (jobId === null || reply?.status === 'completed' || reply?.status === 'failed') return;
    const timer = setTimeout(() => {
      fetch(`/api/jobs/${jobId}?locale=${locale}`, { cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<JobStatusReply>) : null))
        .then((next) => {
          setReply(next ?? { status: 'failed' });
        })
        .catch(() => undefined);
    }, intervalMs);
    return () => {
      clearTimeout(timer);
    };
  }, [jobId, locale, intervalMs, reply]);

  return reply;
}

/**
 * Waits for a job, then opens what it made: `doneHref`, or, without one, the same page again so
 * the server can send the teacher on.
 */
export function JobProgress(props: {
  readonly locale: Locale;
  readonly jobId: string;
  readonly doneHref?: string;
  readonly retryHref: string;
  readonly labels: {
    readonly working: string;
    readonly failed: string;
    readonly tryAgain: string;
    readonly open: string;
  };
  readonly intervalMs?: number;
}) {
  const router = useRouter();
  const reply = useJobStatus(props.jobId, props.locale, props.intervalMs);
  const status = reply?.status ?? 'queued';
  const { doneHref, labels } = props;

  useEffect(() => {
    if (status !== 'completed') return;
    if (doneHref === undefined) router.refresh();
    else router.push(doneHref);
  }, [status, router, doneHref]);

  if (status === 'failed') {
    return (
      <div className="stack">
        <p role="alert" className="alert">
          {reply?.message ?? labels.failed}
        </p>
        <p>
          <a className="button" href={props.retryHref}>
            {labels.tryAgain}
          </a>
        </p>
      </div>
    );
  }
  return (
    <p role="status" className="notice" aria-live="polite">
      {status === 'completed' && doneHref !== undefined ? (
        <a href={doneHref}>{labels.open}</a>
      ) : (
        labels.working
      )}
    </p>
  );
}
