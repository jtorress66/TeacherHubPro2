import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { GameId, JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { GameEditor } from '../../../../../../../components/game-forms.tsx';
import { JobProgress } from '../../../../../../../components/job-progress.tsx';
import { getAppContainer } from '../../../../../../../container.ts';
import { contentText } from '../../../../../../../server/game-text.ts';
import { requireUser } from '../../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; gameId: string; jobId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * Waits for the AI's explanations, then shows the game in the editor with them on the cards that
 * had none. Nothing is saved until the teacher saves. Only the job's owner can open this page.
 */
export default async function GameExplanationsPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { gameId, jobId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const job = await app.getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const gamePath = `/${locale}/app/games/${gameId}`;

  if (job.value.status !== 'completed') {
    return (
      <section className="stack">
        <h1>{t('games.explainTitle')}</h1>
        <JobProgress
          locale={locale}
          jobId={job.value.id}
          retryHref={gamePath}
          labels={{
            working: t('games.explainWorking'),
            failed: t('drafts.failed'),
            tryAgain: t('drafts.tryAgain'),
            open: t('games.open'),
          }}
        />
      </section>
    );
  }

  const draft = await app.getExplanationsDraft.execute({ actor: user, jobId: job.value.id });
  if (!draft.ok || draft.value.gameId !== gameId) notFound();
  const existing = await app.getGame.execute({ actor: user, gameId: gameId as GameId });
  if (!existing.ok) notFound();
  const { game } = existing.value;
  const { content } = draft.value;
  const suggestions = await app.listPlannedStandards.execute({ actor: user });
  const classes = (await app.listClasses.execute({ actor: user })).map((cls) => ({
    id: cls.id,
    name: cls.name,
  }));

  return (
    <section className="stack">
      <h1>{game.title}</h1>
      <p>{t('games.explainReview')}</p>
      <GameEditor
        suggestions={suggestions}
        locale={locale}
        classes={classes}
        gameId={game.id}
        label={t('games.save')}
        values={{
          title: game.title,
          mode: game.mode,
          content: contentText(content),
          items: content,
          classId: game.classId,
          language: game.language,
        }}
      />
    </section>
  );
}
