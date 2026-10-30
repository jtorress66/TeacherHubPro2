import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ClassId } from '@thp/domain';
import { createTranslator } from '@thp/i18n';
import { SubPacketForm } from '../../../../../../components/assistant-forms.tsx';
import { getAppContainer } from '../../../../../../container.ts';
import { requireUser } from '../../../../../_lib/auth.ts';
import { teacherTimeZone } from '../../../../../_lib/time-zone.ts';
import { localeFrom, type LocaleParams } from '../../../../locale-param.ts';

type Props = LocaleParams & {
  readonly params: Promise<{ locale: string; classId: string }>;
  readonly searchParams: Promise<{ date?: string }>;
};

export const metadata: Metadata = { title: 'TeacherHubPro' };

/** The notes a teacher keeps for substitutes, and the day to print the packet for. */
export default async function SubPacketPage(props: Props) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { classId } = await props.params;
  const { user } = await requireUser(locale);
  const app = getAppContainer();
  const date = (await props.searchParams).date ?? app.today(await teacherTimeZone());
  const packet = await app.getSubPacket.execute({ actor: user, classId: classId as ClassId, date });
  if (!packet.ok) notFound();
  const { cls, notes } = packet.value;
  const base = `/${locale}/app/classes/${cls.id}`;

  return (
    <section className="stack">
      <p>
        <Link href={base}>← {t('subPacket.back')}</Link>
      </p>
      <h1>
        {t('subPacket.title')}: {cls.name}
      </h1>
      <p>{t('subPacket.intro')}</p>
      <form method="get" className="field-row" action={`${base}/sub-packet/print`}>
        <div className="field">
          <label htmlFor="date">{t('subPacket.date')}</label>
          <input id="date" name="date" type="date" defaultValue={date} />
        </div>
        <button type="submit" className="button">
          {t('subPacket.print')}
        </button>
      </form>
      <h2>{t('subPacket.subNotes')}</h2>
      <SubPacketForm locale={locale} classId={cls.id} notes={notes} />
    </section>
  );
}
