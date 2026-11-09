import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { maxRubricPoints, type RubricId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; rubricId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The rubric as a table, for printing or the browser's Save as PDF. */
export default async function PrintRubricPage(props: Props) {
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

  return (
    <article className="stack">
      <p className="actions no-print">
        <Link href={`/${locale}/app/rubrics/${rubric.id}`}>← {t('rubrics.back')}</Link>
        <PrintButton locale={locale} />
      </p>
      <h1>{rubric.title}</h1>
      <table className="rubric-grid">
        <thead>
          <tr>
            <th scope="col">{t('rubrics.criterion')}</th>
            {rubric.levels.map((level, column) => (
              <th scope="col" key={column}>
                {level.label} ({level.points})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rubric.criteria.map((criterion, row) => (
            <tr key={row}>
              <th scope="row">{criterion.name}</th>
              {criterion.descriptors.map((descriptor, column) => (
                <td key={column}>{descriptor}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>{t('rubrics.total', { points: maxRubricPoints(rubric) })}</p>
    </article>
  );
}
