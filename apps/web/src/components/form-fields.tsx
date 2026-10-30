'use client';

// Small form controls shared by the app's feature forms.

export interface Option {
  readonly id: string;
  readonly name: string;
}

export function Hidden({ values }: { readonly values: Readonly<Record<string, string>> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function ErrorText({
  id,
  message,
}: {
  readonly id: string;
  readonly message?: string | undefined;
}) {
  return message ? (
    <p id={`${id}-error`} className="field-error">
      {message}
    </p>
  ) : null;
}

export function TextArea(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly defaultValue?: string | null | undefined;
  readonly error?: string | undefined;
  readonly hint?: string;
  readonly rows?: number;
}) {
  const { id, name, label, defaultValue, error, hint, rows = 3 } = props;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      <ErrorText id={id} message={error} />
    </div>
  );
}

export function Checks<T extends string | number>(props: {
  readonly legend: string;
  readonly name: string;
  readonly values: readonly T[];
  readonly chosen: readonly (string | number)[] | undefined;
  readonly label: (value: T) => string;
  readonly error?: string | undefined;
}) {
  const chosen = new Set(props.chosen ?? []);
  return (
    <fieldset className="checks">
      <legend>{props.legend}</legend>
      {props.values.map((value) => (
        <label key={String(value)} className="checkbox">
          <input
            type="checkbox"
            name={props.name}
            value={String(value)}
            defaultChecked={chosen.has(value)}
          />{' '}
          {props.label(value)}
        </label>
      ))}
      {props.error ? <p className="field-error">{props.error}</p> : null}
    </fieldset>
  );
}

export function Select(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly options: readonly Option[];
  readonly empty?: string;
  readonly defaultValue?: string | null | undefined;
  readonly error?: string | undefined;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <select id={props.id} name={props.name} defaultValue={props.defaultValue ?? ''}>
        {props.empty === undefined ? null : <option value="">{props.empty}</option>}
        {props.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <ErrorText id={props.id} message={props.error} />
    </div>
  );
}

export type Errors = Readonly<Record<string, string>> | undefined;
