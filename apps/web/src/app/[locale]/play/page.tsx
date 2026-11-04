import type { Metadata } from 'next';
import { JoinFlow } from '../../../components/live/join-flow.tsx';
import { getAppContainer } from '../../../container.ts';
import { localeFrom, type LocaleParams } from '../locale-param.ts';

type Props = LocaleParams & { readonly searchParams: Promise<{ pin?: string }> };

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'TeacherHubPro',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** Where students join a live game: no account, just the PIN and their name. */
export default async function PlayPage(props: Props) {
  const locale = await localeFrom(props);
  const { pin } = await props.searchParams;
  return (
    <main className="student-page">
      <JoinFlow
        locale={locale}
        realtimeUrl={getAppContainer().realtimeUrl}
        initialPin={(pin ?? '').replace(/\D/gu, '').slice(0, 6)}
      />
    </main>
  );
}
