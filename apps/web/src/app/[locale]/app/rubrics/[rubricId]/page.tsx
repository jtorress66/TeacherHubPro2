import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { maxRubricPoints, type RubricId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { DeleteRubricForm, RubricEditor } from '../../../../../components/rubric-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; rubricId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Edits one of the teacher's rubrics. Only its owner reaches it. */
export default async function RubricPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { rubricId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getRubric.execute({
    actor: user,
    rubricId: rubricId as RubricId,
  });
  if (!found.ok) notFound();
  const rubric = found.value;
  const base = `/${locale}/app/rubrics`;

  return (
    <section className="stack">
      <p className="actions">
        <Link href={base}>← {t('rubrics.back')}</Link>
        <Link href={`${base}/${rubric.id}/print`}>{t('rubrics.print')}</Link>
      </p>
      <h1>{rubric.title}</h1>
      <p className="hint">{t('rubrics.total', { points: maxRubricPoints(rubric) })}</p>
      <RubricEditor locale={locale} rubric={rubric} />
      <DeleteRubricForm locale={locale} rubricId={rubric.id} />
    </section>
  );
}
