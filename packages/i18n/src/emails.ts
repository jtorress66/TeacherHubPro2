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
  readonly button: { readonly label: string; readonly url: string } | null;
  readonly footer: readonly string[];
  /** Ends with the team's signature beside the logo. */
  readonly signed: boolean;
  /** The site's address, for the logo and the link; empty where none is configured. */
  readonly site: string;
}

const brandName = 'TeacherHubPro';
const muted = 'font-size:14px;color:#475569';

const logo = (site: string, size: number): string =>
  site === ''
    ? ''
    : `<img src="${escapeHtml(site)}/brand/logo-mark.png" width="${String(size)}" height="${String(size)}" alt="${brandName}" style="display:block;border:0;border-radius:8px">`;

const siteLink = (site: string): string =>
  site === ''
    ? ''
    : `<a href="${escapeHtml(site)}" style="color:#1d4ed8;text-decoration:none">${escapeHtml(new URL(site).host)}</a>`;

/** The logo and name above every email. */
const header = (site: string): string =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>${
    site === '' ? '' : `<td style="padding-right:10px">${logo(site, 40)}</td>`
  }<td style="font-size:20px;font-weight:bold;color:#1d4ed8">${brandName}</td></tr></table>`;

/** The team's signature with the logo to its left, and the site underneath. */
function signature(text: string, site: string): string {
  const link = siteLink(site);
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr>${
    site === '' ? '' : `<td style="padding-right:10px;vertical-align:middle">${logo(site, 32)}</td>`
  }<td style="${muted};vertical-align:middle">${escapeHtml(text)}${link === '' ? '' : `<br>${link}`}</td></tr></table>`;
}

/** The button and the link spelled out, for emails that have one. */
function buttonHtml(button: Layout['button']): string[] {
  if (button === null) return [];
  const url = escapeHtml(button.url);
  return [
    `<p style="margin:24px 0"><a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(button.label)}</a></p>`,
    `<p style="margin:0 0 16px;font-size:14px;color:#475569;word-break:break-all">${url}</p>`,
  ];
}

/** One simple, accessible layout for every email: the brand, text, an optional button, and a footer. */
function render(layout: Layout): EmailContent {
  const { locale, subject, paragraphs, button, footer, signed, site } = layout;
  const t = createTranslator(locale);
  const p = (text: string) =>
    `<p style="margin:0 0 16px">${escapeHtml(text).replace(/\n/gu, '<br>')}</p>`;
  const link = siteLink(site);
  const html = [
    `<!doctype html><html lang="${locale}"><body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">`,
    header(site),
    ...paragraphs.map(p),
    ...buttonHtml(button),
    '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 16px">',
    ...footer.map((line) => `<p style="margin:0 0 8px;${muted}">${escapeHtml(line)}</p>`),
    ...(signed
      ? [signature(t('emails.signature'), site)]
      : link === ''
        ? []
        : [`<p style="margin:0;${muted}">${link}</p>`]),
    '</body></html>',
  ].join('\n');
  const buttonText = button === null ? [] : ['', `${button.label}: ${button.url}`];
  const closing = [
    ...footer,
    ...(signed ? [t('emails.signature')] : []),
    ...(site === '' ? [] : [site]),
  ];
  const text = [paragraphs.join('\n\n'), ...buttonText, '', ...closing].join('\n');
  return { subject, html, text };
}

export interface PortalLinkEmailInput {
  readonly language: Locale;
  readonly firstName: string;
  readonly schoolName: string;
  readonly className: string;
  /** The full portal address, on the configured site. */
  readonly url: string;
}

/** Sends a family their read-only portal link. */
export function portalLinkEmail(input: PortalLinkEmailInput, site = ''): EmailContent {
  const t = createTranslator(input.language);
  const names = { name: input.firstName, school: input.schoolName, className: input.className };
  return render({
    locale: input.language,
    subject: t('emails.portalSubject', names),
    paragraphs: [t('emails.portalHello'), t('emails.portalBody', names)],
    button: { label: t('emails.portalButton'), url: input.url },
    footer: [t('emails.portalReadOnly')],
    signed: true,
    site,
  });
}

export interface TrialReminderEmailInput {
  readonly language: Locale;
  readonly name: string;
  readonly daysLeft: number;
  readonly billingUrl: string;
}

/** Tells the account owner their trial is ending, with a link to choose a plan. */
export function trialReminderEmail(input: TrialReminderEmailInput, site = ''): EmailContent {
  const t = createTranslator(input.language);
  const lastDay = input.daysLeft <= 1;
  const days = { days: input.daysLeft };
  return render({
    locale: input.language,
    subject: lastDay ? t('emails.trialSubjectLastDay') : t('emails.trialSubject', days),
    paragraphs: [
      t('emails.trialHello', { name: input.name }),
      lastDay ? t('emails.trialBodyLastDay') : t('emails.trialBody', days),
    ],
    button: { label: t('emails.trialButton'), url: input.billingUrl },
    footer: [],
    signed: true,
    site,
  });
}

export interface WeeklyUpdateEmailInput {
  readonly language: Locale;
  readonly subject: string;
  /** The teacher's approved text; blank lines separate paragraphs. */
  readonly body: string;
  readonly schoolName: string;
}

/** The teacher's weekly update to families, sent as they approved it. */
export function weeklyUpdateEmail(input: WeeklyUpdateEmailInput, site = ''): EmailContent {
  const t = createTranslator(input.language);
  return render({
    locale: input.language,
    subject: input.subject,
    paragraphs: input.body.split(/\n\s*\n/u).map((block) => block.trim()),
    button: null,
    footer: [t('emails.weeklySentBy', { school: input.schoolName })],
    signed: false,
    site,
  });
}

export interface SetPasswordEmailInput {
  readonly language: Locale;
  readonly name: string;
  /** The one-time link, with its secret in the #hash. */
  readonly url: string;
  readonly purpose: 'welcome' | 'reset';
}

/** A one-time link to choose a password: for a new account, or a reset the person asked for. */
export function setPasswordEmail(input: SetPasswordEmailInput, site = ''): EmailContent {
  const t = createTranslator(input.language);
  const welcome = input.purpose === 'welcome';
  return render({
    locale: input.language,
    subject: welcome ? t('emails.welcomeSubject') : t('emails.resetSubject'),
    paragraphs: [
      t('emails.trialHello', { name: input.name }),
      welcome ? t('emails.welcomeBody') : t('emails.resetBody'),
    ],
    button: {
      label: welcome ? t('emails.welcomeButton') : t('emails.resetButton'),
      url: input.url,
    },
    footer: [t('emails.passwordLinkExpires')],
    signed: true,
    site,
  });
}

export interface ConfirmEmailInput {
  readonly language: Locale;
  readonly name: string;
  /** The one-time link, with its secret in the #hash. */
  readonly url: string;
}

/** A one-time link to confirm a new account's email address; the AI tools wait for it. */
export function confirmEmailEmail(input: ConfirmEmailInput, site = ''): EmailContent {
  const t = createTranslator(input.language);
  return render({
    locale: input.language,
    subject: t('emails.confirmSubject'),
    paragraphs: [t('emails.trialHello', { name: input.name }), t('emails.confirmBody')],
    button: { label: t('emails.confirmButton'), url: input.url },
    footer: [t('emails.passwordLinkExpires')],
    signed: true,
    site,
  });
}

export interface LeadNoticeInput {
  readonly lead: {
    readonly name: string;
    readonly email: string;
    readonly organization: string | null;
    readonly role: string;
    readonly phone: string | null;
    readonly interest: string;
    readonly source: string;
    readonly message: string | null;
    readonly page: string | null;
    readonly score: string;
  };
}

/** Tells the TeacherHubPro team about a high-priority lead, in English. */
export function leadNoticeEmail({ lead }: LeadNoticeInput, site = ''): EmailContent {
  const t = createTranslator('en');
  const lines = [
    `${t('emails.leadName')}: ${lead.name}`,
    `${t('emails.leadEmail')}: ${lead.email}`,
    `${t('emails.leadOrganization')}: ${lead.organization ?? '-'}`,
    `${t('emails.leadRole')}: ${lead.role}`,
    `${t('emails.leadPhone')}: ${lead.phone ?? '-'}`,
    `${t('emails.leadInterest')}: ${lead.interest}`,
    `${t('emails.leadSource')}: ${lead.source} · ${lead.page ?? '-'}`,
  ];
  return render({
    locale: 'en',
    subject: t('emails.leadSubject', { name: lead.name, score: lead.score }),
    paragraphs: [lines.join('\n'), ...(lead.message === null ? [] : [lead.message])],
    button: null,
    footer: [],
    signed: true,
    site,
  });
}

/** Every email, branded with the logo and a link to `site` (the app's address, or '' for none). */
export function emailTemplates(site: string) {
  return {
    portalLink: (input: PortalLinkEmailInput) => portalLinkEmail(input, site),
    trialReminder: (input: TrialReminderEmailInput) => trialReminderEmail(input, site),
    weeklyUpdate: (input: WeeklyUpdateEmailInput) => weeklyUpdateEmail(input, site),
    setPassword: (input: SetPasswordEmailInput) => setPasswordEmail(input, site),
    confirmEmail: (input: ConfirmEmailInput) => confirmEmailEmail(input, site),
    leadNotice: (input: LeadNoticeInput) => leadNoticeEmail(input, site),
  };
}
