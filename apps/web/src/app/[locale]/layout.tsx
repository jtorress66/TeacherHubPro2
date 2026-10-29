import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { createTranslator, isLocale, locales } from '@thp/i18n';
import './globals.css';

interface LocaleParams {
  readonly params: Promise<{ locale: string }>;
}

export function generateStaticParams(): { locale: string }[] {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale);
  return { title: t('app.name'), description: t('home.tagline') };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleParams & { readonly children: ReactNode }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
