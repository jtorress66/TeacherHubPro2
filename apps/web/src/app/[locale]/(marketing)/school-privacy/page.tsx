import { permanentRedirect } from 'next/navigation';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

/** The schools' privacy details now live in the one privacy policy. */
export default async function SchoolPrivacyPage(props: LocaleParams) {
  permanentRedirect(`/${await localeFrom(props)}/privacy`);
}
