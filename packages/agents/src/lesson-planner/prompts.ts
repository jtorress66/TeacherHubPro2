import type { DraftRequest, Language, StandardSubject } from '@thp/domain';

export const languageNames: Readonly<Record<Language, string>> = {
  en: 'English',
  es: 'Spanish (español)',
  fr: 'French (français)',
  pt: 'Portuguese (português)',
  de: 'German (Deutsch)',
  it: 'Italian (italiano)',
  zh: 'Simplified Chinese (简体中文)',
};

export const subjectNames: Readonly<Record<StandardSubject, string>> = {
  math: 'Mathematics',
  ela: 'English Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
};

export const systemPrompt = `You are an expert curriculum designer helping a teacher draft a lesson plan.
The teacher reviews and edits everything you write before using it.
Rules:
- Reply with one JSON object only, exactly in the shape asked for. No text before or after it.
- Write every text value in the language the teacher asks for.
- Cite only standards codes from the list you are given, copied exactly. If none fit, or no list is given, cite none.
- Never invent standards codes, grades, test scores, dates or facts about students.
- Be specific and practical: concrete activities with times and materials, ready to teach.
- Text values may use simple Markdown: short lists, **bold**, and small tables. Use ___ for blanks students fill in.`;

/** The lines every request shares: what to teach, to whom, and in which language. */
export function requestLines(request: DraftRequest): string[] {
  return [
    `Write in ${languageNames[request.language]}.`,
    ...(request.subject === null ? [] : [`Subject: ${subjectNames[request.subject]}`]),
    `Grade: ${request.grade === 'K' ? 'Kindergarten' : request.grade}`,
    `Topic: ${request.topic}`,
    `Difficulty: ${request.difficulty}`,
    `Class period: ${String(request.durationMinutes)} minutes`,
    ...(request.instructions === null ? [] : [`Teacher's instructions: ${request.instructions}`]),
  ];
}
