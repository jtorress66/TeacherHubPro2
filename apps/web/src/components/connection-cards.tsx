import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import type { MicrosoftNotice as Notice } from '../server/microsoft-notice.ts';
import { disconnectClassroomAction } from '../app/_lib/assignment-actions.ts';
import { disconnectCanvaAction } from '../app/_lib/canva-actions.ts';
import { disconnectMicrosoftAction } from '../app/_lib/microsoft-actions.ts';
import { ToolCard, ToolText } from './tool-card.tsx';

/** The outcome of an OAuth round trip, shown once at the top of its card. */
function Outcome(props: { readonly locale: Locale; readonly outcome: Notice | null }) {
  if (props.outcome === null) return null;
  return (
    <p role={props.outcome.role} className={props.outcome.role === 'status' ? 'notice' : 'alert'}>
      {createTranslator(props.locale)(props.outcome.key)}
    </p>
  );
}

/** A connect link, or a disconnect button with its state. */
function Connection(props: {
  readonly locale: Locale;
  readonly connected: boolean;
  readonly connectedText: string;
  readonly notConnectedText: string;
  readonly connectHref: string;
  readonly connectLabel: string;
  readonly disconnect: (form: FormData) => Promise<void>;
  readonly disconnectLabel: string;
  readonly disconnectNote?: string;
}) {
  if (props.connected) {
    return (
      <>
        <p>{props.connectedText}</p>
        <form action={props.disconnect}>
          <input type="hidden" name="locale" value={props.locale} />
          <button type="submit" className="button secondary">
            {props.disconnectLabel}
          </button>
        </form>
        {props.disconnectNote === undefined ? null : (
          <p className="muted">{props.disconnectNote}</p>
        )}
      </>
    );
  }
  return (
    <>
      <p className="muted">{props.notConnectedText}</p>
      <p>
        <a className="button" href={props.connectHref}>
          {props.connectLabel}
        </a>
      </p>
    </>
  );
}

/** "connected" / "failed" from the callback's redirect, as a notice. */
const simpleOutcome = (
  value: string | undefined,
  connected: MessageKey,
  failed: MessageKey,
): Notice | null =>
  value === 'connected'
    ? { role: 'status', key: connected }
    : value === 'failed'
      ? { role: 'alert', key: failed }
      : null;

export function ClassroomCard(props: {
  readonly locale: Locale;
  readonly connected: boolean;
  readonly notice: string | undefined;
}) {
  const t = createTranslator(props.locale);
  return (
    <ToolCard
      locale={props.locale}
      headingId="classroom-heading"
      heading={t('classroom.title')}
      group="google"
    >
      <ToolText locale={props.locale} id="classroom" />
      <Outcome
        locale={props.locale}
        outcome={simpleOutcome(props.notice, 'classroom.connectedNotice', 'classroom.failedNotice')}
      />
      <Connection
        locale={props.locale}
        connected={props.connected}
        connectedText={t('classroom.connected')}
        notConnectedText={t('classroom.notConnected')}
        connectHref={`/api/classroom/connect?locale=${props.locale}`}
        connectLabel={t('classroom.connect')}
        disconnect={disconnectClassroomAction}
        disconnectLabel={t('classroom.disconnect')}
      />
    </ToolCard>
  );
}

export function CanvaCard(props: {
  readonly locale: Locale;
  readonly connected: boolean;
  readonly notice: string | undefined;
}) {
  const t = createTranslator(props.locale);
  return (
    <ToolCard
      locale={props.locale}
      headingId="canva-heading"
      heading={t('canva.title')}
      group="canva"
    >
      <ToolText locale={props.locale} id="canva" />
      <Outcome
        locale={props.locale}
        outcome={simpleOutcome(props.notice, 'canva.connectedNotice', 'canva.failedNotice')}
      />
      <Connection
        locale={props.locale}
        connected={props.connected}
        connectedText={t('canva.connected')}
        notConnectedText={t('canva.notConnected')}
        connectHref={`/api/canva/connect?locale=${props.locale}`}
        connectLabel={t('canva.connect')}
        disconnect={disconnectCanvaAction}
        disconnectLabel={t('canva.disconnect')}
      />
    </ToolCard>
  );
}

export function MicrosoftCard(props: {
  readonly locale: Locale;
  readonly connected: boolean;
  readonly outcome: Notice | null;
}) {
  const t = createTranslator(props.locale);
  return (
    <ToolCard
      locale={props.locale}
      headingId="microsoft-heading"
      heading={t('microsoft.title')}
      group="microsoft"
    >
      <ToolText locale={props.locale} id="onedrive" />
      <Outcome locale={props.locale} outcome={props.outcome} />
      <Connection
        locale={props.locale}
        connected={props.connected}
        connectedText={t('microsoft.connected')}
        notConnectedText={t('microsoft.notConnected')}
        connectHref={`/api/microsoft/connect?locale=${props.locale}`}
        connectLabel={t('microsoft.connect')}
        disconnect={disconnectMicrosoftAction}
        disconnectLabel={t('microsoft.disconnect')}
        disconnectNote={t('microsoft.disconnectNote')}
      />
    </ToolCard>
  );
}

/** Teams rides on the Microsoft connection: allowing it asks for the extra school permissions. */
export function TeamsCard(props: { readonly locale: Locale; readonly allowed: boolean }) {
  const t = createTranslator(props.locale);
  return (
    <ToolCard
      locale={props.locale}
      headingId="teams-heading"
      heading={t('teams.title')}
      group="microsoft"
    >
      {props.allowed ? (
        <p>{t('teams.allowed')}</p>
      ) : (
        <>
          <p className="muted">{t('teams.notAllowed')}</p>
          <p>
            <a
              className="button secondary"
              href={`/api/microsoft/connect?locale=${props.locale}&teams=1`}
            >
              {t('teams.allow')}
            </a>
          </p>
        </>
      )}
      <p className="hint">{t('teams.note')}</p>
    </ToolCard>
  );
}
