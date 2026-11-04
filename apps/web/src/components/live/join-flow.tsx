'use client';

import { useState } from 'react';
import type { LiveLobby } from '@thp/application';
import { createTranslator, type Locale } from '@thp/i18n';
import { findLiveByPinAction, joinLiveAction } from '../../app/_lib/live-actions.ts';
import { PlayerScreen } from './player-screen.tsx';

const tokenKey = (pin: string, studentId: string) => `thp-live-${pin}-${studentId}`;

/** Remembers this device's reconnect token for the session; storage may be unavailable. */
function remembered(pin: string, studentId: string): string | undefined {
  try {
    return sessionStorage.getItem(tokenKey(pin, studentId)) ?? undefined;
  } catch {
    return undefined;
  }
}

function remember(pin: string, studentId: string, token: string): void {
  try {
    sessionStorage.setItem(tokenKey(pin, studentId), token);
  } catch {
    // Without storage the student can still play; they just can't rejoin after a reload.
  }
}

/** How a student joins without an account: the PIN on the board, then their own name. */
export function JoinFlow(props: {
  readonly locale: Locale;
  readonly realtimeUrl: string;
  readonly initialPin: string;
}) {
  const t = createTranslator(props.locale);
  const [pin, setPin] = useState(props.initialPin);
  const [lobby, setLobby] = useState<LiveLobby | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ticket !== null) {
    return <PlayerScreen locale={props.locale} realtimeUrl={props.realtimeUrl} ticket={ticket} />;
  }

  const find = async () => {
    setBusy(true);
    const reply = await findLiveByPinAction({ pin });
    setBusy(false);
    setLobby(reply.ok ? reply.lobby : null);
    setMessage(reply.ok ? null : t('play.notFound'));
  };

  const join = async (studentId: string) => {
    setBusy(true);
    const reconnectToken = remembered(pin, studentId);
    const reply = await joinLiveAction(props.locale, {
      pin,
      studentId,
      ...(reconnectToken === undefined ? {} : { reconnectToken }),
    });
    setBusy(false);
    if (!reply.ok) {
      setMessage(reply.message);
      void find();
      return;
    }
    remember(pin, studentId, reply.join.reconnectToken);
    setTicket(reply.join.ticket);
  };

  return (
    <div className="stack live-join-flow">
      <h1>{lobby?.title ?? t('play.title')}</h1>
      {message !== null ? (
        <p role="alert" className="alert">
          {message}
        </p>
      ) : null}
      {lobby === null ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void find();
          }}
        >
          <div className="field">
            <label htmlFor="live-pin-input">{t('play.pin')}</label>
            <input
              id="live-pin-input"
              className="pin-input"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/gu, ''));
              }}
            />
          </div>
          <button type="submit" className="button accent large" disabled={busy || pin.length !== 6}>
            {t('play.join')}
          </button>
        </form>
      ) : (
        <>
          <h2>{t('play.pickName')}</h2>
          <ul className="name-grid" aria-label={t('play.pickName')}>
            {lobby.names.map((entry) => (
              <li key={entry.studentId}>
                <button
                  type="button"
                  className="button secondary large"
                  disabled={busy || entry.taken}
                  onClick={() => {
                    void join(entry.studentId);
                  }}
                >
                  {entry.name}
                  {entry.taken ? <span className="small">{t('play.taken')}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
