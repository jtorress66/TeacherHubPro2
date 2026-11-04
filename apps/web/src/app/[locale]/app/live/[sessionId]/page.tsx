import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { LiveSessionId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { HostScreen } from '../../../../../components/live/host-screen.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & { readonly params: Promise<{ locale: string; sessionId: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The host screen: a fresh ticket each time the page opens connects it to the session. */
export default async function LiveHostPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { sessionId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const host = await app.openLiveHost.execute({
    actor: user,
    sessionId: sessionId as LiveSessionId,
  });
  if (!host.ok) notFound();

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/live`}>{t('live.title')}</Link>
      </p>
      <HostScreen
        locale={locale}
        realtimeUrl={app.realtimeUrl}
        ticket={host.value.ticket}
        joinUrl={`${app.appUrl.replace(/^https?:\/\//u, '')}/${locale}/play`}
      />
    </section>
  );
}
