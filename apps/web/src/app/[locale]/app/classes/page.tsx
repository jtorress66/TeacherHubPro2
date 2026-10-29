import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { ClassForm } from '../../../../components/roster-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { scheduleSummary } from '../../../../server/schedule-summary.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('classes.title') };
}

export default async function ClassesPage(
  props: LocaleParams & { readonly searchParams: Promise<{ archived?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const showArchived = (await props.searchParams).archived === '1';
  const app = getAppContainer();
  const [classes, semesters] = await Promise.all([
    app.listClasses.execute({ actor: user, includeArchived: showArchived }),
    app.listSemesters.execute({ actor: user }),
  ]);

  return (
    <section className="stack">
      <h1>{t('classes.title')}</h1>
      <section className="card stack" aria-labelledby="new-class-heading">
        <h2 id="new-class-heading">{t('classes.newClass')}</h2>
        <ClassForm locale={locale} semesters={semesters} />
      </section>
      <p>
        <Link href={`/${locale}/app/classes${showArchived ? '' : '?archived=1'}`}>
          {showArchived ? t('classes.hideArchived') : t('classes.showArchived')}
        </Link>
      </p>
      {classes.length === 0 ? (
        <p className="muted">{t('classes.empty')}</p>
      ) : (
        <ul className="class-list" aria-label={t('classes.title')}>
          {classes.map((cls) => (
            <li key={cls.id} className="card">
              <Link href={`/${locale}/app/classes/${cls.id}`}>{cls.name}</Link>
              {cls.archivedAt ? <span className="badge">{t('classes.archivedBadge')}</span> : null}
              <p className="muted">{scheduleSummary(cls.schedule, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
