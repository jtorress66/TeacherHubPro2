import {
  averageOf,
  failingMetrics,
  reviewTranscription,
  scoreTranscription,
  TestTranscriber,
  transcriberMetrics,
  type ExpectedTranscription,
  type TranscriberMetric,
} from '@thp/agents';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed tests as a PDF's text (line breaks where the PDF wraps), each with what must survive. */
export const transcriberCases: readonly ({
  readonly name: string;
  readonly text: string;
} & ExpectedTranscription)[] = [
  {
    name: 'two-column matching, word bank, passage and writing (en)',
    text: [
      'Sunrise English - Book 2 Review Unit 5 – Brave Steps',
      'Student Name: ____________________ Date: ______________',
      'Section 1: Vocabulary',
      'A. Matching (4 points)',
      'Write the letter of the meaning next to',
      'each word.',
      'Words: Meanings:',
      '______ 1. brave a. not sure what to do',
      '______ 2. nervous b. ready to face danger',
      '______ 3. unsure c. worried and a little afraid',
      '______ 4. goal d. something you want to reach',
      'B. Word Bank (3 points)',
      'Complete each sentence with a word from the box.',
      'practice cheer dream',
      '1. We ______ for our team at every game.',
      '2. If you ______ every day, you will improve.',
      '3. Her ______ is to become a pilot.',
      'Sunrise English - Book 2 Review Unit 5 – Brave Steps',
      'Section 2: Reading',
      'A. True or False (2 points)',
      'Read the story. Then circle True or False.',
      'Leo stood at the edge of the stage. His hands were shaking, but',
      'he picked up the microphone and began to sing.',
      '1. Leo was calm and relaxed. (True / False)',
      '2. Leo decided to sing. (True / False)',
      'Section 3: Writing',
      'A. Your Turn (5 pts)',
      'Write about a time you were brave. Use two words from this unit.',
      'Example:',
      'I was nervous before my swim race, but I did it.',
      '______________________________________________',
      '______________________________________________',
      '______________________________________________',
    ].join('\n'),
    labels: ['1.', '2.', '3.', '1.', '2.'],
    contains: [
      'a. not sure what to do',
      'b. ready to face danger',
      '______ 4. goal',
      'Leo decided to sing.',
      'I was nervous before my swim race, but I did it.',
    ],
  },
  {
    name: 'true or false and a word bank (es)',
    text: [
      'Ciencias 4 Examen de ciencias — Los volcanes',
      'Nombre: ______________ Fecha: __________',
      'I. Cierto o falso (3 puntos)',
      'Lee cada oración y encierra la respuesta correcta.',
      '1. La lava es roca derretida. (Cierto / Falso)',
      '2. Todos los volcanes están activos. (Cierto / Falso)',
      '3. El magma está debajo de la tierra. (Cierto / Falso)',
      'II. Completa (2 puntos)',
      'Usa las palabras del recuadro.',
      'ceniza cráter',
      '4. El ______ es la abertura en la cima del volcán.',
      '5. La ______ cubre los pueblos cercanos.',
    ].join('\n'),
    labels: ['1.', '2.', '3.', '4.', '5.'],
    contains: ['Todos los volcanes están activos.', 'La ______ cubre los pueblos cercanos.'],
  },
  {
    name: 'passage with choices and an open question (en)',
    text: [
      'Reading Check — The Lost Kite',
      "Mia's red kite flew over the park until the wind pulled it into a tall",
      'oak tree. Her brother found a long stick and helped her get it down.',
      '1. Where did the kite get stuck? a) a roof b) a tree c) a fence',
      '2. Who helped Mia? a) her friend b) her mother c) her brother',
      '3. How do you think Mia felt at the end? Explain.',
      '________________________________________',
      '________________________________________',
    ].join('\n'),
    labels: ['1.', '2.', '3.'],
    contains: ['a) a roof b) a tree c) a fence', 'How do you think Mia felt at the end? Explain.'],
  },
];

export type TranscriberReport = EvalReport<TranscriberMetric>;

export async function runTranscriberEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<TranscriberMetric, number>>,
  cases: typeof transcriberCases = transcriberCases,
): Promise<TranscriberReport> {
  const results: CaseResult<TranscriberMetric>[] = [];
  for (const { name, text, ...expected } of cases) {
    const recording = new Recording(llm);
    const layout = await new TestTranscriber(recording).transcribe({ text });
    results.push({
      name,
      scores: scoreTranscription(expected, layout.ok ? layout.value : null, text),
      problem: problemOf(layout, () => reviewTranscription(recording.lastReply, text)),
    });
  }
  const average = averageOf(
    transcriberMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
