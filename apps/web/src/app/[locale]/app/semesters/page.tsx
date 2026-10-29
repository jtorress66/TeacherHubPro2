import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { SemesterForm } from '../../../../components/roster-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { deleteSemesterAction, setActiveSemesterAction } from '../../../_lib/roster-actions.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('semesters.title') };
}

export default async function SemestersPage(
  props: LocaleParams & { readonly searchParams: Promise<{ error?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const semesters = await getAppContainer().listSemesters.execute({ actor: user });
  const { error } = await props.searchParams;

  return (
    <section className="stack">
      <h1>{t('semesters.title')}</h1>
      {error === 'semester_in_use' || error === 'forbidden' ? (
        <p role="alert" className="alert">
          {t(`errors.${error}`)}
        </p>
      ) : null}
      <section className="card stack" aria-labelledby="new-semester-heading">
        <h2 id="new-semester-heading">{t('semesters.newSemester')}</h2>
        <SemesterForm locale={locale} />
      </section>
      {semesters.length === 0 ? (
        <p className="muted">{t('semesters.empty')}</p>
      ) : (
        <ul className="class-list" aria-label={t('semesters.title')}>
          {semesters.map((semester) => (
            <li key={semester.id} className="card stack" aria-label={semester.name}>
              <div className="row-between">
                <strong>{semester.name}</strong>
                {semester.isActive ? <span className="badge">{t('semesters.active')}</span> : null}
              </div>
              <p className="muted">
                {semester.startDate} – {semester.endDate}
                {semester.schoolYear ? ` · ${semester.schoolYear}` : ''}
              </p>
              <div className="actions">
                <Link href={`/${locale}/app/semesters/${semester.id}`}>{t('semesters.edit')}</Link>
                {semester.isActive ? null : (
                  <form action={setActiveSemesterAction}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="semesterId" value={semester.id} />
                    <button type="submit" className="link-button">
                      {t('semesters.setActive')}
                    </button>
                  </form>
                )}
                <form action={deleteSemesterAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="semesterId" value={semester.id} />
                  <button type="submit" className="link-button">
                    {t('semesters.delete')}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
