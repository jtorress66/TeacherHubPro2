import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAppContainer } from '../../../container.ts';
import {
  readTestLmsPlaced,
  testLmsLoginHint,
  testLmsMessageHint,
  type TestLmsMessage,
  type TestLmsRole,
} from '../../../server/test-lms.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Test LMS',
  robots: { index: false, follow: false },
};

/** A value a client ID or user ID may take here: letters, digits, dots, dashes, underscores. */
const safe = (value: string | undefined): string | null =>
  value !== undefined && /^[\w.-]{1,64}$/u.test(value) ? value : null;

/**
 * A pretend course system (LTI_PROVIDER=local, development and tests only): the values a school
 * admin registers, and buttons that launch TeacherHubPro as a teacher or a student, the way
 * Canvas or Moodle would. A teacher can also add TeacherHubPro content (deep linking); the links
 * placed come back in the address, each with buttons to open it. Developer tooling, so it is not
 * translated.
 */
export default async function TestLmsPage(
  props: LocaleParams & {
    readonly searchParams: Promise<{
      client?: string;
      teacher?: string;
      student?: string;
      placed?: string;
    }>;
  },
) {
  const locale = await localeFrom(props);
  const app = getAppContainer();
  const testLms = app.lti?.testLms ?? null;
  if (testLms === null) notFound();
  const search = await props.searchParams;
  const clientId = safe(search.client) ?? `test-client-${app.tokens.generate().slice(0, 12)}`;
  const users: Readonly<Record<TestLmsRole, string>> = {
    teacher: safe(search.teacher) ?? 'teacher-1',
    learner: safe(search.student) ?? 'student-1',
  };
  const values = [
    ['Issuer', testLms.issuer],
    ['Client ID', clientId],
    ['Deployment ID', testLms.deploymentId],
    ['Authorization URL', `${app.appUrl}/api/test-lms/authorize`],
    ['Token URL', `${app.appUrl}/api/test-lms/token`],
    ['Keyset URL', testLms.jwksUrl],
  ] as const;
  const placed = readTestLmsPlaced(search.placed);
  const plain: TestLmsMessage = { locale, deepLinking: false, custom: null };
  const launch = (role: TestLmsRole, label: string, message: TestLmsMessage = plain) => (
    <form method="post" action="/api/lti/login">
      <input type="hidden" name="iss" value={testLms.issuer} />
      <input type="hidden" name="login_hint" value={testLmsLoginHint(role, users[role])} />
      <input type="hidden" name="target_link_uri" value={`${app.appUrl}/api/lti/launch`} />
      <input type="hidden" name="lti_message_hint" value={testLmsMessageHint(message)} />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="lti_deployment_id" value={testLms.deploymentId} />
      <button type="submit" className="button">
        {label}
      </button>
    </form>
  );

  return (
    <main className="student-page stack">
      <h1>Test LMS</h1>
      <section className="card stack" aria-labelledby="test-lms-values">
        <h2 id="test-lms-values">Values to register</h2>
        <dl>
          {values.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd data-testid={label}>{value}</dd>
            </div>
          ))}
        </dl>
        <p>
          <a href={`/${locale}/test-lms?client=${clientId}`}>This test course</a>
        </p>
      </section>
      <section className="card stack" aria-labelledby="test-lms-launch">
        <h2 id="test-lms-launch">Open TeacherHubPro</h2>
        <div className="button-row">
          {launch('teacher', 'Launch as teacher')}
          {launch('learner', 'Launch as student')}
          {launch('teacher', 'Add TeacherHubPro content', { ...plain, deepLinking: true })}
        </div>
      </section>
      <section className="card stack" aria-labelledby="test-lms-placed">
        <h2 id="test-lms-placed">In this course</h2>
        {placed.length === 0 ? <p>Nothing placed yet.</p> : null}
        <ul className="stack">
          {placed.map((link, index) => (
            <li key={index} className="stack">
              <strong>{link.title}</strong>
              <div className="button-row">
                {launch('teacher', `Open ${link.title} as teacher`, {
                  ...plain,
                  custom: link.custom,
                })}
                {launch('learner', `Open ${link.title} as student`, {
                  ...plain,
                  custom: link.custom,
                })}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
