import type { Metadata } from 'next';
import Link from 'next/link';
import type { AssignmentId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { StudentAnswerForm } from '../../../../../components/student-forms.tsx';
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
  const { assignment, questions, attachments, submission } = found.value;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <main className="student-page stack">
      <p>
        <Link href={`/${locale}/s/${token}`}>← {t('student.back')}</Link>
      </p>
      <h1>{assignment.title}</h1>
      {assignment.instructions === null ? null : <p>{assignment.instructions}</p>}
      {attachments.length === 0 ? null : (
        <section className="stack" aria-labelledby="files-heading">
          <h2 id="files-heading">{t('student.files')}</h2>
          <ul className="list">
            {attachments.map((file) => (
              <li key={file.id}>
                <a href={`/api/s/${token}/attachments/${file.id}`}>{file.name}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
      {submission === null ? (
        questions.length === 0 ? null : (
          <StudentAnswerForm
            locale={locale}
            token={token}
            assignmentId={assignment.id}
            questions={questions}
          />
        )
      ) : (
        <div className="stack">
          <p role="status" className="notice">
            {t('student.submitted', { date: day.format(submission.submittedAt) })}
          </p>
          {submission.late ? <p className="muted">{t('student.late')}</p> : null}
          {submission.finalScore === null ? null : (
            <p>
              <strong>
                {t('student.grade', { score: submission.finalScore, max: submission.maxPoints })}
              </strong>
            </p>
          )}
        </div>
      )}
    </main>
  );
}
