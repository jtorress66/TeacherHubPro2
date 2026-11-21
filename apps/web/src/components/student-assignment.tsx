import type { StudentAssignmentView } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';
import { ReadAloud } from './read-aloud.tsx';
import { StudentAnswerForm } from './student-forms.tsx';

/**
 * One assignment as a student sees it: instructions, files, the questions to answer (without
 * answers) or, once handed in, when and the grade the teacher confirmed.
 */
export function StudentAssignment(props: {
  readonly locale: Locale;
  readonly view: StudentAssignmentView;
  /** The student's link token; null for a student let in by a pass. */
  readonly token: string | null;
  /** Where each file opens. */
  readonly fileHref: (fileId: string) => string;
}) {
  const { locale, view, token } = props;
  const t = createTranslator(locale);
  const { assignment, questions, attachments, submission } = view;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return (
    <>
      <h1>{assignment.title}</h1>
      {assignment.instructions === null ? null : (
        <div className="stack">
          <p>{assignment.instructions}</p>
          <p>
            <ReadAloud
              locale={locale}
              language={locale}
              text={assignment.instructions}
              context={t('student.listenInstructions')}
            />
          </p>
        </div>
      )}
      {attachments.length === 0 ? null : (
        <section className="stack" aria-labelledby="files-heading">
          <h2 id="files-heading">{t('student.files')}</h2>
          <ul className="list">
            {attachments.map((file) => (
              <li key={file.id}>
                <a href={props.fileHref(file.id)}>{file.name}</a>
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
    </>
  );
}
