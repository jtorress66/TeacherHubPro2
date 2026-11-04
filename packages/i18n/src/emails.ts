import type { Locale } from './locales.ts';
import { createTranslator } from './translator.ts';

/** An email's content: a subject, an HTML body and the same in plain text. */
export interface EmailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');

interface Layout {
  readonly locale: Locale;
  readonly subject: string;
  readonly paragraphs: readonly string[];
  readonly button: { readonly label: string; readonly url: string };
  readonly footer: readonly string[];
}

/** One simple, accessible layout for every email: text, a button, and the link spelled out. */
function render({ locale, subject, paragraphs, button, footer }: Layout): EmailContent {
  const p = (text: string) => `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
  const url = escapeHtml(button.url);
  const html = [
    `<!doctype html><html lang="${locale}"><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">`,
    ...paragraphs.map(p),
    `<p style="margin:24px 0"><a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(button.label)}</a></p>`,
    `<p style="margin:0 0 16px;font-size:14px;color:#475569;word-break:break-all">${url}</p>`,
    ...footer.map(
      (line) => `<p style="margin:0 0 8px;font-size:14px;color:#475569">${escapeHtml(line)}</p>`,
    ),
    '</body></html>',
  ].join('\n');
  const text = [...paragraphs, '', `${button.label}: ${button.url}`, '', ...footer].join('\n');
  return { subject, html, text };
}

export interface PortalLinkEmailInput {
  readonly locale: Locale;
  readonly firstName: string;
  readonly schoolName: string;
  readonly className: string;
  /** The full portal address, on the configured site. */
  readonly url: string;
}

/** Sends a family their read-only portal link. */
export function portalLinkEmail(input: PortalLinkEmailInput): EmailContent {
  const t = createTranslator(input.locale);
  const names = { name: input.firstName, school: input.schoolName, className: input.className };
  return render({
    locale: input.locale,
    subject: t('emails.portalSubject', names),
    paragraphs: [t('emails.portalHello'), t('emails.portalBody', names)],
    button: { label: t('emails.portalButton'), url: input.url },
    footer: [t('emails.portalReadOnly'), t('emails.signature')],
  });
}

export interface TrialReminderEmailInput {
  readonly locale: Locale;
  readonly name: string;
  readonly daysLeft: number;
  readonly billingUrl: string;
}

/** Tells the account owner their trial is ending, with a link to choose a plan. */
export function trialReminderEmail(input: TrialReminderEmailInput): EmailContent {
  const t = createTranslator(input.locale);
  const lastDay = input.daysLeft <= 1;
  const days = { days: input.daysLeft };
  return render({
    locale: input.locale,
    subject: lastDay ? t('emails.trialSubjectLastDay') : t('emails.trialSubject', days),
    paragraphs: [
      t('emails.trialHello', { name: input.name }),
      lastDay ? t('emails.trialBodyLastDay') : t('emails.trialBody', days),
    ],
    button: { label: t('emails.trialButton'), url: input.billingUrl },
    footer: [t('emails.signature')],
  });
}
