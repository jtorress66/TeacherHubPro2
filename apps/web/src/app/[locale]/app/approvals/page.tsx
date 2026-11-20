import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { approvalActions, isAdminOf } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import {
  approvalCells,
  approvalsQueryFrom,
  approvalsSearch,
  type SearchParams,
} from '../../../../server/approvals-view.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';
import { TableScroll } from '../../../../components/table-scroll.tsx';

type Props = LocaleParams & { readonly searchParams: Promise<SearchParams> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

const text = (value: string | readonly string[] | undefined): string =>
  typeof value === 'string' ? value : '';

/**
 * Who approved which AI work before it reached students or families: everyone's for school
 * admins, a teacher's own for teachers. Names of teachers and classes only, never students.
 */
export default async function ApprovalsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const search = await props.searchParams;
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const timeZone = await teacherTimeZone();
  const listed = await getAppContainer().listApprovals.execute({
    actor: user,
    schoolId: school.id,
    filter: approvalsQueryFrom(search, timeZone),
  });
  if (!listed.ok) notFound();
  const { rows, teachers, limited } = listed.value;
  const admin = isAdminOf(user, school.id);
  const when = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });

  return (
    <section className="stack">
      <h1>{t('approvals.title')}</h1>
      <p>{t('approvals.intro')}</p>
      <p className="hint">
        {admin ? '' : `${t('approvals.ownOnly')} `}
        {t('approvals.before')}
      </p>
      <form method="get" className="field-row" role="search" aria-label={t('approvals.filters')}>
        <div className="field">
          <label htmlFor="approvals-type">{t('approvals.type')}</label>
          <select id="approvals-type" name="type" defaultValue={text(search.type)}>
            <option value="">{t('approvals.allTypes')}</option>
            {approvalActions.map((action) => (
              <option key={action} value={action}>
                {t(`approvals.type_${action}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="approvals-from">{t('approvals.fromDate')}</label>
          <input id="approvals-from" type="date" name="from" defaultValue={text(search.from)} />
        </div>
        <div className="field">
          <label htmlFor="approvals-to">{t('approvals.toDate')}</label>
          <input id="approvals-to" type="date" name="to" defaultValue={text(search.to)} />
        </div>
        {admin ? (
          <div className="field">
            <label htmlFor="approvals-teacher">{t('approvals.teacher')}</label>
            <select id="approvals-teacher" name="teacher" defaultValue={text(search.teacher)}>
              <option value="">{t('approvals.allTeachers')}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field">
          <button type="submit" className="button secondary">
            {t('approvals.apply')}
          </button>
        </div>
      </form>
      <p>
        <a href={`/api/approvals?${approvalsSearch(search, locale)}`} download>
          {t('approvals.download')}
        </a>
      </p>
      {rows.length === 0 ? (
        <p className="muted">{t('approvals.empty')}</p>
      ) : (
        <TableScroll>
          <table className="roster" aria-label={t('approvals.title')}>
            <thead>
              <tr>
                <th scope="col">{t('approvals.when')}</th>
                <th scope="col">{t('approvals.teacher')}</th>
                <th scope="col">{t('approvals.what')}</th>
                <th scope="col">{t('approvals.item')}</th>
                <th scope="col">{t('approvals.className')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const [at, teacher, what, item, className] = approvalCells(row, t, when, locale);
                return (
                  <tr key={row.event.id}>
                    <td>{at}</td>
                    <td>{teacher}</td>
                    <td>{what}</td>
                    <td>{item}</td>
                    <td>{className}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableScroll>
      )}
      {limited ? <p className="hint">{t('approvals.limit', { count: rows.length })}</p> : null}
    </section>
  );
}
