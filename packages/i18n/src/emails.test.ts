import { describe, expect, it } from 'vitest';
import { portalLinkEmail, trialReminderEmail } from './emails.ts';

describe('portalLinkEmail', () => {
  const input = {
    locale: 'es' as const,
    firstName: 'Ana',
    schoolName: 'Escuela <Luna>',
    className: 'Historia 6',
    url: 'https://teacherhubpro-web.onrender.com/es/p/abc123',
  };

  it('writes the email in the parent’s language, with the configured site link', () => {
    const mail = portalLinkEmail(input);
    expect(mail.subject).toBe('Progreso de Ana en Escuela <Luna>');
    expect(mail.text).toContain(input.url);
    expect(mail.text).toContain('Historia 6');
    expect(mail.html).toContain(`href="${input.url}"`);
    expect(mail.text).toMatch(/solo lectura/u);
  });

  it('escapes names in the HTML', () => {
    expect(portalLinkEmail(input).html).toContain('Escuela &lt;Luna&gt;');
    expect(portalLinkEmail(input).html).not.toContain('<Luna>');
  });

  it('falls back to English for a language without the strings', () => {
    expect(portalLinkEmail({ ...input, locale: 'de' }).subject).toBe(
      'Ana’s progress at Escuela <Luna>',
    );
  });
});

describe('trialReminderEmail', () => {
  it('says how many days are left and links to billing', () => {
    const mail = trialReminderEmail({
      locale: 'en',
      name: 'Juan',
      daysLeft: 3,
      billingUrl: 'https://app.test/en/app/billing',
    });
    expect(mail.subject).toBe('Your TeacherHubPro trial ends in 3 days');
    expect(mail.text).toContain('Hi Juan,');
    expect(mail.html).toContain('href="https://app.test/en/app/billing"');
  });

  it('has a last-day wording', () => {
    expect(
      trialReminderEmail({ locale: 'es', name: 'Juan', daysLeft: 1, billingUrl: 'https://x' })
        .subject,
    ).toBe('Su prueba de TeacherHubPro termina hoy');
  });
});
