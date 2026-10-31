import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AssignmentId, ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  AssignmentForm,
  GradeEntryForm,
} from '../../../../../../../components/gradebook-forms.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { deleteAssignmentAction } from '../../../../../../_lib/gradebook-actions.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string; assignmentId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function AssignmentPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, assignmentId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const input = { actor: user, classId: classId as ClassId };
  const entry = await app.getGradeEntry.execute({
    ...input,
    assignmentId: assignmentId as AssignmentId,
  });
  if (!entry.ok) notFound();
  const categories = await app.listGradeCategories.execute(input);
  const { assignment, maxPoints, editable, rows } = entry.value;
  const gradebook = `/${locale}/app/classes/${classId}/gradebook`;

  return (
    <section className="stack">
      <p>
        <Link href={gradebook}>← {t('gradebook.back')}</Link>
      </p>
      <h1>
        {t('gradebook.enterGrades')}: {assignment.title}
      </h1>
      <p className="button-row">
        <Link
          className="button"
          href={`/${locale}/app/classes/${classId}/assignments/${assignment.id}/questions`}
        >
          {t('questions.open')}
        </Link>
        <Link
          className="button secondary"
          href={`/${locale}/app/classes/${classId}/assignments/${assignment.id}/submissions`}
        >
          {t('questions.submissions')}
        </Link>
      </p>
      {editable ? null : (
        <p role="status" className="notice">
          {t('gradebook.archivedNotice')}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="muted">{t('gradebook.noStudents')}</p>
      ) : (
        <GradeEntryForm
          locale={locale}
          classId={classId}
          assignmentId={assignment.id}
          maxPoints={maxPoints}
          editable={editable}
          rows={rows.map(({ student, grade }) => ({
            studentId: student.id,
            name: `${student.lastName}, ${student.firstName}`,
            status: grade?.status ?? null,
            score: grade?.score ?? null,
            comment: grade?.comment ?? null,
          }))}
        />
      )}

      {editable && categories.ok ? (
        <section className="card stack" aria-labelledby="edit-assignment-heading">
          <h2 id="edit-assignment-heading">{t('gradebook.editAssignment')}</h2>
          <AssignmentForm
            locale={locale}
            classId={classId}
            categories={categories.value}
            assignment={assignment}
          />
          <form action={deleteAssignmentAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="classId" value={classId} />
            <input type="hidden" name="assignmentId" value={assignment.id} />
            <button type="submit" className="button secondary">
              {t('gradebook.deleteAssignment')}
            </button>
          </form>
        </section>
      ) : null}
    </section>
  );
}
