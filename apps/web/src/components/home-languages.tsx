'use client';

import { useEffect, useState } from 'react';

export interface LanguageSample {
  readonly locale: string;
  readonly name: string;
  readonly hello: string;
  readonly sample: string;
}

/**
 * A greeting and a worksheet title in each language, each written in its own catalog. It moves on
 * by itself until the visitor picks one, and stays still for visitors who turn motion off.
 */
export function HomeLanguages(props: {
  readonly samples: readonly LanguageSample[];
  readonly writes: string;
  readonly pick: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % props.samples.length);
    }, 2600);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused, props.samples.length]);

  const shown = props.samples[index] ?? props.samples[0];
  if (shown === undefined) return null;
  return (
    <>
      <p key={shown.locale} className="lang-hello" lang={shown.locale}>
        {shown.hello}
      </p>
      <p className="lang-sample">
        {props.writes} <b lang={shown.locale}>{shown.sample}</b>
      </p>
      <div className="lang-list" role="group" aria-label={props.pick}>
        {props.samples.map((sample, i) => (
          <button
            key={sample.locale}
            type="button"
            lang={sample.locale}
            aria-pressed={i === index}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          >
            {sample.name}
          </button>
        ))}
      </div>
    </>
  );
}
