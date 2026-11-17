'use client';

import { useState } from 'react';
import { makeGroups, parseNames, pickName, type GroupRequest } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

/**
 * The free group maker and name picker. Students are minors: the names stay in this browser
 * tab and are never sent anywhere or saved.
 */
export function GroupMaker(props: { readonly locale: Locale }) {
  const t = createTranslator(props.locale);
  const [text, setText] = useState('');
  const [by, setBy] = useState<GroupRequest['by']>('count');
  const [value, setValue] = useState('4');
  const [groups, setGroups] = useState<string[][]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const names = parseNames(text);

  return (
    <div className="free-tool stack">
      <label>
        {t('marketing.freeTools.names')}
        <textarea
          rows={8}
          value={text}
          aria-describedby="names-hint"
          onChange={(event) => {
            setText(event.target.value);
          }}
        />
      </label>
      <p className="hint" id="names-hint">
        {t('marketing.freeTools.namesHint')}{' '}
        <span data-testid="names-count">
          {t('marketing.freeTools.namesCount', { count: names.length })}
        </span>
      </p>
      <fieldset className="free-split">
        <legend>{t('marketing.freeTools.splitBy')}</legend>
        <label>
          <input
            type="radio"
            name="by"
            checked={by === 'count'}
            onChange={() => {
              setBy('count');
            }}
          />{' '}
          {t('marketing.freeTools.byCount')}
        </label>
        <label>
          <input
            type="radio"
            name="by"
            checked={by === 'size'}
            onChange={() => {
              setBy('size');
            }}
          />{' '}
          {t('marketing.freeTools.bySize')}
        </label>
        <label>
          {t('marketing.freeTools.howMany')}
          <input
            type="number"
            min={1}
            max={50}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
            }}
          />
        </label>
      </fieldset>
      <p className="actions">
        <button
          type="button"
          className="button"
          disabled={names.length === 0}
          onClick={() => {
            setGroups(makeGroups(names, { by, value: Number(value) }, Math.random));
          }}
        >
          {t('marketing.freeTools.make')}
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={names.length === 0}
          onClick={() => {
            setPicked(pickName(names, Math.random));
          }}
        >
          {t('marketing.freeTools.pick')}
        </button>
      </p>
      <p role="status" className="free-picked">
        {picked === null ? '' : t('marketing.freeTools.picked', { name: picked })}
      </p>
      {groups.length === 0 ? null : (
        <ol className="free-groups">
          {groups.map((group, index) => (
            <li key={index} className="card">
              <h3>{t('marketing.freeTools.group', { n: index + 1 })}</h3>
              <ul>
                {group.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
