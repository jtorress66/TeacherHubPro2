import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PresentationId } from '@thp/domain';
import { Presenter } from '../../../../../../components/presenter.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; presentationId: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** Present mode: one slide at a time over the whole window. */
export default async function PresentPage(props: Props) {
  const locale = await localeFrom(props);
  const { presentationId } = await props.params;
  const { user } = await requireUser(locale);
  const found = await getAppContainer().getPresentation.execute({
    actor: user,
    presentationId: presentationId as PresentationId,
  });
  if (!found.ok) notFound();
  const presentation = found.value;

  return (
    <Presenter
      locale={locale}
      language={user.language}
      slides={presentation.slides}
      theme={presentation.theme}
      exitHref={`/${locale}/app/presentations/${presentation.id}`}
    />
  );
}
