import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { DraftForm } from '../../../../../components/planner-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { nextMonday } from '../../../../../server/lesson-plan-display.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function DraftPlanPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const classes = await app.listClasses.execute({ actor: user });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/plans`}>← {t('planner.back')}</Link>
      </p>
      <h1>{t('drafts.title')}</h1>
      <p className="muted">{t('drafts.intro')}</p>
      <DraftForm
        locale={locale}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        nextMonday={nextMonday(app.today(await teacherTimeZone()))}
      />
    </section>
  );
}
