import { notFound } from 'next/navigation';
import { createTranslator, isLocale } from '@thp/i18n';
import { LanguagePicker } from './language-picker.tsx';

export default async function HomePage({
  params,
}: {
  readonly params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = createTranslator(locale);

  return (
    <main className="home">
      <p className="brand">{t('app.name')}</p>
      <h1>{t('home.title')}</h1>
      <p className="tagline">{t('home.tagline')}</p>
      <LanguagePicker current={locale} label={t('language.label')} />
    </main>
  );
}
