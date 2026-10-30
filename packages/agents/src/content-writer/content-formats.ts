import type { ContentRequest, ContentType } from '@thp/domain';

/** What each content type asks the model for. A new type adds an entry here. */
export const contentFormats: Readonly<Record<ContentType, (request: ContentRequest) => string>> = {
  lesson_plan: () =>
    [
      'Write a complete lesson plan for one class period.',
      'Sections: ## Learning objectives, ## Materials, ## Warm-up, ## Direct instruction,',
      '## Guided practice, ## Independent practice, ## Assessment, ## Closure, ## Differentiation.',
      'Give each activity its minutes so the times add up to the class period.',
    ].join('\n'),
  quiz: (request) =>
    [
      `Write a quiz with exactly ${String(request.questionCount ?? 10)} questions.`,
      'Mix question types (multiple choice with options a) to d), true/false, short answer).',
      'Put them under ## Questions, numbered 1. to the last, one question per number.',
      'Then add ## Answer key with the answer to each question, using the same numbers.',
    ].join('\n'),
  summary: () =>
    [
      'Write a teacher-ready summary of the topic.',
      'Sections: ## Key ideas, ## Vocabulary (a table of term and meaning), ## Examples,',
      '## Common misconceptions, ## Discussion questions.',
    ].join('\n'),
  activities: () =>
    [
      'Write three to five engaging classroom activities.',
      'For each activity, a ### heading, then: type, minutes, materials, step-by-step',
      'instructions, what students learn, and how to check understanding.',
    ].join('\n'),
  worksheet: () =>
    [
      'Write a printable worksheet for students.',
      'Start with the title and a line for Name: ___ and Date: ___, then short instructions.',
      'Give three or four sections of exercises from easy to harder, using ___ for blanks.',
      'End with ## Answer key for the teacher.',
    ].join('\n'),
};
