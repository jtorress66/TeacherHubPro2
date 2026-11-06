import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isPlanFormat, planFormats, type LessonPlanId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { planLayout } from '../../../../../../components/plan-formats/index.ts';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; planId: string }>;
  readonly searchParams: Promise<{ format?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** A plan ready to print, in the school's layout unless the teacher picks another one here. */
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
  const asked = (await props.searchParams).format ?? '';
  const format = isPlanFormat(asked) ? asked : school.planFormat;
  const Layout = planLayout(format, plan);
  const printPath = `/${locale}/app/plans/${plan.id}/print`;

  return (
    <div className="stack">
      <p className="actions no-print">
        <Link href={`/${locale}/app/plans/${plan.id}`}>← {t('planner.editTitle')}</Link>
        <PrintButton locale={locale} />
        <span className="muted small">{t('planner.printHint')}</span>
      </p>
      {plan.body.kind === 'weekly' ? (
        <nav className="actions no-print" aria-label={t('settings.planFormat')}>
          <span>{t('settings.planFormat')}:</span>
          {planFormats.map((choice) => (
            <Link
              key={choice}
              href={`${printPath}?format=${choice}`}
              aria-current={choice === format ? 'page' : undefined}
              className={choice === format ? 'button' : 'button secondary'}
            >
              {t(`settings.planFormat_${choice}`)}
            </Link>
          ))}
        </nav>
      ) : null}
      <Layout locale={locale} plan={plan} school={school} cls={cls} />
    </div>
  );
}
