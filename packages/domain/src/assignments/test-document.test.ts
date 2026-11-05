import { describe, expect, it } from 'vitest';
import type { Question } from '../gradebook/question.ts';
import type { QuestionId } from '../shared/ids.ts';
import { renderTestDocument, type TestDocumentLabels } from './test-document.ts';

const labels: TestDocumentLabels = {
  name: 'Name',
  date: 'Date',
  answer: 'Answer',
  true: 'True',
  false: 'False',
  points: '{points} pts',
};

const id = (n: number) => `q${String(n)}` as QuestionId;
const common = (n: number, instructions: string | null = null) => ({
  id: id(n),
  points: 2,
  instructions,
});

const render = (questions: readonly Question[], instructions: string | null = null) =>
  renderTestDocument({ title: 'Chapter 3 – Try It!', instructions, questions }, labels);

describe('renderTestDocument', () => {
  it('starts with the title, name and date lines, and the general instructions', () => {
    const html = render([], 'Read every question.');
    expect(html).toContain('<h1>Chapter 3 – Try It!</h1>');
    expect(html).toContain('Name: ____________________');
    expect(html).toContain('Date: ____________');
    expect(html).toContain('<p>Read every question.</p>');
  });

  it('lays out matching as a two-column table whose right side does not give the pairs away', () => {
    const html = render([
      {
        ...common(1, 'A. Matching Definitions'),
        type: 'matching',
        prompt: 'Match each word to its definition.',
        pairs: [
          { left: 'comfort zones', right: 'places where we feel safe' },
          { left: 'risks', right: 'the chance of something bad' },
          { left: 'capable', right: 'able to do something successfully' },
        ],
      },
    ]);
    expect(html).toContain('<table');
    expect(html).toContain('<td>______ 1. comfort zones</td>');
    expect(html).toContain('<td>a. able to do something successfully</td>');
    expect(html).toContain('<td>b. places where we feel safe</td>');
    expect(html).toContain('<td>______ 3. capable</td><td>c. the chance of something bad</td>');
  });

  it('gives each question its number, points and room to answer', () => {
    const html = render([
      {
        ...common(1),
        type: 'multiple_choice',
        prompt: 'Which is safe?',
        options: ['home', 'a cliff'],
        correctOption: 0,
      },
      { ...common(2), type: 'true_false', prompt: 'Risks can help us grow.', answer: true },
      {
        ...common(3),
        type: 'fill_blank',
        prompt: 'I felt ___ on stage.',
        acceptedAnswers: ['shy'],
      },
      { ...common(4), type: 'short_answer', prompt: 'Name a risk.', modelAnswer: 'Skydiving' },
      { ...common(5), type: 'essay', prompt: 'Describe your comfort zone.', rubric: 'Clear' },
    ]);
    expect(html).toContain('<p><b>1.</b> Which is safe? <i>(2 pts)</i></p>');
    expect(html).toContain('<p>☐ a) home</p><p>☐ b) a cliff</p>');
    expect(html).toContain('<p>☐ True &nbsp;&nbsp; ☐ False</p>');
    expect(html).toContain('<p><b>3.</b> I felt ___ on stage. <i>(2 pts)</i></p>');
    expect(html).toContain('Answer: ______________________________');
    expect(html.match(/<p>_{60}<\/p>/g)).toHaveLength(2 + 8);
  });

  it('never includes an answer key', () => {
    const html = render([
      {
        ...common(1),
        type: 'multiple_choice',
        prompt: 'Pick',
        options: ['x', 'y'],
        correctOption: 1,
      },
      { ...common(2), type: 'fill_blank', prompt: 'Fill ___', acceptedAnswers: ['SECRET-FILL'] },
      { ...common(3), type: 'short_answer', prompt: 'Why?', modelAnswer: 'SECRET-MODEL' },
      { ...common(4), type: 'essay', prompt: 'Write', rubric: 'SECRET-RUBRIC' },
    ]);
    expect(html).not.toMatch(/SECRET/);
    expect(html).not.toMatch(/correct/i);
  });

  it('shows a section once for the questions that share it, and boxes its word bank', () => {
    const section = 'B. Choosing the Right Word\nWord bank: avoid, shy, proud';
    const html = render([
      {
        ...common(1, section),
        type: 'fill_blank',
        prompt: 'Do not ___ it.',
        acceptedAnswers: ['avoid'],
      },
      { ...common(2, section), type: 'fill_blank', prompt: 'He is ___.', acceptedAnswers: ['shy'] },
      { ...common(3, 'C. Writing'), type: 'essay', prompt: 'Write.', rubric: null },
    ]);
    expect(html.match(/B\. Choosing the Right Word/g)).toHaveLength(1);
    expect(html).toContain(
      '<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%"><tr><td>Word bank: avoid, shy, proud</td></tr></table>',
    );
    expect(html).toContain('<h2>C. Writing</h2>');
  });

  it('escapes the teacher’s text', () => {
    const html = render([
      { ...common(1), type: 'short_answer', prompt: '<script>x</script> & "y"', modelAnswer: null },
    ]);
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;y&quot;');
    expect(html).not.toContain('<script>');
  });
});
