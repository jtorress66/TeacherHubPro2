import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { allModes, defaultGameModes, type JobId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { GameEditor } from '../../../../../../components/game-forms.tsx';
import { JobProgress } from '../../../../../../components/job-progress.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { kindForMode } from '../../../../../../server/game-forms.ts';
import { contentText } from '../../../../../../server/game-text.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; jobId: string }>;
  readonly searchParams: Promise<{ mode?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * Waits for the AI's draft, then shows it in the editor: a new game, or fresh items for one.
 * Nothing is saved until the teacher saves. Only the job's owner can open this page.
 */
export default async function GameDraftPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { jobId } = await props.params;
  const { mode } = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const job = await app.getJob.execute({ actor: user, jobId: jobId as JobId });
  if (!job.ok) notFound();
  const games = `/${locale}/app/games`;

  if (job.value.status !== 'completed') {
    return (
      <section className="stack">
        <h1>{t('games.aiTitle')}</h1>
        <JobProgress
          locale={locale}
          jobId={job.value.id}
          retryHref={games}
          labels={{
            working: t('games.working'),
            failed: t('drafts.failed'),
            tryAgain: t('drafts.tryAgain'),
            open: t('games.open'),
          }}
        />
      </section>
    );
  }

  const draft = await app.getGameDraft.execute({ actor: user, jobId: job.value.id });
  if (!draft.ok) notFound();
  const { content, request, gameId } = draft.value;
  const classes = (await app.listClasses.execute({ actor: user })).map((cls) => ({
    id: cls.id,
    name: cls.name,
  }));
  const existing = gameId === null ? null : await app.getGame.execute({ actor: user, gameId });
  const chosen = mode !== undefined && kindForMode(mode) === content.kind ? mode : null;

  return (
    <section className="stack">
      <h1>{existing?.ok ? existing.value.game.title : t('games.aiTitle')}</h1>
      <p>{t('games.reviewDraft')}</p>
      {existing?.ok ? (
        <GameEditor
          locale={locale}
          classes={classes}
          gameId={existing.value.game.id}
          label={t('games.useFresh')}
          values={{
            title: existing.value.game.title,
            mode: existing.value.game.mode,
            content: contentText(content),
            classId: existing.value.game.classId,
            language: existing.value.game.language,
          }}
        />
      ) : (
        <GameEditor
          locale={locale}
          classes={classes}
          values={{
            title: request.topic,
            mode:
              chosen ??
              (content.kind === 'pairs'
                ? allModes
                : (defaultGameModes.modesFor(content.kind)[0]?.id ?? 'quiz')),
            content: contentText(content),
            classId: null,
            language: request.language,
          }}
        />
      )}
    </section>
  );
}
