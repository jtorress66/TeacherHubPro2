import type { SampleText } from '../src/index.ts';

/** The sample class's words as the web app passes them in English. */
export const sampleText: SampleText = {
  className: 'Sample class: Grade 3 Math',
  subject: 'Math',
  students: ['Alex', 'Maya', 'Leo', 'Sofia', 'Sam', 'Nina'],
  categories: { homework: 'Homework', quiz: 'Quizzes', test: 'Tests', project: 'Projects' },
  homework: 'Equal shares',
  quiz: 'Naming fractions',
  onlineQuiz: 'Fractions check',
  choicePrompt: 'Which fraction shows one of four equal parts?',
  truePrompt: '1/2 is greater than 1/4.',
  explainPrompt: 'Explain why 1/2 is bigger than 1/3.',
  explainModel: 'Halves are bigger pieces than thirds of the same whole.',
  explainAnswer: 'Because when you cut into 2 the pieces are bigger.',
  explainFeedback: 'Good reasoning. Say that both fractions are of the same whole.',
  feedback: 'Strong work on fractions.',
  plan: {
    unit: 'Introduction to Fractions',
    objective: 'Students understand a fraction as equal parts of a whole.',
    skills: ['Equal parts', 'Numerator and denominator', 'Comparing fractions'],
    days: [
      ['Equal shares', 'Fold paper strips.'],
      ['Naming fractions', 'Write 1/4 and 3/4.'],
      ['Fractions on a number line', 'Stations.'],
      ['Comparing fractions', 'Use strips to compare.'],
      ['Show what you know', 'Exit ticket.'],
    ],
  },
  game: {
    title: 'Fraction challenge',
    prompts: [
      'Which fraction is one half?',
      'Which is the largest?',
      'How many fourths make a whole?',
      'Which fraction equals 2/4?',
      'A pizza has 8 equal slices. You eat 3. What fraction did you eat?',
    ],
  },
};
