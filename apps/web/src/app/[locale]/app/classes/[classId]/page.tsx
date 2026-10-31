import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import {
  AddStudentForm,
  ClassForm,
  ImportStudentsForm,
} from '../../../../../components/roster-forms.tsx';
import { ImportRosterForm } from '../../../../../components/assignment-tools.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { scheduleSummary } from '../../../../../server/schedule-summary.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import {
  archiveClassAction,
  deleteStudentAction,
  restoreClassAction,
} from '../../../../_lib/roster-actions.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; classId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function ClassPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const found = await app.getClass.execute({ actor: user, classId: classId as ClassId });
  if (!found.ok) notFound();
  const cls = found.value;
  const [students, semesters] = await Promise.all([
    app.listStudents.execute({ actor: user, classId: cls.id }),
    app.listSemesters.execute({ actor: user }),
  ]);
  const roster = students.ok ? students.value : [];
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const archived = cls.archivedAt !== null;

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/classes`}>← {t('classes.back')}</Link>
      </p>
      <h1>{cls.name}</h1>
      <p className="muted" data-testid="class-schedule">
        {scheduleSummary(cls.schedule, locale)}
      </p>
      <p className="actions">
        <Link href={`/${locale}/app/classes/${cls.id}/attendance`} className="button">
          {t('attendance.take')}
        </Link>
        <Link
          href={`/${locale}/app/classes/${cls.id}/attendance/report`}
          className="button secondary"
        >
          {t('attendance.report')}
        </Link>
        <Link href={`/${locale}/app/classes/${cls.id}/gradebook`} className="button secondary">
          {t('gradebook.open')}
        </Link>
        <Link href={`/${locale}/app/classes/${cls.id}/report-cards`} className="button secondary">
          {t('gradebook.reportCards')}
        </Link>
        <Link href={`/${locale}/app/classes/${cls.id}/student-links`} className="button secondary">
          {t('studentLinks.open')}
        </Link>
        <Link href={`/${locale}/app/classes/${cls.id}/sub-packet`} className="button secondary">
          {t('subPacket.open')}
        </Link>
      </p>
      {archived ? (
        <p role="status" className="notice">
          {t('classes.archivedNotice')}
        </p>
      ) : null}
      <form action={archived ? restoreClassAction : archiveClassAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="classId" value={cls.id} />
        <button type="submit" className="button secondary">
          {archived ? t('classes.restore') : t('classes.archive')}
        </button>
      </form>

      <section className="stack" aria-labelledby="roster-heading">
        <h2 id="roster-heading">
          {t('students.roster')}{' '}
          <span className="muted">({t('classes.studentCount', { count: roster.length })})</span>
        </h2>
        {roster.length === 0 ? (
          <p className="muted">{t('students.empty')}</p>
        ) : (
          <table className="roster">
            <thead>
              <tr>
                <th scope="col">{t('students.lastName')}</th>
                <th scope="col">{t('students.firstName')}</th>
                <th scope="col">{t('students.studentNumber')}</th>
                <th scope="col">
                  <span className="visually-hidden">{t('students.edit')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {roster.map((student) => (
                <tr key={student.id}>
                  <td>{student.lastName}</td>
                  <td>{student.firstName}</td>
                  <td>{student.studentNumber ?? ''}</td>
                  <td className="row-actions">
                    {archived ? null : (
                      <>
                        <Link
                          href={`/${locale}/app/classes/${cls.id}/students/${student.id}`}
                          aria-label={`${t('students.edit')} ${student.firstName} ${student.lastName}`}
                        >
                          {t('students.edit')}
                        </Link>
                        <form action={deleteStudentAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="classId" value={cls.id} />
                          <input type="hidden" name="studentId" value={student.id} />
                          <button
                            type="submit"
                            className="link-button"
                            aria-label={`${t('students.delete')} ${student.firstName} ${student.lastName}`}
                          >
                            {t('students.delete')}
                          </button>
                        </form>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {archived ? null : (
        <div className="settings-grid">
          <section className="card stack" aria-labelledby="add-student-heading">
            <h2 id="add-student-heading">{t('students.add')}</h2>
            <AddStudentForm locale={locale} classId={cls.id} />
          </section>
          <section className="card stack" aria-labelledby="import-heading">
            <h2 id="import-heading">{t('students.importTitle')}</h2>
            <ImportStudentsForm locale={locale} classId={cls.id} />
          </section>
        </div>
      )}
      {archived ? null : (
        <details className="card">
          <summary>{t('classes.save')}</summary>
          <ClassForm locale={locale} semesters={semesters} cls={cls} />
        </details>
      )}
      {courses.ok && !archived ? (
        <section className="card stack" aria-labelledby="classroom-import-heading">
          <h2 id="classroom-import-heading">{t('classroom.importRoster')}</h2>
          <ImportRosterForm
            locale={locale}
            classId={cls.id}
            courses={courses.value.map((course) => ({ id: course.id, name: course.name }))}
          />
        </section>
      ) : null}
    </section>
  );
}
