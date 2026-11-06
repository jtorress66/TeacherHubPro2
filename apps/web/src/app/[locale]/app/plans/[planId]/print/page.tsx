import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LessonPlanId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { planLayout } from '../../../../../../components/plan-formats/index.ts';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; planId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** A plan ready to print, in the layout the school chose for its plans. */
export default async function PrintPlanPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { planId } = await props.params;
  const { user, school } = await requireUser(locale);
  const app = getAppContainer();
  const found = await app.getPlan.execute({ actor: user, planId: planId as LessonPlanId });
  if (!found.ok) notFound();
  const plan = found.value;
  const cls =
    plan.classId === null
      ? null
      : ((await app.listClasses.execute({ actor: user })).find((c) => c.id === plan.classId) ??
        null);
  const Layout = planLayout(school.planFormat, plan);

  return (
    <div className="stack">
      <p className="actions no-print">
        <Link href={`/${locale}/app/plans/${plan.id}`}>← {t('planner.editTitle')}</Link>
        <PrintButton locale={locale} />
        <span className="muted small">{t('planner.printHint')}</span>
      </p>
      <Layout locale={locale} plan={plan} school={school} cls={cls} />
    </div>
  );
}
