import type { Metadata } from 'next';
import Link from 'next/link';
import { planSpan, type LessonPlan, type PlanFolderId } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { FolderRow, NewFolderForm } from '../../../../components/planner-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { planDates, planName } from '../../../../server/lesson-plan-display.ts';
import { monthCalendar, monthOf, shiftMonth } from '../../../../server/plan-calendar.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{ folder?: string; view?: string; month?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

function Calendar(props: {
  readonly locale: Locale;
  readonly month: string;
  readonly plans: readonly LessonPlan[];
  readonly link: (changes: Record<string, string>) => string;
}) {
  const t = createTranslator(props.locale);
  const byId = new Map<string, LessonPlan>(props.plans.map((plan) => [plan.id, plan]));
  const weeks = monthCalendar(
    props.month,
    props.plans.map((plan) => ({ id: plan.id, ...planSpan(plan.body) })),
  );
  const title = new Intl.DateTimeFormat(props.locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${props.month}-01T00:00:00Z`));
  return (
    <section className="stack" aria-label={t('planner.calendarView')}>
      <p className="actions">
        <Link href={props.link({ month: shiftMonth(props.month, -1) })}>
          ← {t('planner.previousMonth')}
        </Link>
        <strong>{title}</strong>
        <Link href={props.link({ month: shiftMonth(props.month, 1) })}>
          {t('planner.nextMonth')} →
        </Link>
      </p>
      <div className="table-scroll">
        <table className="plan-calendar" data-testid="plan-calendar">
          <thead>
            <tr>
              {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const).map((day) => (
                <th key={day} scope="col">
                  {t(`weekdays.${day}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0]?.date}>
                {week.map((day) => (
                  <td key={day.date} className={day.inMonth ? '' : 'muted'}>
                    <span className="small">{Number(day.date.slice(8))}</span>
                    {day.planIds.map((id) => {
                      const plan = byId.get(id);
                      return plan ? (
                        <Link key={id} href={`/${props.locale}/app/plans/${id}`} className="chip">
                          {planName(plan, props.locale)}
                        </Link>
                      ) : null;
                    })}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function PlansPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const search = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const folders = await app.listFolders.execute({ actor: user });
  const known = new Set(folders.map(({ folder }) => folder.id as string));
  const filter =
    search.folder === 'unfiled' || (search.folder !== undefined && known.has(search.folder))
      ? (search.folder as 'unfiled' | PlanFolderId)
      : 'all';
  const plans = await app.listPlans.execute({ actor: user, filter });
  const view = search.view === 'calendar' ? 'calendar' : 'list';
  const month = monthOf(search.month, app.today(await teacherTimeZone()));
  const base = `/${locale}/app/plans`;
  const link = (changes: Record<string, string>) => {
    const params = new URLSearchParams({ folder: filter, view, month, ...changes });
    return `${base}?${params.toString()}`;
  };
  const folderName = new Map(folders.map(({ folder }) => [folder.id, folder.name]));

  return (
    <section className="stack">
      <h1>{t('planner.title')}</h1>
      <p className="muted">{t('planner.intro')}</p>
      <p className="actions">
        <Link href={`${base}/draft`} className="button">
          {t('planner.draftWithAi')}
        </Link>
        <Link href={`${base}/new?kind=weekly`} className="button secondary">
          {t('planner.newWeekly')}
        </Link>
        <Link href={`${base}/new?kind=conversational_english`} className="button secondary">
          {t('planner.newConversational')}
        </Link>
        <Link href={`/${locale}/app/templates`} className="button secondary">
          {t('planner.templates')}
        </Link>
      </p>

      <nav className="actions" aria-label={t('planner.filter')}>
        <span>{t('planner.filter')}:</span>
        {[
          { id: 'all', name: t('planner.all') },
          { id: 'unfiled', name: t('planner.unfiled') },
          ...folders.map(({ folder }) => ({ id: folder.id, name: folder.name })),
        ].map((option) => (
          <Link
            key={option.id}
            href={link({ folder: option.id })}
            aria-current={filter === option.id ? 'page' : undefined}
            className="chip"
          >
            {option.name}
          </Link>
        ))}
        <span>·</span>
        <Link href={link({ view: 'list' })} aria-current={view === 'list' ? 'page' : undefined}>
          {t('planner.listView')}
        </Link>
        <Link
          href={link({ view: 'calendar' })}
          aria-current={view === 'calendar' ? 'page' : undefined}
        >
          {t('planner.calendarView')}
        </Link>
      </nav>

      {view === 'calendar' ? (
        <Calendar locale={locale} month={month} plans={plans} link={link} />
      ) : plans.length === 0 ? (
        <p className="muted">{t('planner.noPlans')}</p>
      ) : (
        <ul className="card-list" data-testid="plan-list">
          {plans.map((plan) => (
            <li key={plan.id} className="card">
              <Link href={`${base}/${plan.id}`}>
                <strong>{planName(plan, locale)}</strong>
              </Link>
              <span className="muted small">
                {' '}
                · {t(`planner.kind_${plan.body.kind}`)} · {planDates(plan, locale)}
              </span>
              {plan.folderId ? (
                <span className="badge">{folderName.get(plan.folderId)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <section className="stack card" aria-labelledby="folders-heading">
        <h2 id="folders-heading">{t('folders.title')}</h2>
        <p className="muted small">{t('folders.deleteHint')}</p>
        {folders.map(({ folder, planCount }) => (
          <div key={folder.id}>
            <span className={`folder-dot folder-${folder.color}`} aria-hidden="true" />{' '}
            <span className="small muted">{t('folders.count', { count: planCount })}</span>
            <FolderRow locale={locale} folder={folder} />
          </div>
        ))}
        <NewFolderForm locale={locale} />
      </section>
    </section>
  );
}
