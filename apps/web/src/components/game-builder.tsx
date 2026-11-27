'use client';

import { useId, useState, type ReactNode } from 'react';
import {
  maxGameItems,
  maxOptions,
  type ContentKind,
  type GroupItem,
  type ItemOf,
  type PairItem,
  type QuestionItem,
  type SentenceItem,
  type StandardInfo,
  type StatementItem,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  addItem,
  addMember,
  addOption,
  addStandardsToAll,
  moveItem,
  removeItem,
  removeMember,
  removeOption,
  replaceItem,
  setPicture,
  standardsText,
  textAsStandards,
} from '../server/game-builder-state.ts';
import { PictureField } from './game-picture.tsx';

type T = ReturnType<typeof createTranslator>;

/** A labelled text box whose value the builder holds. */
function CardText(props: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        type="text"
        value={props.value}
        aria-describedby={props.hint === undefined ? undefined : `${id}-hint`}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
      {props.hint === undefined ? null : (
        <p id={`${id}-hint`} className="hint">
          {props.hint}
        </p>
      )}
    </div>
  );
}

/** Why the right answer is right: shown to students after they answer, and at a live reveal. */
function ExplanationField(props: {
  readonly t: T;
  readonly value: string | undefined;
  readonly onChange: (value: string) => void;
}) {
  return (
    <CardText
      label={props.t('games.builderExplanation')}
      hint={props.t('games.builderExplanationHint')}
      value={props.value ?? ''}
      onChange={props.onChange}
    />
  );
}

function SmallButton(props: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="button secondary compact"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function QuestionCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: QuestionItem;
  readonly onChange: (item: QuestionItem) => void;
}) {
  const group = useId();
  return (
    <>
      <CardText
        label={t('games.builderQuestion')}
        value={item.prompt}
        onChange={(prompt) => {
          onChange({ ...item, prompt });
        }}
      />
      <PictureField
        t={t}
        picture={item.picture}
        onChange={(picture) => {
          onChange(setPicture(item, picture));
        }}
      />
      <ExplanationField
        t={t}
        value={item.explanation}
        onChange={(explanation) => {
          onChange({ ...item, explanation });
        }}
      />
      <ul className="builder-options">
        {item.options.map((option, index) => {
          const number = index + 1;
          return (
            <li key={index}>
              <label className="builder-correct">
                <input
                  type="radio"
                  name={`${group}-correct`}
                  checked={item.answer === index}
                  onChange={() => {
                    onChange({ ...item, answer: index });
                  }}
                />
                <span className="visually-hidden">
                  {t('games.builderCorrect', { option: number })}
                </span>
              </label>
              <CardText
                label={t('games.builderAnswer', { option: number })}
                value={option}
                onChange={(value) => {
                  onChange({ ...item, options: replaceItem(item.options, index, value) });
                }}
              />
              <SmallButton
                disabled={item.options.length <= 2}
                onClick={() => {
                  onChange(removeOption(item, index));
                }}
              >
                {t('games.builderRemoveAnswer', { option: number })}
              </SmallButton>
            </li>
          );
        })}
      </ul>
      <p className="hint">{t('games.builderCorrectHint')}</p>
      <p>
        <SmallButton
          disabled={item.options.length >= maxOptions}
          onClick={() => {
            onChange(addOption(item));
          }}
        >
          {t('games.builderAddAnswer')}
        </SmallButton>
      </p>
    </>
  );
}

function StatementCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: StatementItem;
  readonly onChange: (item: StatementItem) => void;
}) {
  const group = useId();
  return (
    <>
      <CardText
        label={t('games.builderStatement')}
        value={item.statement}
        onChange={(statement) => {
          onChange({ ...item, statement });
        }}
      />
      <PictureField
        t={t}
        picture={item.picture}
        onChange={(picture) => {
          onChange(setPicture(item, picture));
        }}
      />
      <ExplanationField
        t={t}
        value={item.explanation}
        onChange={(explanation) => {
          onChange({ ...item, explanation });
        }}
      />
      <fieldset className="builder-truth">
        <legend>{t('games.builderTruth')}</legend>
        {([true, false] as const).map((truth) => (
          <label key={String(truth)}>
            <input
              type="radio"
              name={`${group}-truth`}
              checked={item.isTrue === truth}
              onChange={() => {
                onChange({ ...item, isTrue: truth });
              }}
            />{' '}
            {truth ? t('games.builderTrue') : t('games.builderFalse')}
          </label>
        ))}
      </fieldset>
    </>
  );
}

function SentenceCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: SentenceItem;
  readonly onChange: (item: SentenceItem) => void;
}) {
  return (
    <>
      <CardText
        label={t('games.builderSentence')}
        hint={t('games.builderSentenceHint')}
        value={item.text}
        onChange={(text) => {
          onChange({ ...item, text });
        }}
      />
      <CardText
        label={t('games.builderBlankAnswer')}
        value={item.answer}
        onChange={(answer) => {
          onChange({ ...item, answer });
        }}
      />
      <PictureField
        t={t}
        picture={item.picture}
        onChange={(picture) => {
          onChange(setPicture(item, picture));
        }}
      />
      <ExplanationField
        t={t}
        value={item.explanation}
        onChange={(explanation) => {
          onChange({ ...item, explanation });
        }}
      />
    </>
  );
}

function PairCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: PairItem;
  readonly onChange: (item: PairItem) => void;
}) {
  return (
    <>
      <div className="field-row">
        <CardText
          label={t('games.builderTerm')}
          value={item.term}
          onChange={(term) => {
            onChange({ ...item, term });
          }}
        />
        <CardText
          label={t('games.builderDefinition')}
          value={item.definition}
          onChange={(definition) => {
            onChange({ ...item, definition });
          }}
        />
      </div>
      <PictureField
        t={t}
        picture={item.picture}
        onChange={(picture) => {
          onChange(setPicture(item, picture));
        }}
      />
    </>
  );
}

function StepCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: string;
  readonly onChange: (item: string) => void;
}) {
  return <CardText label={t('games.builderStep')} value={item} onChange={onChange} />;
}

function GroupCard({
  t,
  item,
  onChange,
}: {
  readonly t: T;
  readonly item: GroupItem;
  readonly onChange: (item: GroupItem) => void;
}) {
  return (
    <>
      <CardText
        label={t('games.builderGroupName')}
        value={item.name}
        onChange={(name) => {
          onChange({ ...item, name });
        }}
      />
      <ul className="builder-options">
        {item.members.map((member, index) => {
          const number = index + 1;
          return (
            <li key={index}>
              <CardText
                label={t('games.builderMember', { member: number })}
                value={member}
                onChange={(value) => {
                  onChange({ ...item, members: replaceItem(item.members, index, value) });
                }}
              />
              <SmallButton
                disabled={item.members.length <= 2}
                onClick={() => {
                  onChange(removeMember(item, index));
                }}
              >
                {t('games.builderRemoveMember', { member: number })}
              </SmallButton>
            </li>
          );
        })}
      </ul>
      <p>
        <SmallButton
          onClick={() => {
            onChange(addMember(item));
          }}
        >
          {t('games.builderAddMember')}
        </SmallButton>
      </p>
    </>
  );
}

/** Codes to add to every card at once, typed or picked from the teacher's lesson plans. */
function EveryCardStandards<Item>(props: {
  readonly t: T;
  readonly items: readonly Item[];
  readonly suggestions: readonly StandardInfo[];
  readonly onChange: (items: readonly Item[]) => void;
}) {
  const { t, items, suggestions, onChange } = props;
  const [typed, setTyped] = useState('');
  return (
    <fieldset className="card stack builder-every-card">
      <legend>{t('games.builderAllStandards')}</legend>
      <CardText
        label={t('games.builderStandards')}
        hint={t('games.builderAllStandardsHint')}
        value={typed}
        onChange={setTyped}
      />
      <p>
        <SmallButton
          disabled={typed.trim() === ''}
          onClick={() => {
            onChange(addStandardsToAll(items, textAsStandards(typed)));
            setTyped('');
          }}
        >
          {t('games.builderAllAdd')}
        </SmallButton>
      </p>
      {suggestions.length === 0 ? null : (
        <>
          <p className="muted">{t('games.builderPlanned')}</p>
          <ul className="list standard-suggestions">
            {suggestions.map((info) => (
              <li key={info.code}>
                <button
                  type="button"
                  className="button secondary compact"
                  aria-label={t('games.builderAllAddCode', { code: info.code })}
                  title={info.description ?? undefined}
                  onClick={() => {
                    onChange(addStandardsToAll(items, [info.code]));
                  }}
                >
                  + {info.code}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}

/** One card's fields, by the kind of content (a new kind adds an entry here). */
const cards: {
  readonly [K in ContentKind]: (props: {
    readonly t: T;
    readonly item: ItemOf<K>;
    readonly onChange: (item: ItemOf<K>) => void;
  }) => ReactNode;
} = {
  questions: QuestionCard,
  statements: StatementCard,
  sentences: SentenceCard,
  pairs: PairCard,
  steps: StepCard,
  groups: GroupCard,
};

/**
 * The visual question builder: one card per item, each with its own fields, and buttons to add,
 * move and delete cards. The parent holds the items and sends them with the form.
 */
export function GameBuilder<K extends ContentKind>(props: {
  readonly locale: Locale;
  readonly kind: K;
  readonly items: readonly ItemOf<K>[];
  readonly onChange: (items: readonly ItemOf<K>[]) => void;
  /** Codes from the teacher's lesson plans, offered for every card. */
  readonly suggestions?: readonly StandardInfo[];
}) {
  const t = createTranslator(props.locale);
  const { kind, items, onChange } = props;
  const Card = cards[kind] as (p: {
    readonly t: T;
    readonly item: ItemOf<K>;
    readonly onChange: (item: ItemOf<K>) => void;
  }) => ReactNode;
  return (
    <div className="stack game-builder">
      <ol className="builder-cards">
        {items.map((item, index) => {
          const number = index + 1;
          return (
            <li key={index}>
              <fieldset className="card stack builder-card">
                <legend>{t(`games.builderLegend_${kind}`, { number })}</legend>
                <Card
                  t={t}
                  item={item}
                  onChange={(changed) => {
                    onChange(replaceItem(items, index, changed));
                  }}
                />
                {typeof item === 'object' ? (
                  <CardText
                    label={t('games.builderStandards')}
                    hint={t('games.builderStandardsHint')}
                    value={standardsText(item.standards)}
                    onChange={(text) => {
                      const tagged = { ...item, standards: textAsStandards(text) } as ItemOf<K>;
                      onChange(replaceItem(items, index, tagged));
                    }}
                  />
                ) : null}
                <p className="actions builder-card-actions">
                  <SmallButton
                    disabled={index === 0}
                    onClick={() => {
                      onChange(moveItem(items, index, -1));
                    }}
                  >
                    {t('games.builderMoveUp')}
                  </SmallButton>
                  <SmallButton
                    disabled={index === items.length - 1}
                    onClick={() => {
                      onChange(moveItem(items, index, 1));
                    }}
                  >
                    {t('games.builderMoveDown')}
                  </SmallButton>
                  <SmallButton
                    onClick={() => {
                      onChange(removeItem(items, index));
                    }}
                  >
                    {t('games.builderDelete')}
                  </SmallButton>
                </p>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <p className="actions">
        <SmallButton
          disabled={items.length >= maxGameItems}
          onClick={() => {
            onChange(addItem(items, kind));
          }}
        >
          {t(`games.builderAdd_${kind}`)}
        </SmallButton>
        <span className="muted" aria-live="polite">
          {t('games.builderCount', { count: items.length, max: maxGameItems })}
        </span>
      </p>
      {kind === 'steps' ? null : (
        <EveryCardStandards
          t={t}
          items={items}
          suggestions={props.suggestions ?? []}
          onChange={onChange}
        />
      )}
    </div>
  );
}
