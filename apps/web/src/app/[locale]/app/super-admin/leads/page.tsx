import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  leadScores,
  leadSources,
  leadStatuses,
  type LeadScore,
  type LeadSource,
  type LeadStatus,
} from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { SuperAdminNav } from '../../../../../components/super-admin-nav.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { updateLeadStatusAction } from '../../../../_lib/marketing-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{ q?: string; score?: string; source?: string; status?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

const pick = <T extends string>(list: readonly T[], value: string | undefined) =>
  value !== undefined && (list as readonly string[]).includes(value) ? (value as T) : undefined;

/** Leads from the website chat and contact form, for super admins: stats, search and status. */
export default async function LeadsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const search = await props.searchParams;
  const { user } = await requireUser(locale, { needsAccess: false });
  const score = pick<LeadScore>(leadScores, search.score);
  const source = pick<LeadSource>(leadSources, search.source);
  const status = pick<LeadStatus>(leadStatuses, search.status);
  const listed = await getAppContainer().listLeads.execute({
    actor: user,
    query: {
      ...(search.q === undefined || search.q === '' ? {} : { text: search.q }),
      ...(score === undefined ? {} : { score }),
      ...(source === undefined ? {} : { source }),
      ...(status === undefined ? {} : { status }),
    },
  });
  if (!listed.ok) notFound();
  const { leads, counts } = listed.value;
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="stack">
      <h1>{t('marketing.leads.title')}</h1>
      <SuperAdminNav locale={locale} />
      <p>{t('marketing.leads.intro')}</p>
      <dl className="stats" aria-label={t('marketing.leads.score')}>
        {leadScores.map((s) => (
          <div key={s}>
            <dt>{t(`marketing.leads.score_${s}`)}</dt>
            <dd>{counts[s]}</dd>
          </div>
        ))}
      </dl>
      <form
        method="get"
        className="field-row"
        role="search"
        aria-label={t('marketing.leads.search')}
      >
        <div className="field">
          <label htmlFor="lead-search">{t('marketing.leads.search')}</label>
          <input id="lead-search" name="q" type="search" defaultValue={search.q ?? ''} />
        </div>
        {(
          [
            ['score', leadScores, score],
            ['source', leadSources, source],
            ['status', leadStatuses, status],
          ] as const
        ).map(([name, list, chosen]) => (
          <div className="field" key={name}>
            <label htmlFor={`lead-${name}`}>{t(`marketing.leads.${name}`)}</label>
            <select id={`lead-${name}`} name={name} defaultValue={chosen ?? ''}>
              <option value="">{t('marketing.leads.all')}</option>
              {list.map((value) => (
                <option key={value} value={value}>
                  {t(`marketing.leads.${name}_${value}` as `marketing.leads.score_high`)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <div className="field">
          <button type="submit" className="button">
            {t('marketing.leads.filter')}
          </button>
        </div>
      </form>
      {leads.length === 0 ? (
        <p className="muted">{t('marketing.leads.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('marketing.leads.title')}>
          {leads.map((lead) => (
            <li key={lead.id} className="card stack">
              <p>
                <strong>{lead.name}</strong> · {lead.email}
                {lead.organization === null ? '' : ` · ${lead.organization}`}
                {lead.phone === null ? '' : ` · ${lead.phone}`}
              </p>
              <p className="hint">
                <span className={`badge priority-${lead.score}`}>
                  {t(`marketing.leads.score_${lead.score}`)}
                </span>{' '}
                {t(`marketing.leads.source_${lead.source}`)} · {lead.role} · {lead.interest} ·{' '}
                {t('marketing.leads.received')} {day.format(lead.createdAt)}
              </p>
              {lead.message === null ? null : <p>{lead.message}</p>}
              <form action={updateLeadStatusAction} className="inline-form">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="leadId" value={lead.id} />
                <label className="visually-hidden" htmlFor={`status-${lead.id}`}>
                  {t('marketing.leads.statusFor', { name: lead.name })}
                </label>
                <select id={`status-${lead.id}`} name="status" defaultValue={lead.status}>
                  {leadStatuses.map((value) => (
                    <option key={value} value={value}>
                      {t(`marketing.leads.status_${value}`)}
                    </option>
                  ))}
                </select>{' '}
                <button type="submit" className="button secondary">
                  {t('marketing.leads.saveStatus')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
