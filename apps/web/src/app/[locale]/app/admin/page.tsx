import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { assignableRoles } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { ActivityLog } from '../../../../components/activity-log.tsx';
import { RoleForm, SendLinkForm, TransferForm } from '../../../../components/admin-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** A school admin's users: roles, set-password links, and handing a teacher's classes over. */
export default async function SchoolUsersPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const rows = await getAppContainer().listSchoolUsers.execute({ actor: user });
  if (!rows.ok) notFound();
  const allowed = assignableRoles(user);

  return (
    <section className="stack">
      <h1>{t('admin.title')}</h1>
      <p>{t('admin.intro', { school: school.name })}</p>
      <div className="table-scroll">
        <table className="roster" aria-label={t('admin.title')}>
          <thead>
            <tr>
              <th scope="col">{t('admin.name')}</th>
              <th scope="col">{t('admin.email')}</th>
              <th scope="col">{t('admin.role')}</th>
              <th scope="col">{t('admin.classes')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('admin.sendLink')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.value.map(({ user: person, classes }) => {
              const editable = person.id !== user.id && allowed.includes(person.role);
              return (
                <tr key={person.id}>
                  <td>
                    {person.name}
                    {person.id === user.id ? ` (${t('admin.you')})` : ''}
                  </td>
                  <td>{person.email}</td>
                  <td>
                    {editable ? (
                      <RoleForm
                        locale={locale}
                        userId={person.id}
                        name={person.name}
                        role={person.role}
                        roles={allowed}
                      />
                    ) : (
                      t(`admin.role_${person.role}`)
                    )}
                  </td>
                  <td>{classes}</td>
                  <td>
                    <SendLinkForm locale={locale} userId={person.id} email={person.email} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="card stack" aria-labelledby="transfer-heading">
        <h2 id="transfer-heading">{t('admin.transfer')}</h2>
        <p className="hint">{t('admin.transferIntro')}</p>
        <TransferForm
          locale={locale}
          teachers={rows.value.map(({ user: person }) => ({ id: person.id, name: person.name }))}
        />
      </section>
      <ActivityLog
        locale={locale}
        actor={user}
        schoolId={school.id}
        names={new Map(rows.value.map(({ user: person }) => [person.id, person.name]))}
      />
    </section>
  );
}
