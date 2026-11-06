import type { Language, Lead } from '@thp/domain';

export interface MailContent {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

/** The wording of each email, in a language; the texts live with the other translations. */
export interface MailTemplates {
  portalLink(input: {
    readonly language: Language;
    readonly firstName: string;
    readonly schoolName: string;
    readonly className: string;
    readonly url: string;
  }): MailContent;
  trialReminder(input: {
    readonly language: Language;
    readonly name: string;
    readonly daysLeft: number;
    readonly billingUrl: string;
  }): MailContent;
  /** A one-time link to choose a password: for a new account, or a reset. */
  setPassword(input: {
    readonly language: Language;
    readonly name: string;
    readonly url: string;
    readonly purpose: 'welcome' | 'reset';
  }): MailContent;
  /** Tells the team about a high-priority lead from the website. */
  leadNotice(input: { readonly lead: Lead }): MailContent;
  /** The teacher's approved weekly update, as they wrote it. */
  weeklyUpdate(input: {
    readonly language: Language;
    readonly subject: string;
    readonly body: string;
    readonly schoolName: string;
  }): MailContent;
}

/** What the local stand-in mailer kept, newest first: for reading mail in development only. */
export interface SentMail {
  readonly id: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly sentAt: Date;
}

export interface SentMailbox {
  list(limit: number): Promise<readonly SentMail[]>;
}
