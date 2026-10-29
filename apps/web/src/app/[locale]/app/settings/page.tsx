import type { Metadata } from 'next';
import { createTranslator } from '@thp/i18n';
import { ProfileForm, SchoolForm } from '../../../../components/forms.tsx';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('settings.title') };
}

export default async function SettingsPage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user, school } = await requireUser(locale);

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
      </div>
    </section>
  );
}
