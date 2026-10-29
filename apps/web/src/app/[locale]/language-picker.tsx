import { localeInfo, locales, type Locale } from '@thp/i18n';

export function LanguagePicker({
  current,
  label,
}: {
  readonly current: Locale;
  readonly label: string;
}) {
  return (
    <nav aria-label={label} className="language-picker">
      <ul>
        {locales.map((locale) => (
          <li key={locale}>
            <a
              href={`/${locale}`}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? 'page' : undefined}
            >
              {localeInfo[locale].nativeName}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
