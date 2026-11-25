import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  coverageStatuses,
  onTrackPercent,
  watchPercent,
  type ClassId,
  type CoverageStatus,
} from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { TableScroll } from '../../../../../../components/table-scroll.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { formatPercent } from '../../../../../../server/gradebook-display.ts';
import { standardSourceName } from '../../../../../../server/standard-source.ts';
import {
  coverageFilter,
  filterCoverage,
} from '../../../../../../server/standards-coverage-view.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string }>;
  readonly searchParams: Promise<{ status?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Each standard a class planned or tested, and how the class did on it. Counts only. */
export default async function StandardsCoveragePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const input = { actor: user, classId: classId as ClassId };
  const [found, coverage] = await Promise.all([
    app.getClass.execute(input),
    app.getStandardsCoverage.execute(input),
  ]);
  if (!found.ok || !coverage.ok) notFound();
  const cls = found.value;
  const { rows, summary } = coverage.value;
  const status = coverageFilter((await props.searchParams).status);
  const shown = filterCoverage(rows, status);
  const base = `/${locale}/app/classes/${cls.id}`;
  // Plan weeks are calendar dates, so they are read and shown in UTC.
  const week = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const filters: { status: CoverageStatus | null; label: string }[] = [
    { status: null, label: `${t('standards.coverageAll')} (${String(rows.length)})` },
    ...coverageStatuses.map((s) => ({
      status: s,
      label: `${t(`standards.coverage_${s}`)} (${String(summary[s])})`,
    })),
  ];

  return (
    <section className="stack report">
      <p className="no-print">
        <Link href={base}>← {t('gradebook.backToClass')}</Link>
      </p>
      <h1>
        {t('standards.coverageTitle')}: {cls.name}
      </h1>
      <p>{t('standards.coverageIntro')}</p>
      {rows.length === 0 ? (
        <p className="notice">{t('standards.coverageEmpty')}</p>
      ) : (
        <>
          <p className="no-print">
            <PrintButton locale={locale} />
          </p>
          <nav aria-label={t('standards.coverageFilter')} className="no-print">
            <p className="actions">
              {filters.map((filter) => (
                <Link
                  key={filter.status ?? 'all'}
                  href={
                    filter.status === null
                      ? `${base}/standards`
                      : `${base}/standards?status=${filter.status}`
                  }
                  className={filter.status === status ? 'button' : 'button secondary'}
                  aria-current={filter.status === status ? 'page' : undefined}
                >
                  {filter.label}
                </Link>
              ))}
            </p>
          </nav>
          {shown.length === 0 ? (
            <p className="muted">{t('standards.coverageFilterEmpty')}</p>
          ) : (
            <TableScroll>
              <table
                className="roster standards-coverage"
                aria-label={t('standards.coverageTitle')}
              >
                <thead>
                  <tr>
                    <th scope="col">{t('standards.coverageStandard')}</th>
                    <th scope="col">{t('standards.coveragePlanned')}</th>
                    <th scope="col">{t('standards.coverageAssignments')}</th>
                    <th scope="col">{t('standards.coverageAverage')}</th>
                    <th scope="col">{t('standards.coverageBelow', { percent: watchPercent })}</th>
                    <th scope="col">{t('standards.coverageStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.standard.code} data-testid="coverage-row">
                      <th scope="row">
                        <span className="standard-code">{row.standard.code}</span>
                        <span className="muted"> · {standardSourceName(locale, row.standard)}</span>
                        {row.standard.description === null ? null : (
                          <span className="hint standard-description">
                            {row.standard.description}
                          </span>
                        )}
                      </th>
                      <td>
                        {row.plannedWeeks.length === 0
                          ? t('standards.coverageNotPlanned')
                          : row.plannedWeeks
                              .map((date) => week.format(new Date(`${date}T00:00:00Z`)))
                              .join(', ')}
                      </td>
                      <td>{row.assignments}</td>
                      <td>{formatPercent(row.average, locale)}</td>
                      <td>{row.average === null ? '—' : row.studentsBelow}</td>
                      <td>
                        <span className={`coverage coverage-${row.status}`}>
                          {t(`standards.coverage_${row.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
          <p className="hint">
            {t('standards.coverageLegend', { onTrack: onTrackPercent, watch: watchPercent })}
          </p>
          <p className="muted">{t('standards.coverageNote')}</p>
        </>
      )}
    </section>
  );
}
