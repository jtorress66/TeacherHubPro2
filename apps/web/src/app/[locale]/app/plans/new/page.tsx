import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DraftedPlan, JobId, PlanTemplateId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PlanEditor } from '../../../../../components/planner-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { nextMonday } from '../../../../../server/lesson-plan-display.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly searchParams: Promise<{
    kind?: string;
    draft?: string;
    starter?: string;
    template?: string;
    start?: string;
  }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/**
 * A new plan's editor, empty or filled from an AI draft, a starter or a saved template. Nothing
 * is saved until the teacher presses Save.
 */
export default async function NewPlanPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const search = await props.searchParams;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const today = app.today(await teacherTimeZone());
  const start = search.start ?? nextMonday(today);

  let content: DraftedPlan;
  if (search.draft !== undefined) {
    const drafted = await app.getDraftedPlan.execute({
      actor: user,
      jobId: search.draft as JobId,
    });
    if (!drafted.ok) notFound();
    content = drafted.value;
  } else if (search.starter !== undefined || search.template !== undefined) {
    const started = await app.startFromTemplate.execute({
      actor: user,
      source:
        search.starter !== undefined
          ? { starterId: search.starter }
          : { templateId: search.template as PlanTemplateId },
      start,
      language: locale,
    });
    if (!started.ok) notFound();
    content = started.value;
  } else if (search.kind === 'conversational_english') {
    content = { title: null, body: { kind: 'conversational_english', lessonDate: today } };
  } else {
    content = { title: null, body: { kind: 'weekly', weeks: [{ weekStart: start }] } };
  }

  const classes = await app.listClasses.execute({ actor: user });
  const folders = await app.listFolders.execute({ actor: user });

  return (
    <section className="stack">
      <p>
        <Link href={`/${locale}/app/plans`}>← {t('planner.back')}</Link>
      </p>
      <h1>{t('planner.newTitle')}</h1>
      {search.draft !== undefined ? (
        <p role="note" className="notice">
          {t('planner.draftNotice')}
        </p>
      ) : null}
      <PlanEditor
        locale={locale}
        planId=""
        title={content.title}
        classId={null}
        folderId={null}
        body={content.body}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        folders={folders.map(({ folder }) => ({ id: folder.id, name: folder.name }))}
      />
    </section>
  );
}
