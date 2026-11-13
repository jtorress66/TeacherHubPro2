import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createTranslator } from '@thp/i18n';
import { PlaceLtiContentForm } from '../../../../../components/lti-forms.tsx';
import { getAppContainer } from '../../../../../container.ts';
import {
  LTI_PLACE_COOKIE,
  ltiPlaceProblemFor,
  placedItemValue,
} from '../../../../../server/lti.ts';
import { requireUser } from '../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../locale-param.ts';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('lti.placeTitle') };
}

/**
 * A course's "Add content" (LTI Deep Linking): the teacher picks assignments students can open and
 * games, and they go back to the course as links. The request waits in a short-lived cookie.
 */
export default async function LtiPlacePage(props: LocaleParams) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const lti = getAppContainer().lti;
  if (lti === null) notFound();
  const ticket = (await cookies()).get(LTI_PLACE_COOKIE)?.value ?? '';
  const content = await lti.listPlaceable.execute({ actor: user, ticket });
  if (!content.ok) {
    redirect(`/${locale}/lti/problem?reason=${ltiPlaceProblemFor(content.error.code)}`);
  }
  const { platformName, acceptMultiple, items } = content.value;
  const choices = items.map((placeable) => ({
    value: placedItemValue(placeable.item),
    label:
      placeable.className === null
        ? t('lti.placeGameItem', { title: placeable.title })
        : t('lti.placeAssignmentItem', { title: placeable.title, className: placeable.className }),
  }));

  return (
    <section className="stack">
      <h1>{t('lti.placeTitle')}</h1>
      <p>{t('lti.placeIntro', { platform: platformName })}</p>
      <section className="card stack">
        {choices.length === 0 ? (
          <p>{t('lti.placeEmpty')}</p>
        ) : (
          <PlaceLtiContentForm locale={locale} multiple={acceptMultiple} items={choices} />
        )}
      </section>
    </section>
  );
}
