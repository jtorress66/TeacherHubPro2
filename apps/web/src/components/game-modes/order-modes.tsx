'use client';

import { useState } from 'react';
import type { DragDropView, SequenceView } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import type { RendererProps } from './renderer.ts';

/** Move the steps into order; the answer is the shown steps in the student's order. */
export function SequenceRound({ view, locale, onDone }: RendererProps<SequenceView>) {
  const t = createTranslator(locale);
  const [order, setOrder] = useState<number[]>(view.steps.map((_, i) => i));
  const move = (position: number, by: number) => {
    const target = position + by;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[position], next[target]] = [next[target] ?? 0, next[position] ?? 0];
    setOrder(next);
  };
  return (
    <div className="stack">
      <ol className="sequence-list">
        {order.map((step, position) => (
          <li key={view.steps[step]}>
            <span>{view.steps[step]}</span>{' '}
            <button
              type="button"
              className="button secondary small"
              aria-label={`${t('gamePlay.moveUp')}: ${view.steps[step] ?? ''}`}
              disabled={position === 0}
              onClick={() => {
                move(position, -1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className="button secondary small"
              aria-label={`${t('gamePlay.moveDown')}: ${view.steps[step] ?? ''}`}
              disabled={position === order.length - 1}
              onClick={() => {
                move(position, 1);
              }}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="button"
        onClick={() => {
          onDone(order);
        }}
      >
        {t('gamePlay.check')}
      </button>
    </div>
  );
}

/** Drag each item into a group, or pick its group from the list beside it. */
export function DragDropRound({ view, locale, onDone }: RendererProps<DragDropView>) {
  const t = createTranslator(locale);
  const [placed, setPlaced] = useState<number[]>(view.items.map(() => -1));
  const place = (item: number, group: number) => {
    const next = [...placed];
    next[item] = group;
    setPlaced(next);
  };
  return (
    <div className="stack">
      <div className="drop-zones">
        {view.groups.map((group, g) => (
          <section
            key={group}
            className="drop-zone"
            aria-label={group}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              place(Number(event.dataTransfer.getData('text/plain')), g);
            }}
          >
            <h3>{group}</h3>
            <ul>
              {view.items.map((item, i) => (placed[i] === g ? <li key={item}>{item}</li> : null))}
            </ul>
          </section>
        ))}
      </div>
      {view.items.map((item, i) => (
        <div
          className="field drag-item"
          key={item}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData('text/plain', String(i));
          }}
        >
          <label htmlFor={`group-${String(i)}`}>{t('gamePlay.groupFor', { item })}</label>
          <select
            id={`group-${String(i)}`}
            value={String(placed[i] ?? -1)}
            onChange={(event) => {
              place(i, Number(event.target.value));
            }}
          >
            <option value="-1">{t('gamePlay.choose')}</option>
            {view.groups.map((group, g) => (
              <option key={group} value={g}>
                {group}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        className="button"
        onClick={() => {
          onDone(placed);
        }}
      >
        {t('gamePlay.check')}
      </button>
    </div>
  );
}
