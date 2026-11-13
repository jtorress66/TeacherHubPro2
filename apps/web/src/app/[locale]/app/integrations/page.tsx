import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { CalendarLinkCard } from '../../../../components/calendar-link-card.tsx';
import {
  CanvaCard,
  ClassroomCard,
  MicrosoftCard,
  TeamsCard,
} from '../../../../components/connection-cards.tsx';
import { ToolCard, ToolFilter, ToolRequest, ToolText } from '../../../../components/tool-card.tsx';
import { getAppContainer } from '../../../../container.ts';
import { isAdminOf } from '@thp/domain';
import {
  comingSoonWith,
  ltiTools,
  toolGroupFrom,
  toolsIn,
  type Tool,
  type ToolId,
} from '../../../../server/connected-tools.ts';
import { microsoftNotice } from '../../../../server/microsoft-notice.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('connectedTools.title') };
}

/**
 * Every service TeacherHubPro works with, in one place: connect or disconnect the ones that are on,
 * and ask for the ones that are switched off or not built yet.
 */
export default async function ConnectedToolsPage(
  props: LocaleParams & {
    readonly searchParams: Promise<{
      group?: string;
      classroom?: string;
      canva?: string;
      microsoft?: string;
    }>;
  },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const search = await props.searchParams;
  const group = toolGroupFrom(search.group);
  const app = getAppContainer();
  const classroomConnected = (await app.listClassroomCourses.execute({ actor: user })).ok;
  const canvaConnected = (await app.canva?.connected.execute({ actor: user })) ?? null;
  const microsoftConnected = (await app.microsoft?.connected.execute({ actor: user })) ?? null;
  const teamsAllowed = (await app.teams?.allowed.execute({ actor: user })) ?? null;
  const calendarLink = await app.getCalendarLinkStatus.execute({ actor: user });
  const ltiSetUp = (await app.lti?.setUpForSchool.execute({ actor: user })) ?? null;
  const comingSoon = comingSoonWith(app.lti !== null);

  const plain = (tool: Tool, body: ReactNode) => (
    <ToolCard
      key={tool.id}
      locale={locale}
      headingId={`${tool.id}-heading`}
      heading={t(`connectedTools.tool.${tool.id}.name`)}
      group={tool.group}
    >
      <ToolText locale={locale} id={tool.id} />
      {body}
    </ToolCard>
  );
  const onRequest = (tool: Tool) =>
    plain(tool, <ToolRequest locale={locale} id={tool.id} status="onRequest" />);
  const notBuilt = (tool: Tool) =>
    plain(tool, <ToolRequest locale={locale} id={tool.id} status="comingSoon" />);
  const viaClassroom = (tool: Tool) =>
    plain(
      tool,
      <p>
        {t(classroomConnected ? 'connectedTools.viaClassroom' : 'connectedTools.needsClassroom')}
      </p>,
    );

  // A school system the school has set up opens from the course; otherwise a school can ask,
  // and its admin can set it up.
  const schoolSystem = (tool: Tool) =>
    plain(
      tool,
      ltiSetUp?.ok === true && ltiSetUp.value ? (
        <>
          <p>
            <span className="badge tool-status">{t('connectedTools.ltiSetUpBadge')}</span>
          </p>
          <p>{t('connectedTools.ltiSetUp')}</p>
        </>
      ) : (
        <>
          <ToolRequest locale={locale} id={tool.id} status="onRequest" />
          {isAdminOf(user, user.schoolId) ? (
            <p>
              <a href={`/${locale}/app/admin/school-systems`}>{t('connectedTools.ltiAdminLink')}</a>
            </p>
          ) : null}
        </>
      ),
    );
  const ltiCards = Object.fromEntries([...ltiTools].map((id) => [id, schoolSystem]));

  // The school systems that are not built yet have no entry: they fall back to "coming soon".
  const cards: Readonly<Partial<Record<ToolId, (tool: Tool) => ReactNode>>> = {
    googleSignIn: (tool) => plain(tool, <p>{t('connectedTools.signInNote')}</p>),
    classroom: () => (
      <ClassroomCard
        key="classroom"
        locale={locale}
        connected={classroomConnected}
        notice={search.classroom}
      />
    ),
    forms: viaClassroom,
    slides: viaClassroom,
    onedrive: (tool) =>
      microsoftConnected === null ? (
        onRequest(tool)
      ) : (
        <MicrosoftCard
          key="onedrive"
          locale={locale}
          connected={microsoftConnected}
          outcome={microsoftNotice(search.microsoft)}
        />
      ),
    teams: (tool) =>
      teamsAllowed === null ? (
        onRequest(tool)
      ) : (
        <TeamsCard key="teams" locale={locale} allowed={teamsAllowed} />
      ),
    canva: (tool) =>
      canvaConnected === null ? (
        onRequest(tool)
      ) : (
        <CanvaCard key="canva" locale={locale} connected={canvaConnected} notice={search.canva} />
      ),
    ...ltiCards,
    calendar: () => (
      <CalendarLinkCard
        key="calendar"
        locale={locale}
        active={calendarLink.ok && calendarLink.value.active}
      />
    ),
  };

  return (
    <section className="stack">
      <h1>{t('connectedTools.title')}</h1>
      <p className="muted">{t('connectedTools.intro')}</p>
      <ToolFilter locale={locale} path={`/${locale}/app/integrations`} current={group} />
      <div className="settings-grid">
        {toolsIn(group).map((tool) =>
          comingSoon.has(tool.id) ? notBuilt(tool) : (cards[tool.id] ?? notBuilt)(tool),
        )}
      </div>
    </section>
  );
}
