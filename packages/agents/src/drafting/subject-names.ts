import type { AssistantSubject } from '@thp/domain';

/** How each subject is named to the model. */
export const subjectNames: Readonly<Record<AssistantSubject, string>> = {
  math: 'Mathematics',
  ela: 'English Language Arts',
  science: 'Science',
  social_studies: 'Social Studies',
  spanish: 'Spanish',
  english_language: 'English as a second language',
  art: 'Art',
  music: 'Music',
  physical_education: 'Physical Education',
  technology: 'Technology',
  other: 'General',
};
