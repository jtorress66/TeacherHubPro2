import type { Metadata } from 'next';
import Link from 'next/link';
import type { RecommendationKind } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { OnboardingChecklist } from '../../../components/onboarding-checklist.tsx';
import { WelcomeTour } from '../../../components/welcome-tour.tsx';
import { getAppContainer } from '../../../container.ts';
import { formatDate, planName } from '../../../server/lesson-plan-display.ts';
import { planBadge } from '../../../server/plan-display.ts';
import { requireUser } from '../../_lib/auth.ts';
import { teacherTimeZone } from '../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('nav.dashboard') };
}

/** Where each suggestion takes the teacher. */
const actionPath: Readonly<Record<RecommendationKind, string>> = {
  attendance: '/app/attendance',
  intervention: '#at-risk',
  grading: '/app/gradebook',
  planning: '/app/plans',
};

/**
 * The Command Center: the teacher's day at a glance. Today's classes and attendance, what to
 * grade, students who may need help, suggestions and lessons coming up.
 */
export default async function DashboardPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school, subscription, access } = await requireUser(locale);
  const app = getAppContainer();
  const onboarding = await app.getOnboarding.execute({ actor: user, school });
  const readyPrep = await app.countReadyPrepBatches.execute({ actor: user });
  const center = await app.getCommandCenter.execute({
    actor: user,
    timeZone: await teacherTimeZone(),
  });
  const base = `/${locale}`;

  return (
    <section className="stack">
      <h1>{t('dashboard.welcome', { name: user.name })}</h1>
      <p className="school-mark muted">
        {school.logoKey === null ? null : (
          // Decorative: the school's name is right next to it. The key changes with each upload.
          <img
            src={`/api/school-logo?v=${encodeURIComponent(school.logoKey)}`}
            alt=""
            className="school-logo"
            data-testid="school-logo"
          />
        )}
        {school.name}
      </p>
      <p>
        <span className="badge" data-testid="plan-badge">
          {planBadge(subscription, access, locale)}
        </span>{' '}
        {subscription?.status === 'trialing' ? (
          <Link href={`/${locale}/app/billing`}>{t('dashboard.seePlans')}</Link>
        ) : null}
      </p>
      <OnboardingChecklist locale={locale} state={onboarding} />
      <WelcomeTour locale={locale} />
      {readyPrep === 0 ? null : (
        <p className="card prep-ready" data-testid="prep-ready">
          {t('commandCenter.prepReady', { count: readyPrep })}{' '}
          <Link className="button" href={`/${locale}/app/prep`}>
            {t('commandCenter.prepReadyOpen')}
          </Link>
        </p>
      )}

      {center.ok ? (
        <>
          <dl className="stats" aria-label={t('nav.dashboard')}>
            <div>
              <dt>{t('commandCenter.stat_classesToday')}</dt>
              <dd>{center.value.stats.classesToday}</dd>
            </div>
            <div>
              <dt>{t('commandCenter.stat_attendance')}</dt>
              <dd>
                {center.value.stats.attendanceDone} / {center.value.stats.classesToday}
              </dd>
            </div>
            <div>
              <dt>{t('commandCenter.stat_toGrade')}</dt>
              <dd>{center.value.stats.toGrade}</dd>
            </div>
            <div>
              <dt>{t('commandCenter.stat_atRisk')}</dt>
              <dd>{center.value.stats.atRisk}</dd>
            </div>
          </dl>

          <section className="card stack" aria-labelledby="suggestions-heading">
            <h2 id="suggestions-heading">{t('commandCenter.recommendations')}</h2>
            {center.value.recommendations.length === 0 ? (
              <p className="muted">{t('commandCenter.recommendationsEmpty')}</p>
            ) : (
              <ul className="list">
                {center.value.recommendations.map((r) => (
                  <li key={r.kind}>
                    <span className={`badge priority-${r.priority}`}>
                      {t(`commandCenter.priority_${r.priority}`)}
                    </span>{' '}
                    {t(`recommendation.${r.kind}`, { count: r.count })}{' '}
                    <Link
                      href={
                        actionPath[r.kind].startsWith('#')
                          ? actionPath[r.kind]
                          : `${base}${actionPath[r.kind]}`
                      }
                    >
                      {t(`recommendation.${r.kind}_action`)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stack" aria-labelledby="today-heading">
            <h2 id="today-heading">{t('commandCenter.today')}</h2>
            {center.value.classesToday.length === 0 ? (
              <p className="muted">{t('commandCenter.todayEmpty')}</p>
            ) : (
              <ul className="list">
                {center.value.classesToday.map(({ cls, students, attendance }) => (
                  <li key={cls.id}>
                    <Link href={`${base}/app/classes/${cls.id}`}>{cls.name}</Link>{' '}
                    <span className="hint">
                      {cls.schedule?.period == null
                        ? ''
                        : `${t('commandCenter.period', { period: cls.schedule.period })} · `}
                      {cls.schedule?.startTime == null ? '' : `${cls.schedule.startTime} · `}
                      {t('commandCenter.students', { count: students })}
                    </span>{' '}
                    {attendance === 'done' ? (
                      <span className="badge">{t('commandCenter.attendance_done')}</span>
                    ) : (
                      <Link
                        className="button secondary"
                        href={`${base}/app/classes/${cls.id}/attendance`}
                      >
                        {t('commandCenter.takeAttendance')}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="at-risk" className="card stack" aria-labelledby="at-risk-heading">
            <h2 id="at-risk-heading">{t('commandCenter.atRisk')}</h2>
            {center.value.atRisk.length === 0 ? (
              <p className="muted">{t('commandCenter.atRiskEmpty')}</p>
            ) : (
              <ul className="list" aria-label={t('commandCenter.atRisk')}>
                {center.value.atRisk.map(({ student, cls, risk }) => (
                  <li key={student.id}>
                    <Link href={`${base}/app/classes/${cls.id}/students/${student.id}`}>
                      {student.firstName} {student.lastName}
                    </Link>{' '}
                    <span className="hint">
                      {cls.name} · {t('commandCenter.riskScore', { score: risk.score })}
                    </span>
                    <br />
                    {risk.factors
                      .map((factor) => t(`risk.${factor.kind}`, { value: factor.value }))
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stack" aria-labelledby="to-grade-heading">
            <h2 id="to-grade-heading">{t('commandCenter.toGrade')}</h2>
            {center.value.toGrade.length === 0 ? (
              <p className="muted">{t('commandCenter.toGradeEmpty')}</p>
            ) : (
              <ul className="list">
                {center.value.toGrade.map((item) => (
                  <li key={item.assignment.id}>
                    <Link
                      href={`${base}/app/classes/${item.assignment.classId}/assignments/${item.assignment.id}`}
                    >
                      {item.assignment.title}
                    </Link>{' '}
                    <span className="hint">
                      {item.className}
                      {item.assignment.dueDate === null
                        ? ''
                        : ` · ${t('commandCenter.due', { date: formatDate(item.assignment.dueDate, locale) })}`}
                    </span>{' '}
                    {item.overdue ? (
                      <span className="badge priority-high">{t('commandCenter.overdue')}</span>
                    ) : null}{' '}
                    {[
                      item.waiting > 0 ? t('commandCenter.waiting', { count: item.waiting }) : null,
                      item.ungraded > 0
                        ? t('commandCenter.ungraded', { count: item.ungraded })
                        : null,
                    ]
                      .filter((part) => part !== null)
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card stack" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading">{t('commandCenter.upcoming')}</h2>
            {center.value.upcoming.length === 0 ? (
              <p className="muted">{t('commandCenter.upcomingEmpty')}</p>
            ) : (
              <ul className="list">
                {center.value.upcoming.map(({ plan, className }) => (
                  <li key={plan.id}>
                    <Link href={`${base}/app/plans/${plan.id}`}>{planName(plan, locale)}</Link>{' '}
                    <span className="hint">{className ?? t('commandCenter.noClass')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
