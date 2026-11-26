'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { DemoText } from './home-demo-text.ts';

const tabs = ['prep', 'grade', 'game', 'family'] as const;
type Tab = (typeof tabs)[number];

const tabLabel = {
  prep: 'tabPrep',
  grade: 'tabGrade',
  game: 'tabGame',
  family: 'tabFamily',
} as const;
const side = {
  prep: ['prepTitle', 'prepText', 'prepRule'],
  grade: ['gradeTitle', 'gradeText', 'gradeRule'],
  game: ['gameTitle', 'gameText', 'gameRule'],
  family: ['familyTitle', 'familyText', 'familyRule'],
} as const;

// Sample first names for the live game; the demo shows no real students.
const players = ['Ana', 'Luis', 'Mia', 'Jay', 'Sofi', 'Theo', 'Nia', 'Omar'];
const teams = [
  { key: 'gameTeam1', score: 920 },
  { key: 'gameTeam2', score: 780 },
  { key: 'gameTeam3', score: 610 },
] as const;
const keptScore = 9;
const changedScore = 10;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A step's place in its staggered entrance, for the CSS delay. */
const order = (i: number) => ({ '--i': i }) as CSSProperties;

/**
 * Four short, clickable stories of the app at work. Everything is readable before it plays: the
 * animations only replay entrances, and they stay still for visitors who turn motion off.
 */
export function HomeDemo({ text }: { readonly text: DemoText }) {
  const [tab, setTab] = useState<Tab>('prep');
  // Each play remounts the panel, so its CSS entrances run again.
  const [play, setPlay] = useState(0);
  const [typed, setTyped] = useState<number | null>(null);
  const [approved, setApproved] = useState(false);
  const [grade, setGrade] = useState<'kept' | 'changed' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const start = (next: Tab) => {
    setTab(next);
    setApproved(false);
    setGrade(null);
    setPlay((n) => n + 1);
  };

  // The first play starts when the demo scrolls into view.
  useEffect(() => {
    const element = root.current;
    if (element === null || reducedMotion() || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting === true) {
          setPlay((n) => (n === 0 ? 1 : n));
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  // The Prep Agent's sentence types itself out on each play.
  useEffect(() => {
    if (play === 0 || tab !== 'prep' || reducedMotion()) return;
    let length = 0;
    setTyped(0);
    const timer = window.setInterval(() => {
      length += 1;
      setTyped(length);
      if (length >= text.prepPrompt.length) {
        window.clearInterval(timer);
        setTyped(null);
      }
    }, 28);
    return () => {
      window.clearInterval(timer);
    };
  }, [play, tab, text.prepPrompt]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const next = (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
    const target = tabs[next] ?? 'prep';
    tabRefs.current[next]?.focus();
    start(target);
  };

  const animated = play > 0 ? ' is-playing' : '';
  const prompt = typed === null ? text.prepPrompt : text.prepPrompt.slice(0, typed);
  const days = [
    ['prepMon', 'prepDay1'],
    ['prepTue', 'prepDay2'],
    ['prepWed', 'prepDay3'],
    ['prepThu', 'prepDay4'],
    ['prepFri', 'prepDay5'],
  ] as const;
  const makes = ['prepSlides', 'prepWorksheets', 'prepQuiz', 'prepEmail'] as const;

  return (
    <div ref={root}>
      <div className="demo-tabs" role="tablist" aria-label={text.demoLabel}>
        {tabs.map((id, index) => (
          <button
            key={id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`demo-tab-${id}`}
            aria-controls={`demo-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            className="demo-tab"
            onClick={() => {
              start(id);
            }}
            onKeyDown={(event) => {
              onKey(event, index);
            }}
          >
            {text[tabLabel[id]]}
          </button>
        ))}
      </div>

      <div className="demo-stage">
        <div className="demo-side">
          <h3>{text[side[tab][0]]}</h3>
          <p>{text[side[tab][1]]}</p>
          <p className="demo-rule">{text[side[tab][2]]}</p>
          <button
            type="button"
            className="demo-replay"
            onClick={() => {
              start(tab);
            }}
          >
            {text.replay}
          </button>
        </div>

        <div
          key={`${tab}-${String(play)}`}
          className={`demo-main${animated}`}
          role="tabpanel"
          id={`demo-panel-${tab}`}
          aria-labelledby={`demo-tab-${tab}`}
        >
          {tab === 'prep' ? (
            <>
              <p className="demo-prompt">
                <span>{prompt}</span>
                {typed === null ? null : <span className="demo-caret" aria-hidden="true" />}
              </p>
              <ol className="demo-week">
                {days.map(([day, topic], i) => (
                  <li key={day} className="demo-enter" style={order(i + 2)}>
                    <b>{text[day]}</b>
                    <span>{text[topic]}</span>
                  </li>
                ))}
              </ol>
              <ul className="demo-makes">
                {makes.map((make, i) => (
                  <li key={make} className="demo-enter" style={order(i + 7)}>
                    <span>{text[make]}</span>
                    <span className={approved ? 'demo-chip ok' : 'demo-chip'}>
                      {approved ? text.approved : text.draft}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="demo-approve">
                <p aria-live="polite">{approved ? text.prepDone : text.prepReview}</p>
                <button
                  type="button"
                  className="button accent"
                  disabled={approved}
                  onClick={() => {
                    setApproved(true);
                  }}
                >
                  {text.prepApprove}
                </button>
              </div>
            </>
          ) : null}

          {tab === 'grade' ? (
            <div className="demo-grade">
              <div className="demo-card">
                <p className="demo-label">{text.gradeQuestionLabel}</p>
                <p className="demo-question">{text.gradeQuestion}</p>
                <p className="demo-label">{text.gradeAnswerLabel}</p>
                <p>{text.gradeAnswer}</p>
              </div>
              <div className="demo-card demo-enter" style={order(1)}>
                <p className="demo-label">{text.gradeSuggestion}</p>
                <p className="demo-score">
                  <b>{grade === 'changed' ? changedScore : keptScore}</b> / 10
                </p>
                <ul className="demo-reasons">
                  <li>{text.gradeReason1}</li>
                  <li>{text.gradeReason2}</li>
                  <li>{text.gradeReason3}</li>
                </ul>
                <p className="demo-actions">
                  <button
                    type="button"
                    className="button accent"
                    onClick={() => {
                      setGrade('kept');
                    }}
                  >
                    {text.gradeKeep}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setGrade('changed');
                    }}
                  >
                    {text.gradeChange}
                  </button>
                </p>
                <p className="demo-stamp" aria-live="polite">
                  {grade === 'kept' ? text.gradeKept : grade === 'changed' ? text.gradeChanged : ''}
                </p>
              </div>
            </div>
          ) : null}

          {tab === 'game' ? (
            <div className="demo-game">
              <div className="demo-card demo-pin">
                <p className="demo-label">{text.gameJoin}</p>
                <p className="demo-pin-code">482 913</p>
                <ul className="demo-players">
                  {players.map((name, i) => (
                    <li key={name} className="demo-pop" style={order(i)}>
                      {name}
                    </li>
                  ))}
                </ul>
                <ul className="demo-board">
                  {teams.map(({ key, score }) => (
                    <li key={key}>
                      <span>{text[key]}</span>
                      <span className="demo-track" aria-hidden="true">
                        <span
                          className="demo-fill"
                          style={{ '--w': `${String(score / 10)}%` } as CSSProperties}
                        />
                      </span>
                      <b>{score}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="demo-phone">
                <p>{text.gameQuestion}</p>
                <ul>
                  <li>2/3</li>
                  <li>3/5</li>
                  <li>{text.gameEqual}</li>
                  <li>{text.gameUnsure}</li>
                </ul>
              </div>
            </div>
          ) : null}

          {tab === 'family' ? (
            <div className="demo-family">
              <div className="demo-card">
                <p className="demo-label">{text.familyPortal}</p>
                <ul className="demo-grades">
                  <li className="demo-enter" style={order(1)}>
                    <span>{text.familyQuiz}</span>
                    <b>9 / 10</b>
                  </li>
                  <li className="demo-enter" style={order(2)}>
                    <span>{text.familyReading}</span>
                    <b>A</b>
                  </li>
                  <li className="demo-enter" style={order(3)}>
                    <span>{text.familyScience}</span>
                    <b>18 / 20</b>
                  </li>
                  <li className="demo-enter demo-hidden-grade" style={order(4)}>
                    <span>{text.familyTest}</span>
                    <span>{text.familyHidden}</span>
                  </li>
                </ul>
              </div>
              <div className="demo-card demo-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="demo-ring-bg" cx="60" cy="60" r="52" />
                  <circle className="demo-ring-fg" cx="60" cy="60" r="52" />
                </svg>
                <p>
                  <b>96%</b>
                  <span>{text.familyAttendance}</span>
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <p className="demo-note">{text.sampleNote}</p>
    </div>
  );
}
