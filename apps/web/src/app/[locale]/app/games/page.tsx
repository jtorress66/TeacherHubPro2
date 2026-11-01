import type { Metadata } from 'next';
import Link from 'next/link';
import { createTranslator } from '@thp/i18n';
import { GameDraftForm, GameEditor } from '../../../../components/game-forms.tsx';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Educational games: the teacher's games, a new one typed in, or one written with AI. */
export default async function GamesPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const games = await app.listGames.execute({ actor: user });
  const classes = await app.listClasses.execute({ actor: user });

  return (
    <section className="stack">
      <h1>{t('games.title')}</h1>
      <p>{t('games.intro')}</p>
      <h2>{t('games.list')}</h2>
      {games.length === 0 ? (
        <p>{t('games.empty')}</p>
      ) : (
        <ul className="list" aria-label={t('games.list')}>
          {games.map((game) => (
            <li key={game.id}>
              <Link href={`/${locale}/app/games/${game.id}`}>{game.title}</Link>{' '}
              <span className="chip">{t(`gameModes.${game.mode}`)}</span>
            </li>
          ))}
        </ul>
      )}
      <h2>{t('games.newGame')}</h2>
      <GameEditor
        locale={locale}
        classes={classes.map((cls) => ({ id: cls.id, name: cls.name }))}
        values={{ title: '', mode: 'quiz', content: '', classId: null, language: locale }}
      />
      <h2>{t('games.aiTitle')}</h2>
      <p>{t('games.aiIntro')}</p>
      <GameDraftForm locale={locale} />
    </section>
  );
}
