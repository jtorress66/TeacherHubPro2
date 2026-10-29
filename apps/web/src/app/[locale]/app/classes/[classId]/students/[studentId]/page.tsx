import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { EditStudentForm } from '../../../../../../../components/roster-forms.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string; studentId: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('students.editTitle') };
}

export default async function EditStudentPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId, studentId } = await props.params;
  const { user } = await requireUser(locale);
  const roster = await getAppContainer().listStudents.execute({
    actor: user,
    classId: classId as ClassId,
  });
  const student = roster.ok ? roster.value.find((s) => s.id === studentId) : undefined;
  if (student === undefined) notFound();

  return (
    <section className="stack narrow">
      <p>
        <Link href={`/${locale}/app/classes/${classId}`}>← {t('students.roster')}</Link>
      </p>
      <h1>{t('students.editTitle')}</h1>
      <EditStudentForm locale={locale} student={student} />
    </section>
  );
}
