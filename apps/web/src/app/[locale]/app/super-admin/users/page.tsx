import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { SchoolId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { AccountStatusForm } from '../../../../../components/protection-forms.tsx';
import { SuperAdminNav } from '../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly searchParams: Promise<{ q?: string; school?: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Users across every school, searched by name or email and filtered by school. */
export default async function UsersPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { q, school } = await props.searchParams;
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const [users, schools] = await Promise.all([
    app.listAllUsers.execute({
      actor: user,
      ...(q === undefined || q === '' ? {} : { text: q }),
      ...(school === undefined || school === '' ? {} : { schoolId: school as SchoolId }),
    }),
    app.listSchools.execute({ actor: user }),
  ]);
  if (!users.ok || !schools.ok) notFound();
  const base = `/${locale}/app/super-admin`;

  return (
    <section className="stack">
      <h1>{t('superAdmin.users')}</h1>
      <SuperAdminNav locale={locale} />
      <form method="get" className="field-row" role="search" aria-label={t('superAdmin.search')}>
        <div className="field">
          <label htmlFor="user-search">{t('superAdmin.search')}</label>
          <input id="user-search" name="q" type="search" defaultValue={q ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="user-school">{t('superAdmin.school')}</label>
          <select id="user-school" name="school" defaultValue={school ?? ''}>
            <option value="">{t('superAdmin.allSchools')}</option>
            {schools.value.map(({ school: s }) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <button type="submit" className="button">
            {t('superAdmin.filter')}
          </button>
        </div>
      </form>
      {users.value.length === 0 ? (
        <p className="muted">{t('superAdmin.noUsers')}</p>
      ) : (
        <ul className="list" aria-label={t('superAdmin.users')}>
          {users.value.map(({ user: person, schoolName, aiDrafts, heavyAiUse }) => (
            <li key={person.id}>
              <Link href={`${base}/schools/${person.schoolId}/users/${person.id}`}>
                {person.name}
              </Link>{' '}
              <span className="hint">
                {person.email} · {t(`admin.role_${person.role}`)} · {schoolName} ·{' '}
                {t('superAdmin.aiDrafts', { count: aiDrafts })}
              </span>{' '}
              {heavyAiUse ? <span className="chip">{t('superAdmin.heavyAiUse')}</span> : null}
              {person.role === 'super_admin' || person.id === user.id ? null : (
                <AccountStatusForm
                  locale={locale}
                  person={{
                    id: person.id,
                    schoolId: person.schoolId,
                    name: person.name,
                    email: person.email,
                  }}
                  suspended={person.suspendedAt !== null}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
