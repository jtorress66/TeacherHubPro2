import { z } from 'zod';
import {
  isLanguage,
  type RubricCriterion,
  type RubricLevel,
  type RubricRequestInput,
} from '@thp/domain';
import { defaultLocale, isLocale, type Locale } from '@thp/i18n';

// Form shapes for rubrics. Only the shape is read here: the domain checks the values.

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const optional = (data: FormData, name: string): string | null => {
  const value = field(data, name);
  return value === '' ? null : value;
};

/** A number field: left out when blank, so the domain's default applies. */
const numberField = (data: FormData, name: string): Record<string, number> => {
  const value = field(data, name);
  return value === '' ? {} : { [name]: Number(value) };
};

export const pageLocale = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : defaultLocale;
};

export function parseRubricDraftForm(data: FormData): {
  locale: Locale;
  input: RubricRequestInput;
} {
  const locale = pageLocale(data);
  const language = field(data, 'language');
  return {
    locale,
    input: {
      topic: field(data, 'topic'),
      subject: optional(data, 'subject'),
      grade: optional(data, 'grade'),
      title: optional(data, 'title'),
      ...numberField(data, 'criteriaCount'),
      ...numberField(data, 'levelCount'),
      language: isLanguage(language) ? language : locale,
      esl: data.get('esl') === 'on',
      instructions: optional(data, 'instructions'),
    },
  };
}

const gridShape = z.object({
  levels: z.array(z.object({ label: z.string(), points: z.number() })),
  criteria: z.array(z.object({ name: z.string(), descriptors: z.array(z.string()) })),
});

/** The rubric editor sends its grid as JSON; anything else is null. */
export function parseRubricGrid(
  json: string,
): { levels: RubricLevel[]; criteria: RubricCriterion[] } | null {
  try {
    const parsed = gridShape.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
