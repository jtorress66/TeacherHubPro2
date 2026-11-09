import type { Metadata } from 'next';
import Link from 'next/link';
import { maxRubricPoints } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { BlankRubricForm, RubricDraftForm } from '../../../../components/rubric-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The teacher's rubrics, and the two ways to start one: an AI draft or a blank grid. */
export default async function RubricsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const listed = await getAppContainer().listRubrics.execute({ actor: user });
  const rubrics = listed.ok ? listed.value : [];
  const base = `/${locale}/app/rubrics`;

  return (
    <section className="stack">
      <h1>{t('rubrics.heading')}</h1>
      <p>{t('rubrics.intro')}</p>
      {rubrics.length === 0 ? (
        <p>{t('rubrics.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('rubrics.heading')}>
          {rubrics.map((rubric) => (
            <li key={rubric.id}>
              <Link href={`${base}/${rubric.id}`}>{rubric.title}</Link>{' '}
              <span className="hint">
                {t('rubrics.summary', {
                  criteria: rubric.criteria.length,
                  levels: rubric.levels.length,
                  points: maxRubricPoints(rubric),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <h2>{t('rubrics.new')}</h2>
      <div className="rubric-columns">
        <RubricDraftForm locale={locale} />
        <BlankRubricForm locale={locale} />
      </div>
    </section>
  );
}
