import Link from 'next/link';
import type { OnboardingState } from '@thp/application';
import { catalogs, createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import { dismissOnboardingAction } from '../app/_lib/roster-actions.ts';

/** Item labels come from the application as i18n keys; an unknown key shows as itself. */
function labelFor(locale: Locale, key: string): string {
  const known = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalogs.en,
    );
  return typeof known === 'string' ? createTranslator(locale)(key as MessageKey) : key;
}

export function OnboardingChecklist({
  locale,
  state,
}: {
  readonly locale: Locale;
  readonly state: OnboardingState;
}) {
  if (!state.show) return null;
  const t = createTranslator(locale);
  return (
    <section className="card stack" aria-labelledby="onboarding-heading">
      <div className="row-between">
        <h2 id="onboarding-heading">{t('onboarding.title')}</h2>
        <form action={dismissOnboardingAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="link-button">
            {t('onboarding.dismiss')}
          </button>
        </form>
      </div>
      <p className="muted" data-testid="onboarding-progress">
        {t('onboarding.progress', { done: state.done, total: state.total })}
      </p>
      <ul className="checklist">
        {state.items.map((item) => (
          <li key={item.id} data-done={item.done}>
            {item.done ? (
              <span>✓ {labelFor(locale, item.labelKey)}</span>
            ) : (
              <Link href={`/${locale}${item.route}`}>{labelFor(locale, item.labelKey)}</Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
