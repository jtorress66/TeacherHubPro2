import { describe, expect, it } from 'vitest';
import {
  portalLinkEmail,
  setPasswordEmail,
  trialReminderEmail,
  weeklyUpdateEmail,
} from './emails.ts';

describe('portalLinkEmail', () => {
  const input = {
    language: 'es' as const,
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
    expect(portalLinkEmail({ ...input, language: 'de' }).subject).toBe(
      'Ana’s progress at Escuela <Luna>',
    );
  });
});

describe('trialReminderEmail', () => {
  it('says how many days are left and links to billing', () => {
    const mail = trialReminderEmail({
      language: 'en',
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
      trialReminderEmail({ language: 'es', name: 'Juan', daysLeft: 1, billingUrl: 'https://x' })
        .subject,
    ).toBe('Su prueba de TeacherHubPro termina hoy');
  });
});

describe('weeklyUpdateEmail', () => {
  const input = {
    language: 'es' as const,
    subject: 'Esta semana en Historia 7',
    body: 'Queridas familias:\n\n• Lunes: <Causas>\n• Martes: Batallas\n\nSaludos,\nSra. Rivera',
    schoolName: 'Escuela Luna',
  };

  it('sends the teacher’s text as written, one paragraph per block, lines kept', () => {
    const mail = weeklyUpdateEmail(input);
    expect(mail.subject).toBe('Esta semana en Historia 7');
    expect(mail.text).toContain(input.body);
    expect(mail.text).toContain('Escuela Luna');
    expect(mail.html).toContain('• Lunes: &lt;Causas&gt;<br>• Martes: Batallas');
    expect(mail.html).not.toContain('<Causas>');
    expect(mail.html).toContain('lang="es"');
  });

  it('says who sent it, in the family’s language', () => {
    expect(weeklyUpdateEmail(input).text).toMatch(/Enviado por un maestro de Escuela Luna/u);
    expect(weeklyUpdateEmail({ ...input, language: 'en' }).text).toMatch(
      /Sent by a teacher at Escuela Luna/u,
    );
  });
});

describe('setPasswordEmail', () => {
  const url = 'https://app.test/es/set-password#secret';

  it('welcomes a new account with a link to choose a password', () => {
    const mail = setPasswordEmail({ language: 'es', name: 'Ana', url, purpose: 'welcome' });
    expect(mail.subject).toBe('Su cuenta de TeacherHubPro');
    expect(mail.text).toContain('Hola, Ana:');
    expect(mail.html).toContain(`href="${url}"`);
    expect(mail.text).toMatch(/3 días/u);
  });

  it('has a reset wording', () => {
    const mail = setPasswordEmail({ language: 'en', name: 'Ana', url, purpose: 'reset' });
    expect(mail.subject).toBe('Reset your TeacherHubPro password');
    expect(mail.text).toMatch(/ignore this email/u);
  });
});
