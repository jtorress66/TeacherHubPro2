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
