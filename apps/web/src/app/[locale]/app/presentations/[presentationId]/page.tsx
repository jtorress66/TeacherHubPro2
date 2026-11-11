import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { PresentationId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { PresentationClassroomForm } from '../../../../../components/assistant-forms.tsx';
import { OpenInCanvaForm } from '../../../../../components/canva-forms.tsx';
import { SaveToOneDriveForm } from '../../../../../components/microsoft-forms.tsx';
import { SlideEditor } from '../../../../../components/slide-editor.tsx';
import { getAppContainer } from '../../../../../container.ts';
import { deletePresentationAction } from '../../../../_lib/assistant-actions.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; presentationId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The slide editor for the teacher's own presentation; anyone else gets a 404. */
export default async function PresentationPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { presentationId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const found = await app.getPresentation.execute({
    actor: user,
    presentationId: presentationId as PresentationId,
  });
  if (!found.ok) notFound();
  const presentation = found.value;
  const base = `/${locale}/app/presentations`;
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const connect = `/api/classroom/connect?locale=${locale}`;

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('presentations.back')}</Link>
      </p>
      <h1>{presentation.name}</h1>
      <div className="button-row">
        <Link className="button" href={`${base}/${presentation.id}/present`}>
          {t('presentations.present')}
        </Link>
        <Link className="button secondary" href={`${base}/${presentation.id}/print`}>
          {t('presentations.print')}
        </Link>
        <a className="button secondary" href={`${base}/${presentation.id}/pptx`} download>
          {t('canva.downloadPptx')}
        </a>
        <form action={deletePresentationAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="presentationId" value={presentation.id} />
          <button type="submit" className="button secondary">
            {t('presentations.delete')}
          </button>
        </form>
      </div>
      <SlideEditor locale={locale} presentation={presentation} language={user.language} />
      <section id="classroom" className="card stack" aria-labelledby="slides-classroom-heading">
        <h2 id="slides-classroom-heading">{t('presentations.classroomTitle')}</h2>
        <p>{t('presentations.classroomIntro')}</p>
        {!courses.ok ? (
          <div className="stack">
            <p className="muted">{t('google.connectFirst')}</p>
            <p>
              <a className="button" href={connect}>
                {t('google.connect')}
              </a>
            </p>
          </div>
        ) : courses.value.length === 0 ? (
          <div className="stack">
            <p className="notice" role="status">
              {t('google.noCourses')}
            </p>
            <p>
              <a className="button secondary" href={connect}>
                {t('google.switchAccount')}
              </a>
            </p>
          </div>
        ) : (
          <PresentationClassroomForm
            locale={locale}
            presentationId={presentation.id}
            name={presentation.name}
            courses={courses.value.map((course) => ({ id: course.id, name: course.name }))}
          />
        )}
      </section>
      {app.canva === null ? null : (
        <section className="card stack" aria-labelledby="slides-canva-heading">
          <h2 id="slides-canva-heading">{t('canva.title')}</h2>
          <OpenInCanvaForm locale={locale} kind="presentation" id={presentation.id} />
        </section>
      )}
      {app.microsoft === null ? null : (
        <section className="card stack" aria-labelledby="slides-onedrive-heading">
          <h2 id="slides-onedrive-heading">{t('microsoft.title')}</h2>
          <SaveToOneDriveForm locale={locale} kind="presentation" id={presentation.id} />
        </section>
      )}
    </section>
  );
}
