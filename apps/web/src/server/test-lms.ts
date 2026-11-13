import { z } from 'zod';

/**
 * The pretend course system (LTI_PROVIDER=local, development and tests only). Developer tooling,
 * so its text is not translated.
 */

export type TestLmsRole = 'teacher' | 'learner';

/** The login hint the pretend course system sends: who is launching, and as what. */
export const testLmsLoginHint = (role: TestLmsRole, subject: string): string =>
  `${role}:${subject}`;

export function readTestLmsLoginHint(
  hint: string | null,
): { readonly role: TestLmsRole; readonly subject: string } | null {
  const separator = hint?.indexOf(':') ?? -1;
  if (hint === null || separator < 0) return null;
  const role = hint.slice(0, separator);
  const subject = hint.slice(separator + 1);
  if ((role !== 'teacher' && role !== 'learner') || subject === '') return null;
  return { role, subject };
}

const escape = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/** A page that posts the fields to the address at once, as a course system's form_post does. */
export function autoPostPage(action: string, fields: Readonly<Record<string, string>>): string {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`)
    .join('');
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Test LMS</title></head>',
    `<body><form method="post" action="${escape(action)}">${inputs}`,
    '<noscript><button type="submit">Continue</button></noscript></form>',
    '<script>document.forms[0].submit()</script></body></html>',
  ].join('');
}

/** The fields of a client credentials request to the pretend course system's token address. */
export function readServiceTokenRequest(form: URLSearchParams | FormData) {
  const field = (name: string): string | null => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };
  return {
    grantType: field('grant_type'),
    clientAssertionType: field('client_assertion_type'),
    clientAssertion: field('client_assertion'),
    scope: field('scope'),
  };
}

/** The value the pretend course system sends with "Add content" and expects back unchanged. */
export const testLmsDeepLinkingData = 'test-lms-course';

/** What a launch from the pretend course system is for, as its message hint carries it. */
export interface TestLmsMessage {
  /** The test page's language, passed on as the course system's. */
  readonly locale: string | null;
  /** A deep linking request ("Add content") in place of a resource link launch. */
  readonly deepLinking: boolean;
  /** The custom parameters of the placed link launched, if any. */
  readonly custom: Readonly<Record<string, string>> | null;
}

const message = z.object({
  locale: z.string().nullable(),
  deepLinking: z.boolean(),
  custom: z.record(z.string(), z.string()).nullable(),
});

const fromBase64Json = (value: string): unknown => {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const toBase64Json = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export const testLmsMessageHint = (value: TestLmsMessage): string => toBase64Json(value);

export function readTestLmsMessageHint(hint: string | null): TestLmsMessage {
  const parsed = message.safeParse(hint === null ? null : fromBase64Json(hint));
  return parsed.success ? parsed.data : { locale: null, deepLinking: false, custom: null };
}

/** A link TeacherHubPro placed in the test course. */
export interface TestLmsPlacedLink {
  readonly title: string;
  readonly custom: Readonly<Record<string, string>>;
}

const placedLinks = z.array(
  z.object({ title: z.string(), custom: z.record(z.string(), z.string()) }),
);

/** The placed links, as one address value: the pretend course keeps no state of its own. */
export const testLmsPlaced = (links: readonly TestLmsPlacedLink[]): string => toBase64Json(links);

export function readTestLmsPlaced(value: string | undefined): readonly TestLmsPlacedLink[] {
  const parsed = placedLinks.safeParse(value === undefined ? null : fromBase64Json(value));
  return parsed.success ? parsed.data : [];
}
