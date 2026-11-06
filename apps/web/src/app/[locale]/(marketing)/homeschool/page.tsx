import { redirect } from 'next/navigation';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

/** The old site's homeschool page lives on as the homeschool use case. */
export default async function HomeschoolPage(props: LocaleParams) {
  redirect(`/${await localeFrom(props)}/use-cases/homeschool`);
}
