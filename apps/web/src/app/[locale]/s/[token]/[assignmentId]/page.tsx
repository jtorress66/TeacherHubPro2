import type { Metadata } from 'next';
import Link from 'next/link';
import type { AssignmentId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { StudentAssignment } from '../../../../../components/student-assignment.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; token: string; assignmentId: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** One assignment to answer from a student's link: questions without answers, and files. */
export default async function StudentAssignmentPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { token, assignmentId } = await props.params;
  const found = await getAppContainer().getStudentAssignment.execute({
    token,
    assignmentId: assignmentId as AssignmentId,
  });
  if (!found.ok) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('student.notFound')}
        </p>
      </main>
    );
  }

  return (
    <main className="student-page stack">
      <p>
        <Link href={`/${locale}/s/${token}`}>← {t('student.back')}</Link>
      </p>
      <StudentAssignment
        locale={locale}
        view={found.value}
        token={token}
        fileHref={(fileId) => `/api/s/${token}/attachments/${fileId}`}
      />
    </main>
  );
}
