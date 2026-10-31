import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { ProfileForm, SchoolForm } from '../../../../components/forms.tsx';
import { LogoForm } from '../../../../components/gradebook-forms.tsx';
import { removeLogoAction } from '../../../_lib/gradebook-actions.ts';
import { disconnectClassroomAction } from '../../../_lib/assignment-actions.ts';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('settings.title') };
}

export default async function SettingsPage(
  props: LocaleParams & { readonly searchParams: Promise<{ classroom?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale);
  const notice = (await props.searchParams).classroom;
  const courses = await getAppContainer().listClassroomCourses.execute({ actor: user });

  return (
    <section className="stack">
      <h1>{t('settings.title')}</h1>
      <div className="settings-grid">
        <section className="card stack" aria-labelledby="profile-heading">
          <h2 id="profile-heading">{t('settings.profile')}</h2>
          <ProfileForm locale={locale} name={user.name} language={user.language} />
        </section>
        <section className="card stack" aria-labelledby="school-heading">
          <h2 id="school-heading">{t('settings.school')}</h2>
          <SchoolForm
            locale={locale}
            school={{
              name: school.name,
              address: school.address,
              phone: school.phone,
              email: school.email,
            }}
          />
        </section>
        <section className="card stack" aria-labelledby="logo-heading">
          <h2 id="logo-heading">{t('settings.logo')}</h2>
          {school.logoKey === null ? (
            <p className="muted">{t('settings.noLogo')}</p>
          ) : (
            <>
              <img
                src="/api/school-logo"
                alt={t('settings.logoAlt')}
                className="logo-preview"
                data-testid="logo-preview"
              />
              <form action={removeLogoAction}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="button secondary">
                  {t('settings.removeLogo')}
                </button>
              </form>
            </>
          )}
          <LogoForm locale={locale} />
        </section>
        <section className="card stack" aria-labelledby="classroom-heading">
          <h2 id="classroom-heading">{t('classroom.title')}</h2>
          {notice === 'connected' ? (
            <p role="status" className="notice">
              {t('classroom.connectedNotice')}
            </p>
          ) : null}
          {notice === 'failed' ? (
            <p role="alert" className="alert">
              {t('classroom.failedNotice')}
            </p>
          ) : null}
          {courses.ok ? (
            <>
              <p>{t('classroom.connected')}</p>
              <form action={disconnectClassroomAction}>
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="button secondary">
                  {t('classroom.disconnect')}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="muted">{t('classroom.notConnected')}</p>
              <p>
                <a className="button" href={`/api/classroom/connect?locale=${locale}`}>
                  {t('classroom.connect')}
                </a>
              </p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
