import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AssignmentId, ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  AttachmentUploadForm,
  PdfImportForm,
  ShareToClassroomForm,
} from '../../../../../../../../components/assignment-tools.tsx';
import { QuestionBuilder } from '../../../../../../../../components/question-builder.tsx';
import { getAppContainer } from '../../../../../../../../container.ts';
import { deleteAttachmentAction } from '../../../../../../../_lib/assignment-actions.ts';
import { requireUser } from '../../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string; assignmentId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The online assignment: questions, files, PDF import and sharing to Classroom. */
export default async function AssignmentQuestionsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, assignmentId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const ref = {
    actor: user,
    classId: classId as ClassId,
    assignmentId: assignmentId as AssignmentId,
  };
  const listed = await app.listSubmissions.execute(ref);
  if (!listed.ok) notFound();
  const { assignment, rows } = listed.value;
  const files = await app.listAttachments.execute(ref);
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const locked = rows.some((row) => row.submission !== null);
  const base = `/${locale}/app/classes/${classId}/assignments/${assignmentId}`;
  const ids = { locale, classId, assignmentId };

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('questions.back')}</Link>
      </p>
      <h1>
        {t('questions.title')}: {assignment.title}
      </h1>
      <p>{t('questions.intro')}</p>
      <p>
        <Link className="button secondary" href={`${base}/submissions`}>
          {t('questions.submissions')}
        </Link>
      </p>
      <QuestionBuilder
        locale={locale}
        classId={classId}
        assignmentId={assignmentId}
        questions={assignment.questions}
        instructions={assignment.instructions}
        locked={locked}
      />

      {locked ? null : (
        <section className="card stack" aria-labelledby="pdf-import-heading">
          <h2 id="pdf-import-heading">{t('pdfImport.title')}</h2>
          <p>{t('pdfImport.intro')}</p>
          <PdfImportForm {...ids} />
        </section>
      )}

      <section className="card stack" aria-labelledby="attachments-heading">
        <h2 id="attachments-heading">{t('attachments.title')}</h2>
        {files.ok && files.value.length > 0 ? (
          <ul className="list">
            {files.value.map((file) => (
              <li key={file.id}>
                <a
                  href={`/api/attachments/${file.id}?classId=${classId}&assignmentId=${assignmentId}`}
                >
                  {file.name}
                </a>{' '}
                <form action={deleteAttachmentAction} className="inline-form">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="classId" value={classId} />
                  <input type="hidden" name="assignmentId" value={assignmentId} />
                  <input type="hidden" name="attachmentId" value={file.id} />
                  <button type="submit" className="link-button">
                    {t('attachments.delete')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('attachments.empty')}</p>
        )}
        <AttachmentUploadForm {...ids} />
      </section>

      {courses.ok ? (
        <section className="card stack" aria-labelledby="classroom-share-heading">
          <h2 id="classroom-share-heading">{t('classroom.share')}</h2>
          <ShareToClassroomForm
            {...ids}
            courses={courses.value.map((course) => ({ id: course.id, name: course.name }))}
          />
        </section>
      ) : null}
    </section>
  );
}
