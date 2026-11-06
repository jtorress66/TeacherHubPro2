import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { SchoolId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  DeleteForm,
  EditUserForm,
  SendLinkForm,
} from '../../../../../../../../components/admin-forms.tsx';
import { SuperAdminNav } from '../../../../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../../../../container.ts';
import { requireUser } from '../../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; schoolId: string; userId: string }>;
  readonly searchParams: Promise<{ saved?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** One user: edit their name, email, role and school, send a password link, or delete them. */
export default async function UserPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { schoolId, userId } = await props.params;
  const { saved } = await props.searchParams;
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const [users, schools] = await Promise.all([
    app.listSchoolUsers.execute({ actor: user, schoolId: schoolId as SchoolId }),
    app.listSchools.execute({ actor: user }),
  ]);
  if (!users.ok || !schools.ok) notFound();
  const person = users.value.find((row) => row.user.id === userId)?.user;
  if (person === undefined) notFound();

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/super-admin/schools/${person.schoolId}`}>
          ← {schools.value.find((row) => row.school.id === person.schoolId)?.school.name}
        </Link>
      </p>
      <h1>{person.name}</h1>
      <SuperAdminNav locale={locale} />
      {saved === '1' ? (
        <p role="status" className="notice">
          {t('superAdmin.userSaved')}
        </p>
      ) : null}
      <EditUserForm
        locale={locale}
        user={person}
        schools={schools.value.map(({ school }) => ({ id: school.id, name: school.name }))}
      />
      <SendLinkForm
        locale={locale}
        userId={person.id}
        email={person.email}
        schoolId={person.schoolId}
      />
      <DeleteForm locale={locale} kind="user" schoolId={person.schoolId} userId={person.id} />
    </section>
  );
}
