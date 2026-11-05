import {
  isGradeLevel,
  isLanguage,
  planWeekdays,
  type Class,
  type ClassId,
  type EmailTemplate,
  type GradeCategoryId,
  type GradeLevel,
  type ParentEmail,
  type PrepOptions,
  type PrepRequestInput,
  type StandardSubject,
} from '@thp/domain';
import { createTranslator, defaultLocale, isLocale, type Locale } from '@thp/i18n';

// Form shapes for the prep agent. Only the shape is read here: the domain checks the values.

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};

const all = (data: FormData, name: string): string[] =>
  data.getAll(name).filter((value): value is string => typeof value === 'string');

const pageLocale = (data: FormData): Locale => {
  const value = data.get('locale');
  return isLocale(value) ? value : defaultLocale;
};

const optionNames = ['presentations', 'worksheets', 'quiz', 'parentEmail'] as const;

/** The request without its email wording, which the action adds once it knows the class. */
export type PrepFormInput = Omit<PrepRequestInput, 'emailTemplate'>;

export function parsePrepForm(data: FormData): { locale: Locale; input: PrepFormInput } {
  const locale = pageLocale(data);
  const ticked = new Set(all(data, 'options'));
  const options = Object.fromEntries(
    optionNames.map((name) => [name, ticked.has(name)]),
  ) as unknown as PrepOptions;
  const category = field(data, 'quizCategoryId');
  const language = field(data, 'language');
  const days = field(data, 'days');
  return {
    locale,
    input: {
      classId: field(data, 'classId') as ClassId,
      prompt: field(data, 'prompt'),
      weekStart: field(data, 'weekStart'),
      subject: field(data, 'subject'),
      grade: field(data, 'grade'),
      days: days === '' ? Number.NaN : Number(days),
      options,
      quizCategoryId: category === '' ? null : (category as GradeCategoryId),
      language: isLanguage(language) ? language : locale,
    },
  };
}

/** The parent email's fixed wording, in the language the batch is written in. */
export function prepEmailTemplate(
  language: Locale,
  names: { readonly className: string; readonly teacherName: string },
): EmailTemplate {
  const t = createTranslator(language);
  return {
    subject: t('prep.emailSubject', { className: names.className }),
    greeting: t('prep.emailGreeting'),
    intro: t('prep.emailIntro', { className: names.className }),
    quizLine: t('prep.emailQuizLine'),
    signOff: t('prep.emailSignOff', { name: names.teacherName }),
    dayLabels: planWeekdays.map((day) => t(`planner.day_${day}`)),
  };
}

/** The items the teacher kept, and the email when the form has one. */
export function parseEmailForm(data: FormData): {
  keep: string[];
  email?: ParentEmail;
} {
  const keep = all(data, 'keep');
  if (!data.has('emailSubject')) return { keep };
  return { keep, email: { subject: field(data, 'emailSubject'), body: field(data, 'emailBody') } };
}

/** Words in a class's free-text subject that point to a Common Core subject. */
const subjectWords: readonly [StandardSubject, RegExp][] = [
  ['math', /math|matem|álgebra|algebra|geometr/iu],
  ['science', /scien|cienc|biolog|chem|quím|physic|físic/iu],
  ['social_studies', /social|histor|geograph|geograf|civic|cívic/iu],
  ['ela', /\bela\b|english|reading|language arts|lectura|literat/iu],
];

/** The class's subject and grade as form choices, when they match one. */
export function classDefaults(cls: Pick<Class, 'subject' | 'grade'>): {
  subject: StandardSubject | null;
  grade: GradeLevel | null;
} {
  const subjectText = cls.subject ?? '';
  const subject = subjectWords.find(([, words]) => words.test(subjectText))?.[0] ?? null;
  const gradeText = (cls.grade ?? '').trim().replace(/(st|nd|rd|th|°|º)$/iu, '');
  return { subject, grade: isGradeLevel(gradeText) ? gradeText : null };
}
