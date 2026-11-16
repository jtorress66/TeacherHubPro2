'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * A small trial bar that slides up once the visitor scrolls past the hero, and gets out of the
 * way when the closing invitation is on screen.
 */
export function HomeSticky(props: {
  readonly text: string;
  readonly action: string;
  readonly href: string;
  readonly afterId: string;
  readonly beforeId: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const update = () => {
      const after = document.getElementById(props.afterId);
      const before = document.getElementById(props.beforeId);
      const past = after !== null && after.getBoundingClientRect().bottom < 0;
      const atEnd = before !== null && before.getBoundingClientRect().top < window.innerHeight;
      setShown(past && !atEnd);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, [props.afterId, props.beforeId]);

  return (
    <div className={shown ? 'home-sticky is-shown' : 'home-sticky'} aria-hidden={!shown}>
      <p>{props.text}</p>
      <Link href={props.href} className="button accent" tabIndex={shown ? 0 : -1}>
        {props.action}
      </Link>
    </div>
  );
}
