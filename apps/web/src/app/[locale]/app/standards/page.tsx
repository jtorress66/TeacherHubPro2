import type { Metadata } from 'next';
import Link from 'next/link';
import {
  gradeLevels,
  isGradeLevel,
  isPrChoice,
  isPrSubject,
  prChoicesFor,
  prStandardsFor,
  prSubjects,
  standardsFor,
  standardSubjects,
  type StandardSubject,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{ set?: string; subject?: string; grade?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

const isSubject = (value: string | undefined): value is StandardSubject =>
  (standardSubjects as readonly (string | undefined)[]).includes(value);

function CommonCore({
  locale,
  search,
}: {
  readonly locale: Locale;
  readonly search: { subject?: string; grade?: string };
}) {
  const t = createTranslator(locale);
  const subject = isSubject(search.subject) ? search.subject : 'math';
  const grade = search.grade !== undefined && isGradeLevel(search.grade) ? search.grade : '4';
  const standards = standardsFor(subject, grade);
  return (
    <>
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
    </>
  );
}

function PuertoRico({
  locale,
  search,
}: {
  readonly locale: Locale;
  readonly search: { subject?: string; grade?: string };
}) {
  const t = createTranslator(locale);
  const subject =
    search.subject !== undefined && isPrSubject(search.subject) ? search.subject : 'english';
  const choices = prChoicesFor(subject);
  const grade =
    search.grade !== undefined && isPrChoice(search.grade) && choices.includes(search.grade)
      ? search.grade
      : (choices[0] ?? 'K');
  const standards = prStandardsFor(subject, grade);
  const label = (choice: string) =>
    choice === 'intermediate' || choice === 'high'
      ? t(`standards.level_${choice}`)
      : choice === 'K'
        ? t('drafts.grade_K')
        : choice;
  return (
    <>
      <h1>{t('standards.prTitle')}</h1>
      <p className="muted">{t('standards.prIntro')}</p>
      <form method="get" className="field-row">
        <input type="hidden" name="set" value="pr" />
        <div className="field">
          <label htmlFor="subject">{t('standards.subject')}</label>
          <select id="subject" name="subject" defaultValue={subject}>
            {prSubjects.map((s) => (
              <option key={s} value={s}>
                {t(`standards.pr_${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="grade">{t('standards.grade')}</label>
          <select id="grade" name="grade" defaultValue={grade}>
            {choices.map((choice) => (
              <option key={choice} value={choice}>
                {label(choice)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="button">
          {t('standards.show')}
        </button>
      </form>
      {standards.length === 0 ? (
        <p className="muted">{t('standards.prNone')}</p>
      ) : (
        <dl className="standards-list" data-testid="standards-list">
          {standards.map((standard) => (
            <div key={standard.code}>
              <dt>
                <code>{standard.code}</code>
                {standard.course === null ? null : ` · ${standard.course}`}
              </dt>
              <dd>{standard.description}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="muted small">{t('standards.prSource')}</p>
    </>
  );
}

/** Official standards codes to look up: Common Core, or the Puerto Rico Department of Education's. */
export default async function StandardsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  await requireUser(locale);
  const search = await props.searchParams;
  const puertoRico = search.set === 'pr';
  const base = `/${locale}/app/standards`;

  return (
    <section className="stack">
      <nav className="actions" aria-label={t('standards.sets')}>
        <Link
          href={base}
          className={puertoRico ? 'button secondary' : 'button'}
          aria-current={puertoRico ? undefined : 'page'}
        >
          {t('standards.set_common_core')}
        </Link>
        <Link
          href={`${base}?set=pr`}
          className={puertoRico ? 'button' : 'button secondary'}
          aria-current={puertoRico ? 'page' : undefined}
        >
          {t('standards.set_puerto_rico')}
        </Link>
      </nav>
      {puertoRico ? (
        <PuertoRico locale={locale} search={search} />
      ) : (
        <CommonCore locale={locale} search={search} />
      )}
    </section>
  );
}
