export const browserKeys = [
  'chrome',
  'edge',
  'firefox',
  'safari',
  'samsung',
  'opera',
  'unknown',
] as const;
export type BrowserKey = (typeof browserKeys)[number];

export const osKeys = [
  'windows',
  'macos',
  'iphone',
  'ipad',
  'android',
  'chromeos',
  'linux',
  'unknown',
] as const;
export type OsKey = (typeof osKeys)[number];

/**
 * A coarse description of a signed-in browser, such as "Chrome on Windows", to warn about another
 * device. Only these two keys are kept: never the user agent itself, and never an IP address.
 */
export interface DeviceKeys {
  readonly browser: BrowserKey;
  readonly os: OsKey;
}

export const isBrowserKey = (value: unknown): value is BrowserKey =>
  (browserKeys as readonly unknown[]).includes(value);

export const isOsKey = (value: unknown): value is OsKey =>
  (osKeys as readonly unknown[]).includes(value);

/** Checked in order: Edge, Opera and Samsung also say "Chrome", and almost everything says "Safari". */
const browserPatterns: readonly (readonly [RegExp, BrowserKey])[] = [
  [/SamsungBrowser\//u, 'samsung'],
  [/\bEdg(?:e|A|iOS)?\//u, 'edge'],
  [/\bOPR\/|\bOpera\b/u, 'opera'],
  [/\bFirefox\/|\bFxiOS\//u, 'firefox'],
  [/\b(?:Headless)?Chrome\/|\bCriOS\/|\bChromium\//u, 'chrome'],
  [/\bVersion\/[\d.]+.*\bSafari\//u, 'safari'],
];

/** iPad and iPhone before the Mac (they say "like Mac OS X"), Android and ChromeOS before Linux. */
const osPatterns: readonly (readonly [RegExp, OsKey])[] = [
  [/\biPad\b/u, 'ipad'],
  [/\biPhone\b|\biPod\b/u, 'iphone'],
  [/\bAndroid\b/u, 'android'],
  [/\bCrOS\b/u, 'chromeos'],
  [/\bWindows\b/u, 'windows'],
  [/\bMacintosh\b|\bMac OS X\b/u, 'macos'],
  [/\bLinux\b|\bX11\b/u, 'linux'],
];

const firstMatch = <K extends string>(
  agent: string,
  patterns: readonly (readonly [RegExp, K])[],
): K | 'unknown' => patterns.find(([pattern]) => pattern.test(agent))?.[1] ?? 'unknown';

/** The browser and system a user agent names; "unknown" for what it cannot tell. */
export function deviceFromUserAgent(userAgent: string | null): DeviceKeys {
  const agent = userAgent ?? '';
  return { browser: firstMatch(agent, browserPatterns), os: firstMatch(agent, osPatterns) };
}
