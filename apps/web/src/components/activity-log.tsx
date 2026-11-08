import type { SchoolId, User } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { getAppContainer } from '../container.ts';
import { teacherTimeZone } from '../app/_lib/time-zone.ts';

/** A school's latest activity log, newest first, for its admins. */
export async function ActivityLog(props: {
  readonly locale: Locale;
  readonly actor: User;
  readonly schoolId: SchoolId;
  /** Who's who in the school, so the log shows names instead of IDs. */
  readonly names: ReadonlyMap<string, string>;
}) {
  const t = createTranslator(props.locale);
  const events = await getAppContainer().listActivity.execute({
    actor: props.actor,
    schoolId: props.schoolId,
  });
  if (!events.ok) return null;
  const when = new Intl.DateTimeFormat(props.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: await teacherTimeZone(),
  });

  return (
    <section className="card stack" aria-labelledby="activity-heading">
      <h2 id="activity-heading">{t('activity.title')}</h2>
      <p className="hint">{t('activity.intro')}</p>
      {events.value.length === 0 ? (
        <p>{t('activity.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="roster" aria-label={t('activity.title')}>
            <thead>
              <tr>
                <th scope="col">{t('activity.when')}</th>
                <th scope="col">{t('activity.who')}</th>
                <th scope="col">{t('activity.what')}</th>
              </tr>
            </thead>
            <tbody>
              {events.value.map((event) => (
                <tr key={event.id}>
                  <td>{when.format(event.at)}</td>
                  <td>{props.names.get(event.actorId) ?? t('activity.someone')}</td>
                  <td>{t(`activity.action_${event.action}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
