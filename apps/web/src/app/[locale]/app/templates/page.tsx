import type { Metadata } from 'next';
import { starterText, type StarterTemplate } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { nextMonday } from '../../../../server/lesson-plan-display.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { deleteTemplateAction } from '../../../_lib/planner-actions.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** "Use template": opens a new plan from it, starting on the chosen date. */
function UseForm(props: {
  readonly locale: Locale;
  readonly source: 'starter' | 'template';
  readonly id: string;
  readonly start: string;
  readonly label: string;
}) {
  const t = createTranslator(props.locale);
  const inputId = `start-${props.source}-${props.id}`;
  return (
    <form action={`/${props.locale}/app/plans/new`} method="get" className="field-row">
      <input type="hidden" name={props.source} value={props.id} />
      <div className="field">
        <label htmlFor={inputId}>{t('templates.startOn')}</label>
        <input id={inputId} name="start" type="date" defaultValue={props.start} />
      </div>
      <button type="submit" className="button" aria-label={`${t('templates.use')}: ${props.label}`}>
        {t('templates.use')}
      </button>
    </form>
  );
}

function StarterCard(props: {
  readonly locale: Locale;
  readonly starter: StarterTemplate;
  readonly start: string;
}) {
  const t = createTranslator(props.locale);
  const text = starterText(props.starter, props.locale);
  return (
    <li className="card stack">
      <strong>{text.name}</strong>
      <span className="muted small">
        {t(`drafts.subject_${props.starter.subject}`)} ·{' '}
        {t('templates.grades', { grades: props.starter.grades })}
      </span>
      <p>{text.description}</p>
      <UseForm
        locale={props.locale}
        source="starter"
        id={props.starter.id}
        start={props.start}
        label={text.name}
      />
    </li>
  );
}

export default async function TemplatesPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const list = await app.listTemplates.execute({ actor: user });
  const start = nextMonday(app.today(await teacherTimeZone()));

  return (
    <section className="stack">
      <h1>{t('templates.title')}</h1>
      <p className="muted">{t('templates.intro')}</p>

      <h2>{t('templates.featured')}</h2>
      <ul className="card-list" data-testid="featured-template">
        <StarterCard locale={locale} starter={list.featured} start={start} />
      </ul>

      <h2>{t('templates.mine')}</h2>
      {list.own.length === 0 ? (
        <p className="muted">{t('templates.noneMine')}</p>
      ) : (
        <ul className="card-list">
          {list.own.map((template) => (
            <li key={template.id} className="card stack">
              <strong>{template.name}</strong>
              <span className="muted small">{t(`planner.kind_${template.body.kind}`)}</span>
              <UseForm
                locale={locale}
                source="template"
                id={template.id}
                start={start}
                label={template.name}
              />
              <form action={deleteTemplateAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit" className="button secondary">
                  {t('templates.delete')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2>{t('templates.starters')}</h2>
      <ul className="card-list" data-testid="starter-templates">
        {list.starters.map((starter) => (
          <StarterCard key={starter.id} locale={locale} starter={starter} start={start} />
        ))}
      </ul>
    </section>
  );
}
