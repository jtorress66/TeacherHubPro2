import {
  activityTypes,
  addDays,
  dokLevels,
  materialTypes,
  planWeekdays,
  standardDomainOf,
  standardDomains,
  subjectIntegrations,
  type LocalDate,
  type PlanWeek,
  type School,
  type StandardDomain,
  type WeeklyBody,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { planName } from '../../server/lesson-plan-display.ts';
import type { PlanPrintProps } from './types.ts';

/** MM/DD/YYYY, as the original printed plans showed dates in both languages. */
const usDate = (date: LocalDate): string => {
  const [year, month, day] = date.split('-');
  return `${month ?? ''}/${day ?? ''}/${year ?? ''}`;
};

function Box({ checked }: { readonly checked: boolean }) {
  return (
    <span className="cp-box" data-checked={checked ? 'true' : 'false'}>
      {checked ? 'X' : ''}
    </span>
  );
}

function SchoolHeader({ locale, school }: { readonly locale: Locale; readonly school: School }) {
  const t = createTranslator(locale);
  const contact = [
    school.phone === null ? null : t('planPrint.tel', { phone: school.phone }),
    school.email,
  ].filter((part) => part !== null);
  return (
    <header className="cp-header">
      {school.logoKey === null ? null : <img src="/api/school-logo" alt="" className="cp-logo" />}
      <p className="cp-school">{school.name}</p>
      {school.address === null ? null : <p className="cp-info">{school.address}</p>}
      {contact.length === 0 ? null : <p className="cp-info">{contact.join(' | ')}</p>}
    </header>
  );
}

function WeekPage(props: {
  readonly locale: Locale;
  readonly school: School;
  readonly week: PlanWeek;
  readonly number: number;
}) {
  const { locale, week, number } = props;
  const t = createTranslator(locale);
  const days = planWeekdays.map((_, i) => week.days[i]);
  const skills = week.skills.length > 0 ? week.skills : ['', '', '', ''];
  return (
    <section className="cp-page" aria-label={t('planner.week', { number })}>
      <SchoolHeader locale={locale} school={props.school} />
      <p className="cp-date">
        <strong>{t('planPrint.date')}</strong>{' '}
        {t('planPrint.fromTo', {
          start: usDate(week.weekStart),
          end: usDate(addDays(week.weekStart, 4)),
        })}
        {number === 2 ? ` ${t('planPrint.week2')}` : ''}
      </p>
      <div className="cp-box-text">
        <strong className="cp-label">{t('planPrint.objective')}</strong>{' '}
        {week.objective ?? '_______________________________________________'}
      </div>
      <div className="cp-box-text">
        <strong className="cp-label">{t('planPrint.skills')}</strong>
        <ol className="cp-skills">
          {skills.map((skill, i) => (
            <li key={i}>{skill === '' ? '_______________________________________' : skill}</li>
          ))}
        </ol>
      </div>
      <table className="cp-table">
        <thead>
          <tr>
            <td className="cp-corner" />
            {planWeekdays.map((weekday, i) => (
              <th key={weekday} scope="col">
                <span className="cp-day">{t(`planner.day_${weekday}`)}</span>
                <span className="cp-eca">
                  <Box checked={days[i]?.eca.includes('enrichment') ?? false} />E{' '}
                  <Box checked={days[i]?.eca.includes('core') ?? false} />C{' '}
                  <Box checked={days[i]?.eca.includes('assessment') ?? false} />A
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t('planPrint.dayTheme')}</th>
            {days.map((day, i) => (
              <td key={i} className="cp-theme">
                {day?.theme}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t('planPrint.taxonomy')}</th>
            {days.map((day, i) => (
              <td key={i}>
                {dokLevels.map((level) => (
                  <span key={level} className="cp-item cp-dok">
                    <Box checked={day?.dok.includes(level) ?? false} />{' '}
                    {t(`planPrint.dok_${String(level) as '1'}`)}
                  </span>
                ))}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t('planPrint.activities')}</th>
            {days.map((day, i) => (
              <td key={i}>
                {activityTypes.map((type) => {
                  const chosen = day?.activities.find((activity) => activity.type === type);
                  return (
                    <span key={type} className="cp-item">
                      <Box checked={chosen !== undefined} /> {t(`planPrint.activity_${type}`)}
                      {chosen?.notes ? ` ${chosen.notes}` : ''}
                    </span>
                  );
                })}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">{t('planPrint.materials')}</th>
            {days.map((day, i) => (
              <td key={i}>
                {materialTypes.map((type) => (
                  <span key={type} className="cp-item">
                    <Box checked={day?.materials.includes(type) ?? false} />{' '}
                    {t(`planPrint.material_${type}`)}
                  </span>
                ))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** The week's codes by category: typed ones, then Common Core ELA codes of that category. */
function codesByDomain(week: PlanWeek | undefined) {
  const byDomain = new Map<StandardDomain, string[]>(
    standardDomains.map((domain) => [domain, [...(week?.domainStandards[domain] ?? [])]]),
  );
  const other: string[] = [];
  for (const code of week?.standards ?? []) {
    const domain = standardDomainOf(code);
    if (domain === null) other.push(code);
    else byDomain.get(domain)?.push(code);
  }
  return { byDomain, other };
}

function StandardsColumn(props: {
  readonly locale: Locale;
  readonly week: PlanWeek | undefined;
  readonly heading: string;
}) {
  const t = createTranslator(props.locale);
  const { byDomain, other } = codesByDomain(props.week);
  return (
    <div className="cp-std-col">
      <h3 className="cp-std-heading">{props.heading}</h3>
      {standardDomains.map((domain) => {
        const codes = byDomain.get(domain) ?? [];
        return (
          <p key={domain} className="cp-std-item">
            <Box checked={codes.length > 0} /> <strong>{t(`planner.domain_${domain}`)}</strong>
            {codes.length > 0 ? ` ${codes.join(', ')}` : ''}
          </p>
        );
      })}
      {other.length > 0 ? (
        <p className="cp-std-item">
          <Box checked /> <strong>{t('planPrint.commonCore')}</strong> {other.join(', ')}
        </p>
      ) : null}
      <div className="cp-expectations">
        <strong className="cp-label">{t('planPrint.expectations')}</strong>
        <p>{props.week?.expectations}</p>
      </div>
    </div>
  );
}

function PlanningPage(props: {
  readonly locale: Locale;
  readonly school: School;
  readonly body: WeeklyBody;
  readonly grade: string;
}) {
  const { locale, body } = props;
  const t = createTranslator(locale);
  const [first, second] = body.weeks;
  return (
    <section className="cp-page" aria-label={t('planPrint.teachersPlanning')}>
      <SchoolHeader locale={locale} school={props.school} />
      <h2 className="cp-title">{t('planPrint.teachersPlanning')}</h2>
      <div className="cp-info-row">
        <div>
          <p>
            <strong>{t('planPrint.unit')}</strong> {body.unit ?? '_____'}
          </p>
          <p>
            <strong>{t('planPrint.story')}</strong> {body.story ?? '_____'}
          </p>
          <p>
            <strong>{t('planPrint.teacher')}</strong> {body.teacherName ?? '_____'}
          </p>
          <p>
            <strong>{t('planPrint.grade')}</strong> {props.grade}
          </p>
        </div>
        <div className="cp-dates">
          <strong>{t('planPrint.dateHeading')}</strong>
          {body.weeks.map((week) => (
            <p key={week.weekStart}>
              {t('planPrint.datesLine', {
                start: usDate(week.weekStart),
                end: usDate(addDays(week.weekStart, 4)),
              })}
            </p>
          ))}
        </div>
      </div>
      <div className="cp-std-row">
        <StandardsColumn locale={locale} week={first} heading={t('planPrint.standardWeek1')} />
        <StandardsColumn locale={locale} week={second} heading={t('planPrint.standardWeek2')} />
      </div>
      <div className="cp-integration">
        <strong>{t('planPrint.integration')}</strong>
        <p className="cp-integration-items">
          {subjectIntegrations.map((subject) => (
            <span key={subject}>
              <Box checked={body.subjectIntegration.includes(subject)} />{' '}
              {t(`planner.subject_${subject}`)}
            </span>
          ))}
        </p>
      </div>
      <div className="cp-signatures">
        <p>{t('planPrint.teacherSignature')}</p>
        <p>{t('planPrint.principalSignature')}</p>
      </div>
    </section>
  );
}

/**
 * The original app's printed plan: one page per week (Monday to Friday, with E/C/A, Webb levels,
 * activities and materials as checkboxes), then the "Teacher's Planning" page with standards by
 * category for each week, expectations, subject integration and signature lines.
 */
export function ClassicPlan({ locale, plan, school, cls }: PlanPrintProps) {
  if (plan.body.kind !== 'weekly') return null;
  const grade = [cls?.grade, cls?.section].filter(Boolean).join('-');
  return (
    <article className="classic-plan" data-testid="print-plan">
      <h1 className="visually-hidden">{planName(plan, locale)}</h1>
      {plan.body.weeks.map((week, index) => (
        <WeekPage
          key={week.weekStart}
          locale={locale}
          school={school}
          week={week}
          number={index + 1}
        />
      ))}
      <PlanningPage locale={locale} school={school} body={plan.body} grade={grade} />
    </article>
  );
}
