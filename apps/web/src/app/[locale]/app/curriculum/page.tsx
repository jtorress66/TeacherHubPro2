import type { Metadata } from 'next';
import type { CurriculumGuideEntry } from '@thp/application';
import { createTranslator, type Locale, type Translate } from '@thp/i18n';
import {
  CurriculumUploadForm,
  RefreshWhileReading,
} from '../../../../components/curriculum-forms.tsx';
import { TableScroll } from '../../../../components/table-scroll.tsx';
import { getAppContainer } from '../../../../container.ts';
import { removeCurriculumAction } from '../../../_lib/curriculum-actions.ts';
import { requireUser } from '../../../_lib/auth.ts';
import { localeFrom, type LocaleParams } from '../../locale-param.ts';

export async function generateMetadata(props: LocaleParams): Promise<Metadata> {
  return { title: createTranslator(await localeFrom(props))('curriculum.title') };
}

function statusOf(guide: CurriculumGuideEntry, t: Translate): string {
  if (guide.status === 'reading') return t('curriculum.status_reading');
  if (guide.status === 'ready') return t('curriculum.status_ready');
  return `${t('curriculum.status_failed')}: ${t(`curriculum.failure_${guide.failure ?? 'unreadable'}`)}`;
}

function usageOf(guide: CurriculumGuideEntry, t: Translate, locale: Locale): string {
  if (guide.status !== 'ready') return '';
  const count = new Intl.NumberFormat(locale);
  const { used, total } = guide.usage;
  return used >= total
    ? t('curriculum.usedAll', { total: count.format(total) })
    : t('curriculum.usedPart', { used: count.format(used), total: count.format(total) });
}

/**
 * The school's own curriculum, one guide per subject and grade. Everyone in the school sees the
 * list; its admins and account owner add and remove guides.
 */
export default async function CurriculumPage(
  props: LocaleParams & { readonly searchParams: Promise<{ removed?: string }> },
) {
  const locale = await localeFrom(props);
  const t = createTranslator(locale);
  const { user } = await requireUser(locale);
  const { guides, canManage } = await getAppContainer().listCurriculumGuides.execute({
    actor: user,
  });
  const { removed } = await props.searchParams;
  const grade = (value: string) => (value === 'K' ? t('drafts.grade_K') : value);

  return (
    <section className="stack">
      <h1>{t('curriculum.title')}</h1>
      <p>{t('curriculum.intro')}</p>
      {canManage ? null : <p className="muted">{t('curriculum.readOnly')}</p>}
      {removed === '1' ? (
        <p role="status" className="notice">
          {t('curriculum.removed')}
        </p>
      ) : null}
      {guides.some((g) => g.status === 'reading') ? <RefreshWhileReading /> : null}

      <section className="stack" aria-labelledby="guides-heading">
        <h2 id="guides-heading">{t('curriculum.listHeading')}</h2>
        {guides.length === 0 ? (
          <p className="muted">{t('curriculum.empty')}</p>
        ) : (
          <TableScroll>
            <table className="roster" aria-label={t('curriculum.listHeading')}>
              <thead>
                <tr>
                  <th scope="col">{t('curriculum.col_subject')}</th>
                  <th scope="col">{t('curriculum.col_grade')}</th>
                  <th scope="col">{t('curriculum.col_title')}</th>
                  <th scope="col">{t('curriculum.col_source')}</th>
                  <th scope="col">{t('curriculum.col_status')}</th>
                  <th scope="col">{t('curriculum.col_used')}</th>
                  {canManage ? (
                    <th scope="col">
                      <span className="visually-hidden">{t('curriculum.remove')}</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {guides.map((guide) => (
                  <tr key={guide.id} data-testid="curriculum-row">
                    <td>{t(`assistant.subject_${guide.subject}`)}</td>
                    <td>{grade(guide.grade)}</td>
                    <th scope="row">{guide.title}</th>
                    <td>{guide.sourceName ?? t('curriculum.pasted')}</td>
                    <td>{statusOf(guide, t)}</td>
                    <td>{usageOf(guide, t, locale)}</td>
                    {canManage ? (
                      <td>
                        <form action={removeCurriculumAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="guideId" value={guide.id} />
                          <button
                            type="submit"
                            className="button secondary"
                            aria-label={t('curriculum.removeLabel', { title: guide.title })}
                          >
                            {t('curriculum.remove')}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        )}
      </section>

      {canManage ? (
        <section className="card stack" aria-labelledby="add-guide-heading">
          <h2 id="add-guide-heading">{t('curriculum.addHeading')}</h2>
          <CurriculumUploadForm locale={locale} />
        </section>
      ) : null}
    </section>
  );
}
