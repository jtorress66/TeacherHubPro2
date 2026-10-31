import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { IssueLinksForm } from '../../../../../../components/assignment-tools.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { revokeLinkAction } from '../../../../../_lib/assignment-actions.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Each student's personal link: issue, revoke and replace. Tokens are shown only when made. */
export default async function StudentLinksPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const listed = await app.listLinks.execute({ actor: user, classId: classId as ClassId });
  if (!listed.ok) notFound();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <p className="no-print">
        <Link href={`/${locale}/app/classes/${classId}`}>← {t('studentLinks.back')}</Link>
      </p>
      <h1>{t('studentLinks.title')}</h1>
      <p className="no-print">{t('studentLinks.intro')}</p>
      <IssueLinksForm locale={locale} classId={classId} label={t('studentLinks.issue')} />
      <table className="print-days no-print">
        <thead>
          <tr>
            <th scope="col">{t('studentLinks.student')}</th>
            <th scope="col">{t('studentLinks.status')}</th>
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {listed.value.map(({ student, link, usable }) => {
            const status =
              link === null
                ? t('studentLinks.status_none')
                : usable
                  ? t('studentLinks.status_active', { date: day.format(link.expiresAt) })
                  : link.revokedAt !== null
                    ? t('studentLinks.status_revoked')
                    : t('studentLinks.status_expired');
            return (
              <tr key={student.id}>
                <td>
                  {student.firstName} {student.lastName}
                </td>
                <td>{status}</td>
                <td className="button-row">
                  {link !== null && usable ? (
                    <form action={revokeLinkAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="classId" value={classId} />
                      <input type="hidden" name="linkId" value={link.id} />
                      <button type="submit" className="button secondary">
                        {t('studentLinks.revoke')}
                      </button>
                    </form>
                  ) : null}
                  <IssueLinksForm
                    locale={locale}
                    classId={classId}
                    studentId={student.id}
                    label={`${t('studentLinks.reissue')}: ${student.firstName}`}
                    secondary
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
