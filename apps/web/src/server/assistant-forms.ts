import { z } from 'zod';
import {
  isLanguage,
  type ClassId,
  type ContentRequestInput,
  type PresentationRequestInput,
  type SlideInput,
  type SubPacketInput,
} from '@thp/domain';
import { defaultLocale, isLocale, type Locale } from '@thp/i18n';

// Form shapes for the AI assistant, presentations and substitute packets. Only the shape is read
// here: the domain checks the values.

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

const pageLocale = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : defaultLocale;
};

/** The language the AI writes in: the one chosen on the form, else the page's. */
const languageOf = (data: FormData, locale: Locale): string => {
  const chosen = field(data, 'language');
  return isLanguage(chosen) ? chosen : locale;
};

export function parseContentForm(data: FormData): {
  locale: Locale;
  input: ContentRequestInput;
} {
  const locale = pageLocale(data);
  const difficulty = field(data, 'difficulty');
  return {
    locale,
    input: {
      type: field(data, 'type'),
      subject: field(data, 'subject'),
      grade: field(data, 'grade'),
      topic: field(data, 'topic'),
      ...(difficulty === '' ? {} : { difficulty }),
      ...numberField(data, 'durationMinutes'),
      ...numberField(data, 'questionCount'),
      language: languageOf(data, locale),
      instructions: optional(data, 'instructions'),
    },
  };
}

export function parsePresentationRequestForm(data: FormData): {
  locale: Locale;
  input: PresentationRequestInput;
} {
  const locale = pageLocale(data);
  const theme = field(data, 'theme');
  return {
    locale,
    input: {
      topic: field(data, 'topic'),
      subject: field(data, 'subject'),
      grade: field(data, 'grade'),
      ...numberField(data, 'slideCount'),
      ...(theme === '' ? {} : { theme }),
      language: languageOf(data, locale),
    },
  };
}

const slideShape = z.array(
  z.object({
    layout: z.string(),
    title: z.string().nullish(),
    subtitle: z.string().nullish(),
    content: z.string().nullish(),
    emoji: z.string().nullish(),
    bullets: z.array(z.string()).optional(),
    transition: z.string().optional(),
  }),
);

/** A slide with the fields that were left out removed (the types allow no explicit undefined). */
function withoutBlanks(slide: z.infer<typeof slideShape>[number]): SlideInput {
  const { layout, title, subtitle, content, emoji, bullets, transition } = slide;
  return {
    layout,
    ...(title === undefined ? {} : { title }),
    ...(subtitle === undefined ? {} : { subtitle }),
    ...(content === undefined ? {} : { content }),
    ...(emoji === undefined ? {} : { emoji }),
    ...(bullets === undefined ? {} : { bullets }),
    ...(transition === undefined ? {} : { transition }),
  };
}

/** The slide editor sends its slides as JSON; anything else is null. */
export function parseSlides(json: string): SlideInput[] | null {
  try {
    const parsed = slideShape.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.map(withoutBlanks) : null;
  } catch {
    return null;
  }
}

export function parseSubPacketForm(data: FormData): {
  locale: Locale;
  classId: ClassId;
  details: Omit<SubPacketInput, 'classId' | 'schoolId'>;
} {
  return {
    locale: pageLocale(data),
    classId: field(data, 'classId') as ClassId,
    details: {
      mainOfficeExt: optional(data, 'mainOfficeExt'),
      nurseExt: optional(data, 'nurseExt'),
      dailyRoutines: optional(data, 'dailyRoutines'),
      emergencyProcedures: optional(data, 'emergencyProcedures'),
      additionalNotes: optional(data, 'additionalNotes'),
      includeAccommodations: data.get('includeAccommodations') === 'on',
    },
  };
}
