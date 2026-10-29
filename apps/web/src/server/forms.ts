import { z } from 'zod';
import { err, ok, planIds, type Result } from '@thp/domain';
import { defaultLocale, isLocale, type Locale } from '@thp/i18n';

/** Form-level shape checks only; the domain and use cases apply the real rules. */
export type FieldErrors = Readonly<Record<string, 'required' | 'invalid_format'>>;

export const text = z.string({ error: 'required' }).trim().min(1, 'required');
export const optional = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()));
export const locale = z
  .string()
  .optional()
  .transform((value): Locale => (isLocale(value) ? value : defaultLocale));

export const signUpForm = z.object({ name: text, email: text, password: text, locale });
export const logInForm = z.object({ email: text, password: text, locale });
export const profileForm = z.object({ name: text, language: text, locale });
export const schoolForm = z.object({
  name: text,
  address: optional,
  phone: optional,
  email: optional,
  locale,
});
export const upgradeForm = z.object({
  plan: z.enum(planIds, { error: 'invalid_format' }),
  quantity: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value === '' ? 1 : Number(value)))
    .pipe(z.number({ error: 'invalid_format' }).int('invalid_format').positive('invalid_format')),
  locale,
});

const codeFor = (message: string): 'required' | 'invalid_format' =>
  message === 'required' ? 'required' : 'invalid_format';

export function parseForm<T>(schema: z.ZodType<T>, data: FormData): Result<T, FieldErrors> {
  // A repeated field (a group of checkboxes) becomes a list of its values.
  const fields: Record<string, string | string[]> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value !== 'string') continue;
    const current = fields[key];
    fields[key] =
      current === undefined ? value : [...(Array.isArray(current) ? current : [current]), value];
  }
  const parsed = schema.safeParse(fields);
  if (parsed.success) return ok(parsed.data);
  const errors: Record<string, 'required' | 'invalid_format'> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= codeFor(issue.message);
  }
  return err(errors);
}
