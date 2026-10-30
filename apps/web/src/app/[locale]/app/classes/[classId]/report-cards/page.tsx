import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { CommentForm } from '../../../../../../components/gradebook-forms.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { formatPercent } from '../../../../../../server/gradebook-display.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function ReportCardsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getReportCards.execute({
    actor: user,
    classId: classId as ClassId,
  });
  if (!found.ok) notFound();
  const { cls, cards } = found.value;
  const base = `/${locale}/app/classes/${cls.id}`;
  const pdf = `${base}/report-cards/pdf`;
  const editable = cls.archivedAt === null;

  return (
    <section className="stack">
      <p>
        <Link href={`${base}/gradebook`}>← {t('gradebook.back')}</Link>
      </p>
      <h1>
        {t('reportCards.title')}: {cls.name}
      </h1>
      <p className="muted">{t('reportCards.intro')}</p>
      {cards.length === 0 ? (
        <p className="muted">{t('reportCards.noStudents')}</p>
      ) : (
        <>
          <p>
            <a href={pdf} className="button" download data-testid="download-all">
              {t('reportCards.downloadAll', { count: cards.length })}
            </a>
          </p>
          <ul className="card-list">
            {cards.map(({ student, summary, comment }) => {
              const name = `${student.firstName} ${student.lastName}`;
              return (
                <li key={student.id} className="card stack" data-testid="report-card">
                  <h2>
                    {student.lastName}, {student.firstName}{' '}
                    <span className="muted">
                      {formatPercent(summary.overall, locale)}
                      {summary.letter ? ` (${summary.letter})` : ''}
                    </span>
                  </h2>
                  <CommentForm
                    locale={locale}
                    classId={cls.id}
                    studentId={student.id}
                    name={name}
                    comment={comment}
                    editable={editable}
                  />
                  <p>
                    <a
                      href={`${pdf}?student=${encodeURIComponent(student.id)}`}
                      className="button secondary"
                      download
                      aria-label={t('reportCards.downloadFor', { name })}
                    >
                      {t('reportCards.download')}
                    </a>
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
