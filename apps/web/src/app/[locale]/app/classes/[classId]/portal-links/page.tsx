import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  EmailPortalLinkForm,
  NewPortalLinkForm,
} from '../../../../../../components/portal-link-tools.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { revokePortalLinkAction } from '../../../../../_lib/portal-actions.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Each family's portal link: email it, make a new one to copy, or revoke it. */
export default async function PortalLinksPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const listed = await app.listPortalLinks.execute({ actor: user, classId: classId as ClassId });
  if (!listed.ok) notFound();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/classes/${classId}`}>← {t('portalLinks.back')}</Link>
      </p>
      <h1>{t('portalLinks.title')}</h1>
      <p>{t('portalLinks.intro')}</p>
      {app.mailDelivers ? null : <p className="notice">{t('portalLinks.noEmailYet')}</p>}
      <ul className="list portal-links" aria-label={t('portalLinks.title')}>
        {listed.value.map(({ student, link, usable }) => {
          const name = `${student.firstName} ${student.lastName}`;
          const status =
            link === null
              ? t('portalLinks.status_none')
              : usable
                ? t('portalLinks.status_active', { date: day.format(link.expiresAt) })
                : link.revokedAt !== null
                  ? t('portalLinks.status_revoked')
                  : t('portalLinks.status_expired');
          const refs = { locale, classId, studentId: student.id, name };
          return (
            <li key={student.id} className="card stack">
              <h2>{name}</h2>
              <p>
                <span className="chip">{status}</span>
                {usable && link?.sentTo ? (
                  <span className="muted small">
                    {' '}
                    {t('portalLinks.sentTo', { email: link.sentTo })}
                  </span>
                ) : null}
              </p>
              {app.mailDelivers ? (
                <EmailPortalLinkForm {...refs} parentEmail={student.parentEmail ?? ''} />
              ) : null}
              <div className="button-row">
                <NewPortalLinkForm {...refs} />
                {link !== null && usable ? (
                  <form action={revokePortalLinkAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="classId" value={classId} />
                    <input type="hidden" name="linkId" value={link.id} />
                    <button
                      type="submit"
                      className="button quiet"
                      aria-label={`${t('portalLinks.revoke')}: ${name}`}
                    >
                      {t('portalLinks.revoke')}
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
