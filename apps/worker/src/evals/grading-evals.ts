import {
  averageOf,
  extractorMetrics,
  failingMetrics,
  graderMetrics,
  QuestionExtractor,
  reviewExtraction,
  reviewScores,
  scoreExtraction,
  scoreGrading,
  SubmissionGrader,
  type ExpectedExtraction,
  type ExtractorMetric,
  type GraderMetric,
  type ScoreBands,
} from '@thp/agents';
import {
  leniencyFor,
  type AnswerToGrade,
  type GradingRequest,
  type Language,
  type QuestionId,
} from '@thp/domain';
import type { LlmClient } from '@thp/ports';
import { problemOf, Recording, type CaseResult, type EvalReport } from './eval-report.ts';

/** Fixed tests as a PDF's text, each with the questions a careful reader would find. */
export const extractorCases: readonly ({
  readonly name: string;
  readonly text: string;
  readonly language: Language;
} & ExpectedExtraction)[] = [
  {
    name: 'science quiz with a word bank (en)',
    language: 'en',
    text: [
      'Plants Quiz — Grade 4',
      'A. Vocabulary (6 pts). Word bank: roots, leaves, stem',
      '1. The ___ take in water from the soil.',
      '2. The ___ make food using sunlight.',
      '3. The ___ holds the plant up.',
      'B. True or false (4 pts)',
      '4. Plants need sunlight to make food.',
      '5. All plants grow from seeds in water.',
    ].join('\n'),
    types: ['fill_blank', 'fill_blank', 'fill_blank', 'true_false', 'true_false'],
    instructionsContain: 'roots, leaves, stem',
  },
  {
    name: 'vocabulary with options (es)',
    language: 'es',
    text: [
      'Examen de vocabulario — Los animales',
      'I. Selección múltiple',
      '1. ¿Qué animal vive en el agua? a) perro b) pez c) gato',
      '2. ¿Qué animal vuela? a) águila b) vaca c) caballo',
      'II. Completa la oración',
      '3. El ___ es el rey de la selva.',
    ].join('\n'),
    types: ['multiple_choice', 'multiple_choice', 'fill_blank'],
    instructionsContain: null,
  },
  {
    name: 'matching and short answer (fr)',
    language: 'fr',
    text: [
      'Contrôle — Les capitales',
      '1. Relie chaque pays à sa capitale : France, Espagne, Italie / Rome, Paris, Madrid',
      '2. Pourquoi Paris est-elle une ville importante ? Réponds en deux phrases.',
    ].join('\n'),
    types: ['matching', 'short_answer'],
    instructionsContain: null,
  },
  {
    name: 'reading passage with an essay (zh)',
    language: 'zh',
    text: [
      '阅读理解 — 小蝌蚪找妈妈',
      '短文：小蝌蚪在池塘里游来游去，它们要去找妈妈……',
      '1. 小蝌蚪在哪里？ A. 池塘 B. 树上 C. 天上',
      '2. 用三句话写一写你喜欢的动物。',
    ].join('\n'),
    types: ['multiple_choice', 'essay'],
    instructionsContain: '小蝌蚪在池塘里',
  },
];

const answer = (
  id: string,
  type: AnswerToGrade['type'],
  points: number,
  prompt: string,
  given: string,
  guide: string | null = null,
): AnswerToGrade => ({ id: id as QuestionId, type, points, prompt, answer: given, guide });

/** Fixed answers with the share of points a fair teacher would give each. */
export const graderCases: readonly {
  readonly name: string;
  readonly grade: string;
  readonly language: Language;
  readonly questions: readonly AnswerToGrade[];
  readonly bands: ScoreBands;
}[] = [
  {
    name: 'a strong and a blank-ish answer (en)',
    grade: '5',
    language: 'en',
    questions: [
      answer(
        'q1',
        'short_answer',
        5,
        'Why do we have seasons?',
        'Because the Earth is tilted, so places get more or less direct sunlight during the year.',
        'The tilt of the Earth’s axis.',
      ),
      answer(
        'q2',
        'short_answer',
        5,
        'Name one source of renewable energy.',
        'I like pizza.',
        'Sun, wind or water.',
      ),
    ],
    bands: { q1: [0.8, 1], q2: [0, 0.2] },
  },
  {
    name: 'an essay graded gently for grade 2 (es)',
    grade: '2',
    language: 'es',
    questions: [
      answer(
        'q1',
        'essay',
        10,
        'Escribe sobre tu animal favorito.',
        'mi animal faborito es el perro porque es bonito y juega con migo y lo quiero mucho',
        'Tres oraciones sobre el animal y por qué le gusta.',
      ),
    ],
    bands: { q1: [0.6, 1] },
  },
  {
    name: 'a partial answer (fr)',
    grade: '8',
    language: 'fr',
    questions: [
      answer(
        'q1',
        'short_answer',
        4,
        'Cite deux causes de la Révolution française.',
        'Les impôts trop élevés.',
        'Les inégalités entre les ordres et la crise financière.',
      ),
    ],
    bands: { q1: [0.25, 0.75] },
  },
  {
    name: 'a well-argued essay (de)',
    grade: '10',
    language: 'de',
    questions: [
      answer(
        'q1',
        'essay',
        10,
        'Sollte die Schule später beginnen? Begründe deine Meinung.',
        'Ja, die Schule sollte später beginnen. Studien zeigen, dass Jugendliche später müde werden und mehr Schlaf brauchen. Wenn sie ausgeschlafen sind, lernen sie besser und sind gesünder. Ein späterer Beginn kann aber den Nachmittag verkürzen, deshalb sollte man den Stundenplan anpassen.',
        'These, zwei Argumente, ein Gegenargument, Schluss.',
      ),
    ],
    bands: { q1: [0.7, 1] },
  },
  {
    name: 'a wrong short answer (it)',
    grade: '6',
    language: 'it',
    questions: [answer('q1', 'short_answer', 3, 'Qual è la capitale d’Italia?', 'Milano', 'Roma')],
    bands: { q1: [0, 0.34] },
  },
  {
    name: 'a short essay (zh)',
    grade: '4',
    language: 'zh',
    questions: [
      answer(
        'q1',
        'essay',
        6,
        '写一写你的周末。',
        '周末我和爸爸妈妈去公园，我们放风筝，还吃了冰淇淋，我很开心。',
        '写清楚做了什么和感受。',
      ),
    ],
    bands: { q1: [0.6, 1] },
  },
];

export type ExtractorReport = EvalReport<ExtractorMetric>;
export type GraderReport = EvalReport<GraderMetric>;

export async function runExtractorEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<ExtractorMetric, number>>,
  cases: typeof extractorCases = extractorCases,
): Promise<ExtractorReport> {
  const results: CaseResult<ExtractorMetric>[] = [];
  for (const { name, text, language, ...expected } of cases) {
    const recording = new Recording(llm);
    const test = await new QuestionExtractor(recording).extract({ text, language });
    results.push({
      name,
      scores: scoreExtraction(expected, test.ok ? test.value : null),
      problem: problemOf(test, () => reviewExtraction(recording.lastReply)),
    });
  }
  const average = averageOf(
    extractorMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}

export async function runGraderEvals(
  llm: LlmClient,
  thresholds: Readonly<Record<GraderMetric, number>>,
  cases: typeof graderCases = graderCases,
): Promise<GraderReport> {
  const results: CaseResult<GraderMetric>[] = [];
  for (const { name, grade, language, questions, bands } of cases) {
    const request: GradingRequest = { language, leniency: leniencyFor(grade), questions };
    const recording = new Recording(llm);
    const graded = await new SubmissionGrader(recording).grade(request);
    results.push({
      name,
      scores: scoreGrading(request, bands, graded.ok ? graded.value : null),
      problem: problemOf(graded, () => reviewScores(request, recording.lastReply)),
    });
  }
  const average = averageOf(
    graderMetrics,
    results.map((r) => r.scores),
  );
  return { cases: results, average, failing: failingMetrics(average, thresholds) };
}
