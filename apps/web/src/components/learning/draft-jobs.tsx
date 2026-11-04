'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTranslator, type Locale } from '@thp/i18n';
import type { JobStatusReply } from '../job-progress.tsx';

type Status = JobStatusReply['status'];

const finished = (status: Status): boolean => status === 'completed' || status === 'failed';

/**
 * Waits for a batch of path drafts (one job per student), then reloads the class page without
 * them, where the new drafts wait for review.
 */
export function DraftJobs(props: {
  readonly locale: Locale;
  readonly jobIds: readonly string[];
  readonly doneHref: string;
  readonly intervalMs?: number;
}) {
  const t = createTranslator(props.locale);
  const router = useRouter();
  const [statuses, setStatuses] = useState<Readonly<Record<string, Status>>>({});
  const all = props.jobIds.map((id) => statuses[id] ?? 'queued');
  const done = all.filter(finished).length;
  const failed = all.filter((status) => status === 'failed').length;
  const complete = done === props.jobIds.length;

  useEffect(() => {
    if (complete) {
      if (failed === 0) router.replace(props.doneHref);
      return;
    }
    const timer = setTimeout(() => {
      const pending = props.jobIds.filter((id) => !finished(statuses[id] ?? 'queued'));
      void Promise.all(
        pending.map((id) =>
          fetch(`/api/jobs/${id}?locale=${props.locale}`, { cache: 'no-store' })
            .then((r) =>
              r.ok ? (r.json() as Promise<JobStatusReply>) : { status: 'failed' as const },
            )
            .then((reply) => [id, reply.status] as const)
            .catch(() => [id, 'queued' as const] as const),
        ),
      ).then((replies) => {
        setStatuses((current) => ({ ...current, ...Object.fromEntries(replies) }));
      });
    }, props.intervalMs ?? 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [complete, failed, props, router, statuses]);

  if (complete && failed > 0) {
    return (
      <p role="alert" className="alert">
        {t('learning.draftFailed', { count: failed })}{' '}
        <a href={props.doneHref}>{t('learning.toReview')}</a>
      </p>
    );
  }
  return (
    <p role="status" className="notice">
      {t('learning.drafting', { done, total: props.jobIds.length })}
    </p>
  );
}
