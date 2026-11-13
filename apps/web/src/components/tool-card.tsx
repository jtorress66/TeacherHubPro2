import type { ReactNode } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import { toolGroups, type ToolGroup, type ToolId } from '../server/connected-tools.ts';

/** One service on a Connected tools page: its name, its group tag, then what the page adds. */
export function ToolCard(props: {
  readonly locale: Locale;
  readonly headingId: string;
  readonly heading: string;
  readonly group: ToolGroup;
  readonly children: ReactNode;
}) {
  const t = createTranslator(props.locale);
  return (
    <section className="card stack tool-card" aria-labelledby={props.headingId}>
      <div className="tool-head">
        <h2 id={props.headingId}>{props.heading}</h2>
        <span className="badge">{t(`connectedTools.group.${props.group}`)}</span>
      </div>
      {props.children}
    </section>
  );
}

/** A tool's own description, from the shared list. */
export function ToolText({ locale, id }: { readonly locale: Locale; readonly id: ToolId }) {
  return <p className="muted">{createTranslator(locale)(`connectedTools.tool.${id}.text`)}</p>;
}

/** For a tool that is switched off or not built yet: say so, and let a school ask for it. */
export function ToolRequest(props: {
  readonly locale: Locale;
  readonly id: ToolId;
  readonly status: 'comingSoon' | 'onRequest';
}) {
  const t = createTranslator(props.locale);
  return (
    <>
      <p>
        <span className="badge tool-status">{t(`connectedTools.${props.status}`)}</span>
      </p>
      <p className="hint">{t(`connectedTools.${props.status}Text`)}</p>
      <p>
        <a href={`/${props.locale}/contact?tool=${props.id}`}>
          {t('connectedTools.askAbout', { tool: t(`connectedTools.tool.${props.id}.name`) })}
        </a>
      </p>
    </>
  );
}

/** The filter buttons: plain links, so they work without scripts and can be shared. */
export function ToolFilter(props: {
  readonly locale: Locale;
  readonly path: string;
  readonly current: ToolGroup | null;
}) {
  const t = createTranslator(props.locale);
  const options = [
    { group: null, label: t('connectedTools.all') },
    ...toolGroups.map((group) => ({ group, label: t(`connectedTools.group.${group}`) })),
  ];
  return (
    <nav aria-label={t('connectedTools.filter')}>
      <ul className="m-pills tool-filter">
        {options.map((option) => (
          <li key={option.group ?? 'all'}>
            <a
              className="chip"
              href={option.group === null ? props.path : `${props.path}?group=${option.group}`}
              aria-current={option.group === props.current ? 'page' : undefined}
            >
              {option.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
