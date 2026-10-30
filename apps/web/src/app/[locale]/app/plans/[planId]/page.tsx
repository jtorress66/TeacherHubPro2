import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LessonPlanId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PlanCommands, PlanEditor } from '../../../../../components/planner-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { nextStartOf, planName } from '../../../../../server/lesson-plan-display.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; planId: string }>;
  readonly searchParams: Promise<{ saved?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

export default async function PlanPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { planId } = await props.params;
  const { saved } = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const found = await app.getPlan.execute({ actor: user, planId: planId as LessonPlanId });
  if (!found.ok) notFound();
  const plan = found.value;
  const classes = await app.listClasses.execute({ actor: user });
  const folders = (await app.listFolders.execute({ actor: user })).map(({ folder }) => ({
    id: folder.id,
    name: folder.name,
  }));
  const base = `/${locale}/app/plans`;

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('planner.back')}</Link>
      </p>
      <h1>{planName(plan, locale)}</h1>
      <p className="actions">
        <Link href={`${base}/${plan.id}/print`} className="button secondary">
          {t('planner.print')}
        </Link>
      </p>
      <PlanEditor
        key={JSON.stringify(plan)}
        locale={locale}
        planId={plan.id}
        title={plan.title}
        classId={plan.classId}
        folderId={plan.folderId}
        body={plan.body}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        folders={folders}
        savedOnLoad={saved === '1'}
      />
      <PlanCommands
        locale={locale}
        planId={plan.id}
        folderId={plan.folderId}
        nextStart={nextStartOf(plan)}
        folders={folders}
      />
    </section>
  );
}
