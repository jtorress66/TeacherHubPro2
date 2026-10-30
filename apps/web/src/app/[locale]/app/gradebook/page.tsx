import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function GradebookOverviewPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const classes = await getAppContainer().listClasses.execute({ actor: user });

  return (
    <section className="stack">
      <h1>{t('gradebook.title')}</h1>
      <p className="muted">{t('gradebook.overviewIntro')}</p>
      {classes.length === 0 ? (
        <p className="muted">{t('gradebook.noClasses')}</p>
      ) : (
        <table className="roster">
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id}>
                <th scope="row">{cls.name}</th>
                <td className="row-actions">
                  <Link
                    href={`/${locale}/app/classes/${cls.id}/gradebook`}
                    aria-label={`${t('gradebook.open')}: ${cls.name}`}
                  >
                    {t('gradebook.open')}
                  </Link>
                  <Link
                    href={`/${locale}/app/classes/${cls.id}/gradebook/report`}
                    aria-label={`${t('gradebook.report')}: ${cls.name}`}
                  >
                    {t('gradebook.report')}
                  </Link>
                  <Link
                    href={`/${locale}/app/classes/${cls.id}/report-cards`}
                    aria-label={`${t('gradebook.reportCards')}: ${cls.name}`}
                  >
                    {t('gradebook.reportCards')}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
