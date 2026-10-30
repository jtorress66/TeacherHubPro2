import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  addDays,
  findStandard,
  planWeekdays,
  type ConversationalBody,
  type LessonPlanId,
  type PlanWeek,
  type WeeklyBody,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { PrintButton } from '../../../../../../components/browser-helpers.tsx';
import { Markdown } from '../../../../../../components/markdown.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { formatDate, planDates, planName } from '../../../../../../server/lesson-plan-display.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; planId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

function Facts({ items }: { readonly items: readonly [string, string | null | undefined][] }) {
  const shown = items.filter(([, value]) => Boolean(value));
  return shown.length === 0 ? null : (
    <dl className="facts">
      {shown.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WeekView({
  locale,
  week,
  number,
}: {
  readonly locale: Locale;
  readonly week: PlanWeek;
  readonly number: number;
}) {
  const t = createTranslator(locale);
  const rows: [string, (index: number) => ReactNode][] = [
    [t('planner.theme'), (i) => week.days[i]?.theme],
    [
      t('planner.dok'),
      (i) => week.days[i]?.dok.map((level) => t(`planner.dok_${String(level) as '1'}`)).join(', '),
    ],
    [t('planner.eca'), (i) => week.days[i]?.eca.map((mark) => t(`planner.eca_${mark}`)).join(', ')],
    [
      t('planner.activities'),
      (i) => (
        <ul>
          {week.days[i]?.activities.map((activity) => (
            <li key={activity.type}>
              {t(`planner.activity_${activity.type}`)}
              {activity.notes ? `: ${activity.notes}` : ''}
            </li>
          ))}
        </ul>
      ),
    ],
    [
      t('planner.materials'),
      (i) => week.days[i]?.materials.map((m) => t(`planner.material_${m}`)).join(', '),
    ],
    [t('planner.notes'), (i) => <Markdown source={week.days[i]?.notes} />],
  ];
  return (
    <section className="stack print-week">
      <h2>
        {t('planner.week', { number })}:{' '}
        {t('planner.dates', {
          start: formatDate(week.weekStart, locale),
          end: formatDate(addDays(week.weekStart, 4), locale),
        })}
      </h2>
      {week.objective ? (
        <>
          <h3>{t('planner.objective')}</h3>
          <Markdown source={week.objective} />
        </>
      ) : null}
      {week.skills.length > 0 ? (
        <>
          <h3>{t('planner.skills')}</h3>
          <ul>
            {week.skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </>
      ) : null}
      {week.standards.length > 0 ? (
        <>
          <h3>{t('planner.standardsHeading')}</h3>
          <ul data-testid="print-standards">
            {week.standards.map((code) => (
              <li key={code}>
                <strong>{code}</strong> {findStandard(code)?.description}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {week.expectations ? (
        <>
          <h3>{t('planner.expectations')}</h3>
          <Markdown source={week.expectations} />
        </>
      ) : null}
      <table className="print-days">
        <thead>
          <tr>
            <th scope="col" />
            {planWeekdays.map((day, i) => (
              <th key={day} scope="col">
                {t(`planner.day_${day}`)} {formatDate(addDays(week.weekStart, i), locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cell]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {planWeekdays.map((day, i) => (
                <td key={day}>{cell(i)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function WeeklyView({ locale, body }: { readonly locale: Locale; readonly body: WeeklyBody }) {
  const t = createTranslator(locale);
  return (
    <>
      <Facts
        items={[
          [t('planner.unit'), body.unit],
          [t('planner.story'), body.story],
          [t('planner.teacherName'), body.teacherName],
          [
            t('planner.subjectIntegration'),
            body.subjectIntegration.map((s) => t(`planner.subject_${s}`)).join(', '),
          ],
        ]}
      />
      {body.weeks.map((week, index) => (
        <WeekView key={week.weekStart} locale={locale} week={week} number={index + 1} />
      ))}
    </>
  );
}

function ConversationalView({
  locale,
  body,
}: {
  readonly locale: Locale;
  readonly body: ConversationalBody;
}) {
  const t = createTranslator(locale);
  const sections: [string, string | null][] = [
    [t('planner.learningObjectives'), body.learningObjectives],
    [t('planner.ceMaterials'), body.materials],
    [t('planner.hook'), body.hook],
    [t('planner.learningGoal'), body.learningGoal],
    [t('planner.ceNotes'), body.notes],
    [t('planner.closure'), body.closure],
  ];
  return (
    <>
      <Facts
        items={[
          [t('planner.ceSubject'), body.subject],
          [t('planner.topic'), body.topic],
          [t('planner.testQuizDate'), body.testQuizDate && formatDate(body.testQuizDate, locale)],
        ]}
      />
      {sections.map(([label, text]) =>
        text ? (
          <section key={label}>
            <h2>{label}</h2>
            <Markdown source={text} />
          </section>
        ) : null,
      )}
    </>
  );
}

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
      : (await app.listClasses.execute({ actor: user })).find((c) => c.id === plan.classId);

  return (
    <article className="stack print-plan" data-testid="print-plan">
      <p className="actions no-print">
        <Link href={`/${locale}/app/plans/${plan.id}`}>← {t('planner.editTitle')}</Link>
        <PrintButton locale={locale} />
        <span className="muted small">{t('planner.printHint')}</span>
      </p>
      <header>
        <p className="muted small">{school.name}</p>
        <h1>{planName(plan, locale)}</h1>
        <p>
          {t(`planner.kind_${plan.body.kind}`)} · {planDates(plan, locale)}
          {cls ? ` · ${cls.name}` : ''}
        </p>
      </header>
      {plan.body.kind === 'weekly' ? (
        <WeeklyView locale={locale} body={plan.body} />
      ) : (
        <ConversationalView locale={locale} body={plan.body} />
      )}
      <p className="muted small">{t('planner.printedOn')}</p>
    </article>
  );
}
