import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { SemesterForm } from '../../../../../components/roster-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; semesterId: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('semesters.editTitle') };
}

export default async function EditSemesterPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { semesterId } = await props.params;
  const { user } = await requireUser(locale);
  const semesters = await getAppContainer().listSemesters.execute({ actor: user });
  const semester = semesters.find((s) => s.id === semesterId);
  if (semester === undefined) notFound();

  return (
    <section className="stack narrow">
      <p>
        <Link href={`/${locale}/app/semesters`}>← {t('semesters.back')}</Link>
      </p>
      <h1>{t('semesters.editTitle')}</h1>
      <SemesterForm locale={locale} semester={semester} />
    </section>
  );
}
