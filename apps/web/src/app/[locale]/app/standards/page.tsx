import type { Metadata } from 'next';
import {
  gradeLevels,
  isGradeLevel,
  standardsFor,
  standardSubjects,
  type StandardSubject,
} from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{ subject?: string; grade?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

const isSubject = (value: string | undefined): value is StandardSubject =>
  (standardSubjects as readonly (string | undefined)[]).includes(value);

/** The official Common Core codes for a subject and grade, to copy into a plan. */
export default async function StandardsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  await requireUser(locale);
  const search = await props.searchParams;
  const subject = isSubject(search.subject) ? search.subject : 'math';
  const grade = search.grade !== undefined && isGradeLevel(search.grade) ? search.grade : '4';
  const standards = standardsFor(subject, grade);

  return (
    <section className="stack">
      <h1>{t('standards.title')}</h1>
      <p className="muted">{t('standards.intro')}</p>
      <form method="get" className="field-row">
        <div className="field">
          <label htmlFor="subject">{t('standards.subject')}</label>
          <select id="subject" name="subject" defaultValue={subject}>
            {standardSubjects.map((s) => (
              <option key={s} value={s}>
                {t(`drafts.subject_${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="grade">{t('standards.grade')}</label>
          <select id="grade" name="grade" defaultValue={grade}>
            {gradeLevels.map((g) => (
              <option key={g} value={g}>
                {g === 'K' ? t('drafts.grade_K') : g}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button">
          {t('standards.show')}
        </button>
      </form>
      {standards.length === 0 ? (
        <p className="muted">{t('standards.none')}</p>
      ) : (
        <dl className="standards-list" data-testid="standards-list">
          {standards.map((standard) => (
            <div key={standard.code}>
              <dt>
                <code>{standard.code}</code>
              </dt>
              <dd>{standard.description}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="muted small">{t('standards.source')}</p>
    </section>
  );
}
