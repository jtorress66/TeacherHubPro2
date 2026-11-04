import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { StartLiveForm } from '../../../../components/live/start-live-form.tsx';
import { getAppContainer } from '../../../../container.ts';
import { deleteLiveSessionAction } from '../../../_lib/live-actions.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

type Props = LocaleParams & { readonly searchParams: Promise<{ game?: string }> };

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Play to Learn: start a session of a game, and see the sessions run so far. */
export default async function LivePage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { game } = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const games = await app.listGames.execute({ actor: user });
  const classes = await app.listClasses.execute({ actor: user });
  const sessions = await app.listLiveSessions.execute({ actor: user });
  const titles = new Map(games.map((g) => [g.id, g.title]));
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <section className="stack">
      <h1>{t('live.title')}</h1>
      <p>{t('live.intro')}</p>
      <h2>{t('live.startTitle')}</h2>
      {games.length === 0 || classes.length === 0 ? (
        <p>{t('live.needGame')}</p>
      ) : (
        <StartLiveForm
          locale={locale}
          games={games.map((g) => ({ id: g.id, name: g.title }))}
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          {...(game === undefined ? {} : { gameId: game })}
        />
      )}
      <h2>{t('live.sessions')}</h2>
      {sessions.length === 0 ? (
        <p>{t('live.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('live.sessions')}>
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/${locale}/app/live/${session.id}`}>
                {titles.get(session.gameId) ?? ''}
              </Link>
              <span className="chip">{t(`live.status_${session.status}`)}</span>
              <span className="muted small">{day.format(session.createdAt)}</span>
              <form action={deleteLiveSessionAction}>
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="sessionId" value={session.id} />
                <button type="submit" className="link-button">
                  {t('live.delete')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
