// Small illustrations for the home page drawing: a lesson plan, an elementary class and a parent
// portal. Colors come from the theme (light and dark); motion is in theme.css. Decorative only.

const svgProps = {
  viewBox: '0 0 160 90',
  preserveAspectRatio: 'xMidYMid meet',
  focusable: 'false',
  'aria-hidden': true,
} as const;

/** A lesson plan page: a header, a calendar tab and a checklist whose checks draw themselves. */
export function LessonPlanIllustration() {
  return (
    <svg {...svgProps} className="ill ill-plan">
      <rect className="ill-paper" x="38" y="8" width="84" height="76" rx="7" />
      <rect className="ill-accent" x="38" y="8" width="84" height="15" rx="7" />
      <rect className="ill-accent" x="38" y="16" width="84" height="7" />
      <rect className="ill-paper-soft" x="47" y="12" width="22" height="5" rx="2.5" />
      <rect className="ill-green" x="104" y="4" width="10" height="12" rx="2" />
      {[33, 48, 63].map((y, i) => (
        <g key={y}>
          <rect className="ill-box" x="48" y={y - 5} width="10" height="10" rx="2.5" />
          {i < 2 ? (
            <path
              className="ill-check"
              d={`M50 ${String(y)}l2.5 2.5 4.5-5`}
              style={{ animationDelay: `${String(i * 0.5)}s` }}
            />
          ) : null}
          <rect
            className="ill-line"
            x="63"
            y={y - 2.5}
            width={[46, 38, 50][i] ?? 40}
            height="5"
            rx="2.5"
          />
        </g>
      ))}
    </svg>
  );
}

/** An elementary class: a chalkboard, an apple on the desk and three children. */
export function ClassroomIllustration() {
  const kids = [
    { x: 46, shirt: 'ill-accent', delay: 0 },
    { x: 80, shirt: 'ill-green', delay: 0.4 },
    { x: 114, shirt: 'ill-amber', delay: 0.8 },
  ];
  return (
    <svg {...svgProps} className="ill ill-class">
      <rect className="ill-board" x="30" y="6" width="100" height="38" rx="4" />
      <rect className="ill-board-frame" x="30" y="40" width="100" height="5" rx="2" />
      <path className="ill-chalk" d="M42 18q8-8 16 0t16 0M42 30h28M88 16l8 12 8-12M110 18h10" />
      {kids.map((kid) => (
        <g key={kid.x} className="ill-kid" style={{ animationDelay: `${String(kid.delay)}s` }}>
          <circle className="ill-skin" cx={kid.x} cy="58" r="7" />
          <path className="ill-hair" d={`M${String(kid.x - 7)} 57a7 7 0 0 1 14 0q-7-5-14 0z`} />
          <rect className={kid.shirt} x={kid.x - 9} y="66" width="18" height="14" rx="6" />
        </g>
      ))}
      <rect className="ill-desk" x="22" y="78" width="116" height="7" rx="3" />
      <circle className="ill-apple" cx="132" cy="72" r="5" />
      <path className="ill-leaf" d="M132 67q2-4 5-3-1 3-5 3z" />
    </svg>
  );
}

/** A parent portal: a small screen with a parent, their child and a growing progress chart. */
export function ParentPortalIllustration() {
  return (
    <svg {...svgProps} className="ill ill-portal">
      <rect className="ill-paper" x="22" y="8" width="116" height="74" rx="7" />
      <rect className="ill-paper-soft" x="22" y="8" width="116" height="12" rx="7" />
      <rect className="ill-paper-soft" x="22" y="14" width="116" height="6" />
      <circle className="ill-dot" cx="31" cy="14" r="2" />
      <circle className="ill-dot" cx="38" cy="14" r="2" />
      <circle className="ill-skin" cx="46" cy="40" r="9" />
      <rect className="ill-accent" x="34" y="50" width="24" height="20" rx="8" />
      <circle className="ill-skin" cx="66" cy="50" r="6" />
      <rect className="ill-green" x="58" y="57" width="16" height="13" rx="6" />
      {[
        { x: 88, h: 18 },
        { x: 100, h: 28 },
        { x: 112, h: 38 },
      ].map((bar, i) => (
        <rect
          key={bar.x}
          className={i === 2 ? 'ill-bar ill-green' : 'ill-bar ill-accent'}
          x={bar.x}
          y={72 - bar.h}
          width="8"
          height={bar.h}
          rx="2"
          style={{ animationDelay: `${String(i * 0.25)}s` }}
        />
      ))}
      <path
        className="ill-star"
        d="M125 30l2 4 4.5.6-3.3 3.1.8 4.4-4-2.1-4 2.1.8-4.4-3.3-3.1 4.5-.6z"
      />
    </svg>
  );
}
