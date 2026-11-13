'use client';

import { useActionState } from 'react';
import { visitorInterests, visitorRoles } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { captureLeadAction, type LeadFormState } from '../app/_lib/marketing-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, TextArea } from './form-fields.tsx';

const initial: LeadFormState = {};

/** The contact form: becomes a lead for the team. A "tell us" link can start the message. */
export function ContactForm({
  locale,
  message,
}: {
  readonly locale: Locale;
  readonly message?: string | undefined;
}) {
  const t = createTranslator(locale);
  const [state, action] = useActionState(captureLeadAction, initial);
  if (state.sent === true) {
    return (
      <p role="status" className="notice">
        {t('marketing.contactPage.sent')}
      </p>
    );
  }
  const errors = state.errors ?? {};
  return (
    <form
      action={action}
      className="stack card"
      noValidate
      aria-label={t('marketing.contactPage.title')}
    >
      <Hidden values={{ locale, source: 'contact', page: `/${locale}/contact` }} />
      <FormAlert message={errors.form} />
      <div className="field-row">
        <Field
          id="contact-name"
          name="name"
          label={t('marketing.contactPage.name')}
          error={errors.name}
          required
        />
        <Field
          id="contact-email"
          name="email"
          type="email"
          label={t('marketing.contactPage.email')}
          error={errors.email}
          required
        />
      </div>
      <div className="field-row">
        <Field
          id="contact-organization"
          name="organization"
          label={t('marketing.contactPage.organization')}
          error={errors.organization}
        />
        <Field
          id="contact-phone"
          name="phone"
          label={t('marketing.contactPage.phone')}
          error={errors.phone}
        />
      </div>
      <div className="field-row">
        <Select
          id="contact-role"
          name="role"
          label={t('marketing.contactPage.role')}
          options={visitorRoles.map((r) => ({ id: r, name: t(`marketing.roles.${r}`) }))}
          defaultValue="teacher"
        />
        <Select
          id="contact-interest"
          name="interest"
          label={t('marketing.contactPage.interest')}
          options={visitorInterests.map((i) => ({ id: i, name: t(`marketing.interests.${i}`) }))}
          defaultValue={message === undefined ? 'features' : 'school'}
        />
      </div>
      <TextArea
        id="contact-message"
        name="message"
        label={t('marketing.contactPage.message')}
        error={errors.message}
        defaultValue={message}
        rows={5}
      />
      <p className="hint">{t('marketing.contactPage.consent')}</p>
      <Submit label={t('marketing.contactPage.send')} />
    </form>
  );
}
