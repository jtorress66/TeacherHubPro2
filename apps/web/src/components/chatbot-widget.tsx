'use client';

import { useActionState, useEffect, useState } from 'react';
import { visitorInterests, visitorRoles } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { captureLeadAction, type LeadFormState } from '../app/_lib/marketing-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden } from './form-fields.tsx';

interface Turn {
  readonly id: string;
  readonly message: string;
  readonly reply: string | null;
  readonly status: 'pending' | 'answered' | 'failed';
}

const storageKey = 'thp_chat';
const pollMs = 1500;

/** The chat's token lives only in this browser tab, and ends when the tab closes. */
function stored(): { token: string; role: string; interest: string } | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    return raw === null
      ? null
      : (JSON.parse(raw) as { token: string; role: string; interest: string });
  } catch {
    return null;
  }
}

function LeadForm(props: {
  readonly locale: Locale;
  readonly role: string;
  readonly interest: string;
  readonly path: string;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(captureLeadAction, {} as LeadFormState);
  if (state.sent === true) {
    return (
      <p role="status" className="notice">
        {t('marketing.chat.leadSent')}
      </p>
    );
  }
  return (
    <form action={action} className="stack m-chat-lead" aria-label={t('marketing.chat.leadOpen')}>
      <Hidden
        values={{
          locale: props.locale,
          source: 'chat',
          role: props.role,
          interest: props.interest,
          page: `/${props.locale}${props.path}`,
        }}
      />
      <FormAlert message={state.errors?.form} />
      <Field
        id="chat-lead-name"
        name="name"
        label={t('marketing.contactPage.name')}
        error={state.errors?.name}
        required
      />
      <Field
        id="chat-lead-email"
        name="email"
        type="email"
        label={t('marketing.contactPage.email')}
        error={state.errors?.email}
        required
      />
      <Field
        id="chat-lead-organization"
        name="organization"
        label={t('marketing.contactPage.organization')}
      />
      <p className="hint">{t('marketing.contactPage.consent')}</p>
      <Submit label={t('marketing.contactPage.send')} />
    </form>
  );
}

/**
 * Ed, the website's AI assistant: the visitor picks a role and an interest, then chats; replies
 * come from the worker, polled here. It says up front that it is an AI.
 */
export function ChatbotWidget(props: { readonly locale: Locale; readonly path: string }) {
  const { locale } = props;
  const t = createTranslator(locale);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [interest, setInterest] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);

  useEffect(() => {
    const saved = stored();
    if (saved === null) return;
    setRole(saved.role);
    setInterest(saved.interest);
    setToken(saved.token);
  }, []);

  const waiting = turns.some((turn) => turn.status === 'pending');

  useEffect(() => {
    if (token === null || (!waiting && turns.length > 0)) return;
    const timer = setTimeout(() => {
      fetch('/api/chat', { headers: { 'x-chat-token': token }, cache: 'no-store' })
        .then((response) => (response.ok ? (response.json() as Promise<{ turns: Turn[] }>) : null))
        .then((body) => {
          if (body !== null) setTurns(body.turns);
        })
        .catch(() => undefined);
    }, pollMs);
    return () => {
      clearTimeout(timer);
    };
  }, [token, waiting, turns]);

  async function start(chosenInterest: string) {
    setInterest(chosenInterest);
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role,
        interest: chosenInterest,
        locale,
        page: `/${locale}${props.path}`,
      }),
    });
    if (!response.ok) {
      setNotice(t('marketing.chat.failed'));
      return;
    }
    const { token: newToken } = (await response.json()) as { token: string };
    setToken(newToken);
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ token: newToken, role, interest: chosenInterest }),
      );
    } catch {
      // Private browsing: the chat still works until the page is left.
    }
  }

  async function send(event: { preventDefault: () => void }) {
    event.preventDefault();
    const message = draft.trim();
    if (message === '' || token === null) return;
    setDraft('');
    setNotice(null);
    const response = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chat-token': token },
      body: JSON.stringify({ message }),
    });
    if (response.status === 429) {
      setNotice(t('marketing.chat.limit'));
      return;
    }
    if (!response.ok) {
      setNotice(t('marketing.chat.failed'));
      return;
    }
    const { turnId } = (await response.json()) as { turnId: string };
    setTurns((current) => [...current, { id: turnId, message, reply: null, status: 'pending' }]);
  }

  const answered = turns.filter((turn) => turn.status === 'answered').length;

  return (
    <div className="m-chat">
      {open ? (
        <section className="m-chat-panel card" aria-labelledby="m-chat-title">
          <header className="m-chat-head">
            <h2 id="m-chat-title">{t('marketing.chat.title')}</h2>
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('marketing.chat.close')}
            </button>
          </header>
          <p>{t('marketing.chat.intro')}</p>
          {role === null ? (
            <fieldset className="m-chat-choices">
              <legend>{t('marketing.chat.rolePrompt')}</legend>
              {visitorRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setRole(r);
                  }}
                >
                  {t(`marketing.roles.${r}`)}
                </button>
              ))}
            </fieldset>
          ) : token === null ? (
            <fieldset className="m-chat-choices">
              <legend>{t('marketing.chat.interestPrompt')}</legend>
              {visitorInterests.map((i) => (
                <button
                  key={i}
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    void start(i);
                  }}
                >
                  {t(`marketing.interests.${i}`)}
                </button>
              ))}
            </fieldset>
          ) : (
            <>
              <ol className="m-chat-log" aria-live="polite">
                {turns.map((turn) => (
                  <li key={turn.id}>
                    <p className="m-chat-you">
                      <strong>{t('marketing.chat.you')}:</strong> {turn.message}
                    </p>
                    <p className="m-chat-ed">
                      <strong>{t('marketing.chat.ed')}:</strong>{' '}
                      {turn.status === 'answered'
                        ? turn.reply
                        : turn.status === 'failed'
                          ? t('marketing.chat.failed')
                          : t('marketing.chat.thinking')}
                    </p>
                  </li>
                ))}
              </ol>
              {notice === null ? null : (
                <p role="alert" className="alert">
                  {notice}
                </p>
              )}
              <form onSubmit={(event) => void send(event)} className="m-chat-form">
                <label htmlFor="m-chat-input" className="visually-hidden">
                  {t('marketing.chat.placeholder')}
                </label>
                <input
                  id="m-chat-input"
                  value={draft}
                  maxLength={1000}
                  placeholder={t('marketing.chat.placeholder')}
                  onChange={(event) => {
                    setDraft(event.target.value);
                  }}
                />
                <button type="submit" className="button" disabled={waiting}>
                  {t('marketing.chat.send')}
                </button>
              </form>
              <p className="hint">{t('marketing.chat.aiNote')}</p>
              {leadOpen || answered >= 2 ? (
                <LeadForm
                  locale={locale}
                  role={role}
                  interest={interest ?? 'other'}
                  path={props.path}
                />
              ) : (
                <p>
                  {t('marketing.chat.leadPrompt')}{' '}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setLeadOpen(true);
                    }}
                  >
                    {t('marketing.chat.leadOpen')}
                  </button>
                </p>
              )}
            </>
          )}
        </section>
      ) : null}
      <button
        type="button"
        className="button accent m-chat-button"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
        }}
      >
        {open ? t('marketing.chat.close') : t('marketing.chat.open')}
      </button>
    </div>
  );
}
