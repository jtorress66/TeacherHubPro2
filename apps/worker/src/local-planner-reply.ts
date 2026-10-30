import type { LlmRequest } from '@thp/ports';

// The scripted reply the local stand-in gives the lesson planner, so local runs and E2E tests
// draft a plan without calling Claude. It cites the first official code the prompt offers.

const codeLine = /^(CCSS\.[^:\s]+):/m;

const day = (theme: string, minutes: number) => ({
  theme,
  dok: [1, 2],
  activities: [{ type: 'brainstorming', notes: `${theme} (${String(minutes)} min)` }],
  materials: ['notebook'],
  notes: `**${theme}**\n\n| Step | Minutes |\n|---|---|\n| ${theme} | ${String(minutes)} |\n\nExit ticket: I learned ___`,
});

const weekly = (prompt: string) => {
  const code = codeLine.exec(prompt)?.[1];
  return {
    unit: 'Local draft unit',
    objective: 'Students explain the topic in their own words.',
    skills: ['Vocabulary', 'Reasoning'],
    standards: code === undefined ? [] : [code],
    expectations: 'Students show their work.',
    days: [
      day('Introduction', 10),
      day('Guided practice', 15),
      day('Independent practice', 20),
      day('Mastery', 20),
      day('Assessment', 15),
    ],
  };
};

const conversational = {
  title: 'Local draft lesson',
  topic: 'Everyday conversation',
  learningObjectives: 'Students greet and introduce themselves.',
  materials: 'Name cards',
  hook: 'Find someone who ___',
  learningGoal: 'I can introduce myself.',
  closure: 'Pair role play',
  notes: 'Practice: "Hello, my name is ___."',
};

export function localPlannerReply(request: LlmRequest): string {
  const prompt = request.messages[0]?.content ?? '';
  return JSON.stringify(
    prompt.includes('Conversational English') ? conversational : weekly(prompt),
  );
}
