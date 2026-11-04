import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { DraftJobs } from '../../../../components/learning/draft-jobs.tsx';
import { DraftPathForm } from '../../../../components/learning/draft-path-form.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{ class?: string; jobs?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Learning paths for one class: draft with AI, review the drafts, follow each student. */
export default async function LearningPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const query = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const classes = await app.listClasses.execute({ actor: user });
  const cls = classes.find((c) => c.id === query.class) ?? classes[0];
  const base = `/${locale}/app/learning`;

  if (cls === undefined) {
    return (
      <section className="stack">
        <h1>{t('learning.title')}</h1>
        <p>{t('learning.noClasses')}</p>
      </section>
    );
  }

  const learning = await app.getClassLearning.execute({ actor: user, classId: cls.id });
  const rows = learning.ok ? learning.value.students : [];
  const drafts = learning.ok ? learning.value.drafts : [];
  const names = new Map(rows.map((row) => [row.studentId, row.firstName]));
  const jobIds = (query.jobs ?? '').split(',').filter((id) => /^[\w-]{1,100}$/u.test(id));
  const classHref = `${base}?class=${encodeURIComponent(cls.id)}`;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <h1>{t('learning.title')}</h1>
      <p>{t('learning.intro')}</p>
      <form method="get" action={base} className="field-row align-end">
        <div className="field">
          <label htmlFor="learning-class">{t('learning.class')}</label>
          <select id="learning-class" name="class" defaultValue={cls.id}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button secondary">
          {t('learning.show')}
        </button>
      </form>

      {jobIds.length > 0 ? (
        <DraftJobs locale={locale} jobIds={jobIds} doneHref={classHref} />
      ) : null}

      <h2>{t('learning.draftTitle')}</h2>
      <DraftPathForm
        locale={locale}
        classId={cls.id}
        grade={cls.grade}
        students={rows.map((row) => ({
          id: row.studentId,
          name: `${row.firstName} ${row.lastName}`,
        }))}
      />

      <h2>{t('learning.toReview')}</h2>
      {drafts.length === 0 ? (
        <p>{t('learning.noDrafts')}</p>
      ) : (
        <ul className="list" aria-label={t('learning.toReview')}>
          {drafts.map((path) => (
            <li key={path.id}>
              <Link href={`${base}/${path.id}`}>{path.title}</Link>{' '}
              <span className="chip">
                {t('learning.forStudent', { name: names.get(path.studentId) ?? '' })}
              </span>{' '}
              <span className="muted small">
                {t(`assistant.subject_${path.subject}`)} ·{' '}
                {t('learning.level', { level: path.level })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>{t('learning.progress')}</h2>
      <p className="hint">{t('learning.practiceNote')}</p>
      <table className="table" aria-label={t('learning.progress')}>
        <thead>
          <tr>
            <th scope="col">{t('learning.student')}</th>
            <th scope="col">{t('learning.lessonsDone')}</th>
            <th scope="col">{t('learning.average')}</th>
            <th scope="col">{t('learning.levels')}</th>
            <th scope="col">{t('learning.lastActivity')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>
                <Link href={`${base}/students/${row.studentId}`}>
                  {row.firstName} {row.lastName}
                </Link>
              </td>
              <td>{t('learning.lessonsOf', { done: row.done, total: row.total })}</td>
              <td>{row.average === null ? '—' : `${String(row.average)}%`}</td>
              <td>
                {row.levels
                  .map((l) =>
                    t('learning.levelOf', {
                      subject: t(`assistant.subject_${l.subject}` as Parameters<typeof t>[0]),
                      level: l.level,
                    }),
                  )
                  .join(', ') || '—'}
              </td>
              <td>
                {row.lastActivity === null ? t('learning.never') : day.format(row.lastActivity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
