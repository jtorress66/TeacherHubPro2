'use client';

import { useId, useRef, useState } from 'react';
// Types only: the catalog itself stays on the server and loads one subject and grade at a time.
import type { PrChoice, PrSubject, StandardDomain } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

interface PrCode {
  readonly code: string;
  readonly description: string;
  readonly domain: StandardDomain;
  readonly course: string | null;
}

/** Which Puerto Rico list the plan's pickers show: a subject and a grade or school level. */
export interface PrSelection {
  readonly subject: PrSubject | '';
  readonly grade: PrChoice | '';
}

const loaded = new Map<string, Promise<readonly PrCode[]>>();

function codesFor(subject: PrSubject, grade: PrChoice): Promise<readonly PrCode[]> {
  const key = `${subject}|${grade}`;
  let codes = loaded.get(key);
  if (codes === undefined) {
    const query = new URLSearchParams({ subject, grade });
    codes = fetch(`/api/standards/pr?${query.toString()}`).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as PrCode[];
    });
    codes.catch(() => loaded.delete(key));
    loaded.set(key, codes);
  }
  return codes;
}

const typedCodes = (input: HTMLInputElement | null): string[] =>
  (input?.value ?? '')
    .split(/[\n,]+/u)
    .map((code) => code.trim())
    .filter((code) => code !== '');

/**
 * "Choose codes" for one standards category: a dialog listing the chosen Puerto Rico subject and
 * grade's codes for that category, to tick and add to the category's box. Typing still works.
 */
export function PrCodesPicker(props: {
  readonly locale: Locale;
  readonly selection: PrSelection;
  readonly domain: StandardDomain;
  readonly categoryLabel: string;
  /** The id of the category's text box. */
  readonly inputId: string;
}) {
  const t = createTranslator(props.locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [codes, setCodes] = useState<readonly PrCode[]>([]);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const { subject, grade } = props.selection;
  const input = () => document.getElementById(props.inputId) as HTMLInputElement | null;

  if (subject === '' || grade === '') return null;

  const open = () => {
    setTicked(new Set(typedCodes(input())));
    setState('loading');
    dialog.current?.showModal();
    codesFor(subject, grade).then(
      (all) => {
        setCodes(all.filter((code) => code.domain === props.domain));
        setState('idle');
      },
      () => {
        setState('failed');
      },
    );
  };

  const add = () => {
    const box = input();
    if (box !== null) {
      const listed = new Set(codes.map((code) => code.code));
      // Keep codes typed by hand that are not in this list, then the ticked ones in list order.
      const kept = typedCodes(box).filter((code) => !listed.has(code));
      const chosen = codes.map((code) => code.code).filter((code) => ticked.has(code));
      box.value = [...kept, ...chosen].join(', ');
    }
    dialog.current?.close();
  };

  const toggle = (code: string, on: boolean) => {
    const next = new Set(ticked);
    if (on) next.add(code);
    else next.delete(code);
    setTicked(next);
  };

  return (
    <>
      <button
        type="button"
        className="button secondary small-button"
        aria-label={`${t('planner.prChoose')}: ${props.categoryLabel}`}
        onClick={open}
      >
        {t('planner.prChoose')}
      </button>
      <dialog ref={dialog} className="pr-picker card" aria-labelledby={titleId}>
        <h3 id={titleId}>{t('planner.prChooseFor', { category: props.categoryLabel })}</h3>
        {state === 'loading' ? <p role="status">{t('planner.prLoading')}</p> : null}
        {state === 'failed' ? <p role="alert">{t('planner.prFailed')}</p> : null}
        {state === 'idle' && codes.length === 0 ? <p>{t('planner.prNone')}</p> : null}
        {codes.length > 0 ? (
          <ul className="pr-codes">
            {codes.map((code) => (
              <li key={code.code}>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={ticked.has(code.code)}
                    onChange={(event) => {
                      toggle(code.code, event.target.checked);
                    }}
                  />{' '}
                  <span>
                    <strong>{code.code}</strong>
                    {code.course === null ? '' : ` (${code.course})`} {code.description}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="actions">
          <button type="button" className="button" onClick={add} disabled={codes.length === 0}>
            {t('planner.prAdd')}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              dialog.current?.close();
            }}
          >
            {t('planner.prClose')}
          </button>
        </p>
      </dialog>
    </>
  );
}
