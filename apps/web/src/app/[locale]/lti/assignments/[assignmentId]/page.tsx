import type { Metadata } from 'next';
import type { AssignmentId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { StudentAssignment } from '../../../../../components/student-assignment.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { passFor } from '../../../../_lib/lti-pass.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; assignmentId: string }>;
};

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/**
 * An assignment a student opened from their course system: their pass (a cookie from the launch)
 * opens this one assignment for them, and their answers are theirs on the class list.
 */
export default async function LtiStudentAssignmentPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { assignmentId } = await props.params;
  const id = assignmentId as AssignmentId;
  const lti = getAppContainer().lti;
  const found =
    lti === null
      ? null
      : await getAppContainer().getStudentAssignment.execute({
          pass: await passFor({ kind: 'assignment', id }),
          assignmentId: id,
        });
  if (found?.ok !== true) {
    return (
      <main className="student-page">
        <p role="alert" className="alert">
          {t('lti.problem_expired')}
        </p>
      </main>
    );
  }
  return (
    <main className="student-page stack">
      <StudentAssignment
        locale={locale}
        view={found.value}
        token={null}
        fileHref={(fileId) => `/api/lti/assignments/${id}/attachments/${fileId}`}
      />
    </main>
  );
}
