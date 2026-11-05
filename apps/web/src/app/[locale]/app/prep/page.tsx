import type { Metadata } from 'next';
import Link from 'next/link';
import { addDays, localDateIn, type LocalDate } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { NewPrepForm, type PrepClass } from '../../../../components/prep-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { formatDate } from '../../../../server/lesson-plan-display.ts';
import { classDefaults } from '../../../../server/prep-forms.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The Monday after today, the week a teacher usually preps. */
function nextMonday(today: LocalDate): LocalDate {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(today, 7 - weekday);
}

/** The prep agent: a new weekly prep, and the teacher's batches, newest first. */
export default async function PrepPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const container = getAppContainer();
  const [classes, batches] = await Promise.all([
    container.listClasses.execute({ actor: user }),
    container.listPrepBatches.execute({ actor: user }),
  ]);
  const prepClasses: PrepClass[] = await Promise.all(
    classes.map(async (cls) => {
      const categories = await container.listGradeCategories.execute({
        actor: user,
        classId: cls.id,
      });
      return {
        id: cls.id,
        name: cls.name,
        ...classDefaults(cls),
        categories: categories.ok ? categories.value.map((c) => ({ id: c.id, name: c.name })) : [],
      };
    }),
  );
  const today = localDateIn(new Date(), await teacherTimeZone());
  const base = `/${locale}/app/prep`;
  const names = new Map(classes.map((cls) => [cls.id, cls.name]));

  return (
    <section className="stack">
      <h1>{t('prep.title')}</h1>
      <p>{t('prep.intro')}</p>
      <section className="card stack" aria-labelledby="new-prep-heading">
        <h2 id="new-prep-heading">{t('prep.newTitle')}</h2>
        {prepClasses.length === 0 ? (
          <p>
            <Link href={`/${locale}/app/classes`}>{t('prep.noClasses')}</Link>
          </p>
        ) : (
          <NewPrepForm locale={locale} classes={prepClasses} weekStart={nextMonday(today)} />
        )}
      </section>
      <h2>{t('prep.history')}</h2>
      {batches.length === 0 ? (
        <p className="muted">{t('prep.historyEmpty')}</p>
      ) : (
        <ul className="list" aria-label={t('prep.history')}>
          {batches.map((batch) => (
            <li key={batch.id}>
              <Link href={`${base}/${batch.id}`}>{batch.request.prompt}</Link>{' '}
              <span className="hint">
                {names.get(batch.classId) ?? ''} ·{' '}
                {t('prep.weekOf', { date: formatDate(batch.request.weekStart, locale) })}
              </span>{' '}
              <span className={`badge prep-${batch.status}`}>
                {t(`prep.status_${batch.status}`)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
