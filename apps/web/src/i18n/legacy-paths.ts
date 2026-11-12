// The old app's addresses, so bookmarks and search results still land somewhere useful after
// teacherhubpro.com moves to this app. Old student and parent links are dead (everyone starts
// fresh), so they go home; the teacher sends new ones.

/** An old path (exact) or an old path and everything under it (ending in `/*`). */
const legacyPaths: readonly (readonly [string, string])[] = [
  ['/dashboard', '/app'],
  ['/planner/*', '/app/plans'],
  ['/substitute-packet', '/app/plans'],
  ['/ai-assistant', '/app/assistant'],
  ['/adaptive-learning', '/app/learning'],
  ['/attendance/*', '/app/attendance'],
  ['/gradebook/*', '/app/gradebook'],
  ['/classes/*', '/app/classes'],
  ['/students/*', '/app/classes'],
  ['/student-progress/*', '/app/classes'],
  ['/report-cards', '/app/classes'],
  ['/games', '/app/games'],
  ['/play-to-learn/game/*', '/play'],
  ['/play-game/*', '/play'],
  ['/play-to-learn', '/features'],
  ['/teacher/play-to-learn/*', '/app/live'],
  ['/presentations', '/app/presentations'],
  ['/prep-agent', '/app/prep'],
  ['/templates', '/app/templates'],
  ['/settings', '/app/settings'],
  ['/admin', '/app/admin'],
  ['/leads', '/app/super-admin'],
  ['/subscription/success', '/app/billing'],
  ['/auth', '/login'],
  ['/auth/callback', '/login'],
  ['/setup-admin', '/setup'],
  ['/privacy-policy', '/privacy'],
  ['/terms-of-use', '/terms'],
  ['/cookies-policy', '/cookies'],
  ['/ai-features', '/ai'],
  ['/ai-grading', '/ai'],
  ['/enterprise-overview', '/enterprise'],
  ...[
    '/soc2',
    '/gdpr',
    '/dpa',
    '/sla',
    '/breach-policy',
    '/business-continuity',
    '/incident-response',
    '/security-whitepaper',
    '/vendor-management',
  ].map((path) => [path, '/trust'] as const),
  ...['/assignment', '/portal', '/homeschool-portal', '/student-learning'].map(
    (path) => [`${path}/*`, '/'] as const,
  ),
];

const matches = (pattern: string, path: string): boolean => {
  if (!pattern.endsWith('/*')) return path === pattern;
  const base = pattern.slice(0, -2);
  return path === base || path.startsWith(`${base}/`);
};

/** Where an old app address lives now (without a language), or null when it did not move. */
export function currentPathFor(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return legacyPaths.find(([pattern]) => matches(pattern, path))?.[1] ?? null;
}
