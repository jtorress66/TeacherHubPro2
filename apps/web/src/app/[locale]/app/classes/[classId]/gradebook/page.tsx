import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId, Grade } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  AddCategoryForm,
  AssignmentForm,
  CategoryRow,
} from '../../../../../../components/gradebook-forms.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import {
  formatPercent,
  formatPoints,
  letterBand,
} from '../../../../../../server/gradebook-display.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { addStandardCategoriesAction } from '../../../../../_lib/gradebook-actions.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** A grid cell: the score, or the status when there is no score. */
function Cell({ grade, locale }: { readonly grade: Grade | undefined; readonly locale: Locale }) {
  const t = createTranslator(locale);
  if (!grade || grade.status === 'pending') return <span className="muted">—</span>;
  if (grade.score === null) {
    return (
      <span className={`badge grade-${grade.status}`}>{t(`gradebook.status_${grade.status}`)}</span>
    );
  }
  return (
    <>
      {formatPoints(grade.score, locale)}
      {grade.status === 'late' ? (
        <span className="badge grade-late">{t('gradebook.status_late')}</span>
      ) : null}
    </>
  );
}

export default async function GradebookPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getGradebook.execute({
    actor: user,
    classId: classId as ClassId,
  });
  if (!found.ok) notFound();
  const { cls, editable, categories, totalWeight, assignments, rows } = found.value;
  const base = `/${locale}/app/classes/${cls.id}`;
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('gradebook.backToClass')}</Link>
      </p>
      <h1>
        {t('gradebook.open')}: {cls.name}
      </h1>
      <p className="actions">
        <Link href={`${base}/gradebook/report`} className="button secondary">
          {t('gradebook.report')}
        </Link>
        <Link href={`${base}/report-cards`} className="button secondary">
          {t('gradebook.reportCards')}
        </Link>
      </p>
      {editable ? null : (
        <p role="status" className="notice">
          {t('gradebook.archivedNotice')}
        </p>
      )}

      <div className="table-scroll">
        <table className="roster gradebook" data-testid="gradebook-grid">
          <thead>
            <tr>
              <th scope="col">{t('gradebook.student')}</th>
              {assignments.map((assignment) => (
                <th scope="col" key={assignment.id}>
                  <Link href={`${base}/assignments/${assignment.id}`}>{assignment.title}</Link>
                  <span className="muted small">
                    {categoryName.get(assignment.categoryId)} · {assignment.points}
                  </span>
                </th>
              ))}
              <th scope="col">{t('gradebook.overall')}</th>
              <th scope="col">{t('gradebook.letter')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, grades, summary }) => (
              <tr key={student.id} data-testid="gradebook-row">
                <th scope="row">
                  {student.lastName}, {student.firstName}
                </th>
                {assignments.map((assignment) => (
                  <td key={assignment.id}>
                    <Cell grade={grades[assignment.id]} locale={locale} />
                  </td>
                ))}
                <td data-testid="overall">{formatPercent(summary.overall, locale)}</td>
                <td>
                  <span className={`letter letter-${letterBand(summary.letter)}`}>
                    {summary.letter ?? '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assignments.length === 0 ? <p className="muted">{t('gradebook.noAssignments')}</p> : null}

      <section className="card stack" aria-labelledby="categories-heading">
        <h2 id="categories-heading">{t('gradebook.categories')}</h2>
        {categories.length === 0 ? (
          <>
            <p className="muted">{t('gradebook.noCategories')}</p>
            {editable ? (
              <form action={addStandardCategoriesAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="classId" value={cls.id} />
                <button type="submit" className="button">
                  {t('gradebook.useStandard')}
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <>
            <p className={totalWeight === 100 ? 'muted' : 'notice'} data-testid="total-weight">
              {totalWeight === 100
                ? t('gradebook.totalWeight', { total: totalWeight })
                : t('gradebook.weightWarning', { total: totalWeight })}
            </p>
            <table className="roster">
              <thead>
                <tr>
                  <th scope="col">{t('gradebook.category')}</th>
                  <th scope="col">{t('gradebook.weight')}</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) =>
                  editable ? (
                    <CategoryRow
                      key={category.id}
                      locale={locale}
                      classId={cls.id}
                      category={category}
                    />
                  ) : (
                    <tr key={category.id}>
                      <td>{category.name}</td>
                      <td>{category.weightPercent}</td>
                      <td />
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </>
        )}
        {editable ? <AddCategoryForm locale={locale} classId={cls.id} /> : null}
      </section>

      {editable ? (
        <section className="card stack" aria-labelledby="new-assignment-heading">
          <h2 id="new-assignment-heading">{t('gradebook.newAssignment')}</h2>
          {categories.length === 0 ? (
            <p className="muted">{t('gradebook.needCategory')}</p>
          ) : (
            <AssignmentForm locale={locale} classId={cls.id} categories={categories} />
          )}
        </section>
      ) : null}
    </section>
  );
}
