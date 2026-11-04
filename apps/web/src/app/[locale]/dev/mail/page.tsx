import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAppContainer } from '../../../../container.ts';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Development mail',
  robots: { index: false, follow: false },
};

/**
 * What the stand-in mailer "sent", newest first: development and tests only (there is no such
 * page in production). Developer tooling, so it is not translated.
 */
export default async function DevMailPage() {
  const mailbox = getAppContainer().sentMailbox;
  if (mailbox === null) notFound();
  const sent = await mailbox.list(50);
  return (
    <main className="student-page stack">
      <h1>Development mail</h1>
      {sent.length === 0 ? <p>No mail yet.</p> : null}
      {sent.map((mail) => (
        <article key={mail.id} className="card stack" aria-label={mail.subject}>
          <h2>{mail.subject}</h2>
          <p className="muted small">
            To {mail.to} · {mail.sentAt.toISOString()}
          </p>
          <pre className="mail-text">{mail.text}</pre>
        </article>
      ))}
    </main>
  );
}
