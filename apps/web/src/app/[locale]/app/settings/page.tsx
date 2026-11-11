import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { ProfileForm, SchoolForm } from '../../../../components/forms.tsx';
import { LogoForm } from '../../../../components/gradebook-forms.tsx';
import { removeLogoAction } from '../../../_lib/gradebook-actions.ts';
import { disconnectClassroomAction } from '../../../_lib/assignment-actions.ts';
import { disconnectCanvaAction } from '../../../_lib/canva-actions.ts';
import { disconnectMicrosoftAction } from '../../../_lib/microsoft-actions.ts';
import { getAppContainer } from '../../../../container.ts';
import { microsoftNotice } from '../../../../server/microsoft-notice.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('settings.title') };
}

export default async function SettingsPage(
  props: LocaleParams & {
    readonly searchParams: Promise<{ classroom?: string; canva?: string; microsoft?: string }>;
  },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale);
  const search = await props.searchParams;
  const notice = search.classroom;
  const app = getAppContainer();
  const courses = await app.listClassroomCourses.execute({ actor: user });
  const canvaConnected = (await app.canva?.connected.execute({ actor: user })) ?? null;
  const microsoftConnected = (await app.microsoft?.connected.execute({ actor: user })) ?? null;
  const teamsAllowed = (await app.teams?.allowed.execute({ actor: user })) ?? null;
  const microsoftOutcome = microsoftNotice(search.microsoft);

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
              planFormat: school.planFormat,
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
        {canvaConnected === null ? null : (
          <section className="card stack" aria-labelledby="canva-heading">
            <h2 id="canva-heading">{t('canva.title')}</h2>
            {search.canva === 'connected' ? (
              <p role="status" className="notice">
                {t('canva.connectedNotice')}
              </p>
            ) : null}
            {search.canva === 'failed' ? (
              <p role="alert" className="alert">
                {t('canva.failedNotice')}
              </p>
            ) : null}
            {canvaConnected ? (
              <>
                <p>{t('canva.connected')}</p>
                <form action={disconnectCanvaAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className="button secondary">
                    {t('canva.disconnect')}
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="muted">{t('canva.notConnected')}</p>
                <p>
                  <a className="button" href={`/api/canva/connect?locale=${locale}`}>
                    {t('canva.connect')}
                  </a>
                </p>
              </>
            )}
          </section>
        )}
        {microsoftConnected === null ? null : (
          <section className="card stack" aria-labelledby="microsoft-heading">
            <h2 id="microsoft-heading">{t('microsoft.title')}</h2>
            {microsoftOutcome === null ? null : (
              <p
                role={microsoftOutcome.role}
                className={microsoftOutcome.role === 'status' ? 'notice' : 'alert'}
              >
                {t(microsoftOutcome.key)}
              </p>
            )}
            {microsoftConnected ? (
              <>
                <p>{t('microsoft.connected')}</p>
                <form action={disconnectMicrosoftAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className="button secondary">
                    {t('microsoft.disconnect')}
                  </button>
                </form>
                <p className="muted">{t('microsoft.disconnectNote')}</p>
              </>
            ) : (
              <>
                <p className="muted">{t('microsoft.notConnected')}</p>
                <p>
                  <a className="button" href={`/api/microsoft/connect?locale=${locale}`}>
                    {t('microsoft.connect')}
                  </a>
                </p>
              </>
            )}
            {teamsAllowed === null ? null : (
              <section className="stack" aria-labelledby="teams-heading">
                <h3 id="teams-heading">{t('teams.title')}</h3>
                {teamsAllowed ? (
                  <p>{t('teams.allowed')}</p>
                ) : (
                  <>
                    <p className="muted">{t('teams.notAllowed')}</p>
                    <p>
                      <a
                        className="button secondary"
                        href={`/api/microsoft/connect?locale=${locale}&teams=1`}
                      >
                        {t('teams.allow')}
                      </a>
                    </p>
                  </>
                )}
                <p className="hint">{t('teams.note')}</p>
              </section>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
