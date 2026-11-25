import type { StandardInfo } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { saveAssignmentStandardsAction } from '../app/_lib/assignment-standards-actions.ts';
import type { StandardsProblem } from '../server/assignment-standards-form.ts';
import { standardSourceName } from '../server/standard-source.ts';
import { Field } from './forms.tsx';

interface Props {
  readonly locale: Locale;
  readonly classId: string;
  readonly assignmentId: string;
  readonly standards: readonly StandardInfo[];
  readonly suggestions: readonly StandardInfo[];
  readonly editable: boolean;
  readonly saved: boolean;
  readonly problem: StandardsProblem | null;
}

/** The standards an assignment tests: shown to everyone who may see it, changed by its teacher. */
export function AssignmentStandards(props: Props) {
  const t = createTranslator(props.locale);
  const { standards, suggestions, editable } = props;
  const sourceName = (info: StandardInfo) => standardSourceName(props.locale, info);

  const hidden = (
    <>
      <input type="hidden" name="locale" value={props.locale} />
      <input type="hidden" name="classId" value={props.classId} />
      <input type="hidden" name="assignmentId" value={props.assignmentId} />
      {standards.map((info) => (
        <input key={info.code} type="hidden" name="standards" value={info.code} />
      ))}
    </>
  );

  return (
    <section className="card stack" aria-labelledby="standards-heading">
      <h2 id="standards-heading">{t('standards.assignmentTitle')}</h2>
      {editable ? <p className="muted">{t('standards.assignmentHint')}</p> : null}
      {props.saved ? <p role="status">{t('standards.assignmentSaved')}</p> : null}
      {props.problem === null ? null : (
        <p role="alert" className="notice">
          {t(
            props.problem === 'tooLong'
              ? 'standards.assignmentTooLong'
              : 'standards.assignmentTooMany',
          )}
        </p>
      )}
      {standards.length === 0 ? (
        <p className="muted">{t('standards.assignmentNone')}</p>
      ) : (
        <ul className="list standard-tags" aria-label={t('standards.assignmentTitle')}>
          {standards.map((info) => (
            <li key={info.code}>
              <strong>{info.code}</strong> <span className="muted">· {sourceName(info)}</span>
              {info.description === null ? null : <p className="muted">{info.description}</p>}
              {editable ? (
                <form action={saveAssignmentStandardsAction}>
                  {hidden}
                  <input type="hidden" name="remove" value={info.code} />
                  <button
                    type="submit"
                    className="button secondary"
                    aria-label={t('standards.assignmentRemove', { code: info.code })}
                  >
                    ×
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <>
          <form action={saveAssignmentStandardsAction} className="stack">
            {hidden}
            <Field
              id="standards-add"
              name="add"
              label={t('standards.assignmentCode')}
              hint={t('standards.assignmentCodeHint')}
              autoComplete="off"
            />
            <p>
              <button type="submit" className="button">
                {t('standards.assignmentAdd')}
              </button>
            </p>
          </form>
          {suggestions.length === 0 ? null : (
            <form action={saveAssignmentStandardsAction} className="stack">
              {hidden}
              <h3>{t('standards.assignmentPlanned')}</h3>
              <ul className="list standard-suggestions">
                {suggestions.map((info) => (
                  <li key={info.code}>
                    <button
                      type="submit"
                      name="add"
                      value={info.code}
                      className="button secondary"
                      aria-label={t('standards.assignmentAddPlanned', { code: info.code })}
                      title={info.description ?? undefined}
                    >
                      + {info.code}
                    </button>
                  </li>
                ))}
              </ul>
            </form>
          )}
        </>
      ) : null}
    </section>
  );
}
