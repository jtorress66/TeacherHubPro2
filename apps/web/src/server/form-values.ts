// What a teacher sent in a form, handed back with a validation error so the form shows it again.
// React resets a form after its action runs, so without this every field would fall back to its
// default. Used by server actions (submittedValues) and by the forms themselves (prefill).

/** A form's fields as sent: one value, or a list for repeated names (checkbox groups). */
export type SubmittedValues = Readonly<Record<string, string | readonly string[]>>;

/** Fields never sent back to the browser: secrets, and the framework's own action fields. */
const privateFields = /password|token|secret|^key$|apikey/i;

/** The text fields of a submitted form, without files, secrets or framework fields. */
export function submittedValues(data: FormData): SubmittedValues {
  const values: Record<string, string | string[]> = {};
  for (const [name, value] of data.entries()) {
    if (typeof value !== 'string' || name.startsWith('$') || privateFields.test(name)) continue;
    const earlier = values[name];
    if (earlier === undefined) values[name] = value;
    else values[name] = [...(Array.isArray(earlier) ? earlier : [earlier]), value];
  }
  return values;
}

/** Reads a form's starting values: what was sent last when there is one, else the defaults. */
export interface Prefill {
  /** A text, number or select field. */
  text(name: string, fallback?: string | number | null): string | undefined;
  /** A checkbox: ticked when it was sent (an unticked box is not sent). */
  checked(name: string, fallback?: boolean): boolean;
  /** Every value sent under a name (a checkbox group or a multiple select). */
  all(name: string, fallback?: readonly string[]): readonly string[];
  /**
   * Changes when the values sent change. Used as the form's `key`, so the form starts again from
   * them: a select ignores a new `defaultValue` once shown.
   */
  readonly key: string;
}

const listOf = (value: string | readonly string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === 'string' ? [value] : value;

/** A short, stable fingerprint of the values (not for security). */
function fingerprint(values: SubmittedValues): string {
  const text = JSON.stringify(Object.entries(values));
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  return `sent-${hash.toString(36)}-${String(text.length)}`;
}

export function prefill(values: SubmittedValues | undefined): Prefill {
  if (values === undefined) {
    return {
      text: (_name, fallback) =>
        fallback === undefined || fallback === null ? undefined : String(fallback),
      checked: (_name, fallback = false) => fallback,
      all: (_name, fallback = []) => fallback,
      key: '',
    };
  }
  return {
    text: (name, fallback) => {
      const [first] = listOf(values[name]);
      if (first !== undefined) return first;
      return fallback === undefined || fallback === null ? undefined : String(fallback);
    },
    checked: (name) => values[name] !== undefined,
    all: (name) => listOf(values[name]),
    key: fingerprint(values),
  };
}
