import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { CopyValue } from '../../../../components/lti-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { inviteLink } from '../../../../server/referral.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('invite.title') };
}

/** The teacher's invite link, and how many colleagues joined and free months it earned. */
export default async function InvitePage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const page = await app.getInvitePage.execute({ actor: user });
  if (!page.ok) notFound();
  const { code, joined, freeMonths, limitReached, maxFreeMonths } = page.value;
  const link = inviteLink(app.appUrl, locale, code);
  const mailto = `mailto:?${new URLSearchParams({
    subject: t('invite.emailSubject'),
    body: t('invite.emailBody', { link }),
  })
    .toString()
    .replaceAll('+', '%20')}`;

  return (
    <section className="stack">
      <h1>{t('invite.title')}</h1>
      <p>{t('invite.intro')}</p>
      <div className="card stack">
        <CopyValue locale={locale} id="invite-link" label={t('invite.linkLabel')} value={link} />
        <p>
          <a className="button secondary" href={mailto}>
            {t('invite.shareEmail')}
          </a>
        </p>
      </div>
      <ul className="card" data-testid="invite-stats">
        <li>{t('invite.joined', { count: joined })}</li>
        <li>{t('invite.freeMonths', { count: freeMonths })}</li>
      </ul>
      {limitReached ? (
        <p role="status" className="notice">
          {t('invite.limitReached', { max: maxFreeMonths })}
        </p>
      ) : null}
      <h2>{t('invite.howTitle')}</h2>
      <ol>
        <li>{t('invite.rule1')}</li>
        <li>{t('invite.rule2')}</li>
        <li>{t('invite.rule3', { max: maxFreeMonths })}</li>
        <li>{t('invite.rule4')}</li>
      </ol>
      <p className="muted">{t('invite.privacy')}</p>
    </section>
  );
}
