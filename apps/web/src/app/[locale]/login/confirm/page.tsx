import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { getAppContainer } from '../../../../container.ts';
import { notListed } from '../../../../server/marketing-pages.ts';
import {
  confirmMessage,
  safeNextPath,
  SIGN_IN_CONFIRM_COOKIE,
} from '../../../../server/sign-in-confirm.ts';
import { cancelSignInAction, confirmSignInAction } from '../../../_lib/actions.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return {
    title: createTranslator(await localeFrom(props))('signInConfirm.title'),
    robots: notListed,
  };
}

/**
 * Every way of signing in comes here when the account is in use on another device: continue
 * here (signing that device out) or cancel. The waiting sign-in is a signed ticket in a
 * short-lived cookie, never in the address, so the password is not sent again.
 */
export default async function ConfirmSignInPage(
  props: LocaleParams & { readonly searchParams: Promise<{ next?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const ticket = (await cookies()).get(SIGN_IN_CONFIRM_COOKIE)?.value ?? '';
  const described = await getAppContainer().describeSignInConfirmation.execute({ ticket });
  if (!described.ok) redirect(`/${locale}/login?error=sign_in_expired`);
  const next = safeNextPath((await props.searchParams).next ?? null) ?? `/${locale}/app`;
  return (
    <main className="student-page stack">
      <section className="card stack" aria-labelledby="sign-in-confirm-title">
        <h1 id="sign-in-confirm-title">{t('signInConfirm.title')}</h1>
        <p>{confirmMessage(locale, described.value)}</p>
        <div className="button-row">
          <form action={confirmSignInAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={next} />
            <button type="submit" className="button">
              {t('signInConfirm.continue')}
            </button>
          </form>
          <form action={cancelSignInAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="button secondary">
              {t('signInConfirm.cancel')}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
