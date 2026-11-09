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
  const overview = await app.getAssignmentOverview.execute({
    ...input,
    assignmentId: assignmentId as AssignmentId,
  });
  if (!overview.ok) notFound();
  const { assignment, maxPoints, editable, rows } = entry.value;
  const steps = overview.value;
  const gradebook = `/${locale}/app/classes/${classId}/gradebook`;
  const base = `/${locale}/app/classes/${classId}`;

  return (
    <section className="stack">
      <p>
        <Link href={gradebook}>← {t('gradebook.back')}</Link>
      </p>
      <h1>
        {t('gradebook.enterGrades')}: {assignment.title}
      </h1>
      <ol className="list prep-steps assignment-steps" aria-label={t('questions.stepsTitle')}>
        <li data-state={steps.ready ? 'done' : 'current'}>
          <h2>{t('questions.stepQuestions')}</h2>
          {steps.ready ? (
            <p>
              ✓{' '}
              {t('questions.stepQuestionsDone', {
                questions: steps.questionCount,
                files: steps.fileCount,
              })}
            </p>
          ) : (
            <p className="notice">{t('questions.stepNotVisible')}</p>
          )}
          <Link className="button" href={`${base}/assignments/${assignment.id}/questions`}>
            {t('questions.open')}
          </Link>
        </li>
        <li data-state={steps.linkedCount === steps.studentCount ? 'done' : 'current'}>
          <h2>{t('questions.stepShare')}</h2>
          <p>
            {t('questions.stepLinked', { linked: steps.linkedCount, total: steps.studentCount })}
          </p>
          <Link className="button secondary" href={`${base}/student-links`}>
            {t('studentLinks.open')}
          </Link>
        </li>
        <li data-state={steps.handedIn > 0 && steps.toReview === 0 ? 'done' : 'current'}>
          <h2>{t('questions.stepAnswers')}</h2>
          <p>
            {t('questions.stepHandedIn', { handedIn: steps.handedIn, toReview: steps.toReview })}
          </p>
          <Link
            className="button secondary"
            href={`${base}/assignments/${assignment.id}/submissions`}
          >
            {t('questions.submissions')}
          </Link>
        </li>
      </ol>
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
