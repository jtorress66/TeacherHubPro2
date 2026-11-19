import type { Metadata } from 'next';
import { deletionHoldDays } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { ProfileForm, SchoolForm } from '../../../../components/forms.tsx';
import { LogoForm } from '../../../../components/gradebook-forms.tsx';
import {
  CancelSchoolDeletionForm,
  DeleteSchoolForm,
} from '../../../../components/school-deletion-forms.tsx';
import { removeLogoAction } from '../../../_lib/gradebook-actions.ts';
import { getAppContainer } from '../../../../container.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('settings.title') };
}

export default async function SettingsPage(
  props: LocaleParams & { readonly searchParams: Promise<{ deletion?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  // Open after a plan ends too: the school may still want to download or delete its data.
  const { user, school } = await requireUser(locale, { needsAccess: false });
  const app = getAppContainer();
  const canExport = await app.exportSchoolData.isOpenTo(user);
  const canDelete = await app.requestSchoolDeletion.isOpenTo(user);
  const deletion = canDelete ? await app.getSchoolDeletion.execute({ actor: user }) : null;
  const deleteOn = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: await teacherTimeZone(),
  });
  const { deletion: done } = await props.searchParams;
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
        {canExport ? (
          <section className="card stack" aria-labelledby="export-heading">
            <h2 id="export-heading">{t('schoolExport.title')}</h2>
            <p>{t('schoolExport.intro')}</p>
            <p className="muted">{t('schoolExport.notIncluded')}</p>
            <p className="muted">{t('schoolExport.privacy')}</p>
            <p>
              <a className="button" href={`/api/school-export?locale=${locale}`} download>
                {t('schoolExport.button')}
              </a>
            </p>
          </section>
        ) : null}
        {canDelete ? (
          <section className="card stack" aria-labelledby="delete-heading">
            <h2 id="delete-heading">{t('schoolDeletion.title')}</h2>
            {done === 'canceled' && deletion === null ? (
              <p role="status" className="notice">
                {t('schoolDeletion.canceled')}
              </p>
            ) : null}
            {deletion === null ? (
              <>
                <p>{t('schoolDeletion.intro', { school: school.name })}</p>
                <p className="muted">
                  {t('schoolDeletion.hold', { days: deletionHoldDays })}{' '}
                  {t('schoolDeletion.billing')}
                </p>
                <DeleteSchoolForm locale={locale} schoolName={school.name} />
              </>
            ) : (
              <>
                <p className="alert">
                  {t('schoolDeletion.notice', { date: deleteOn.format(deletion.deleteAfter) })}
                </p>
                <CancelSchoolDeletionForm locale={locale} />
              </>
            )}
          </section>
        ) : null}
        <section className="card stack" aria-labelledby="tools-heading">
          <h2 id="tools-heading">{t('connectedTools.title')}</h2>
          <p className="muted">{t('connectedTools.moved')}</p>
          <p>
            <a className="button secondary" href={`/${locale}/app/integrations`}>
              {t('connectedTools.movedLink')}
            </a>
          </p>
        </section>
      </div>
    </section>
  );
}
