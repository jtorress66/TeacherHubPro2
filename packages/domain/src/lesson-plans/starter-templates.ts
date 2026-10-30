import type { Language } from '../shared/language.ts';
import type { StandardSubject } from '../standards/common-core.ts';
import type { ActivityType, PlanDayInput, WeeklyBodyInput } from './weekly-plan.ts';

type StarterLanguage = 'en' | 'es';

interface StarterText {
  readonly name: string;
  readonly description: string;
  readonly objective: string;
  readonly skills: readonly string[];
  /** Theme and notes for Monday to Friday. */
  readonly days: readonly (readonly [theme: string, notes: string])[];
}

/** A ready-made weekly plan a teacher can start from. */
export interface StarterTemplate {
  readonly id: string;
  readonly subject: StandardSubject;
  readonly grades: string;
  readonly standards: readonly string[];
  readonly activities: readonly (readonly ActivityType[])[];
  readonly text: Readonly<Record<StarterLanguage, StarterText>>;
}

const progression: readonly (readonly ActivityType[])[] = [
  ['brainstorming', 'building_background', 'vocabulary'],
  ['guided_reading', 'oral_questions'],
  ['exercise_practice', 'other'],
  ['comprehension_questions', 'exercise_practice'],
  ['oral_questions', 'other'],
];

export const starterTemplates: readonly [StarterTemplate, ...StarterTemplate[]] = [
  {
    id: 'fractions-intro',
    subject: 'math',
    grades: '3',
    standards: ['CCSS.Math.Content.3.NF.A.1', 'CCSS.Math.Content.3.NF.A.3'],
    activities: progression,
    text: {
      en: {
        name: 'Introduction to Fractions',
        description: 'A week that builds fractions from equal shares to comparing them.',
        objective:
          'Students understand a fraction as equal parts of a whole and compare simple fractions.',
        skills: ['Equal parts', 'Numerator and denominator', 'Comparing fractions'],
        days: [
          [
            'Equal shares',
            'Fold paper strips into halves, fourths and eighths.\n\nWord bank: whole, part, equal',
          ],
          [
            'Naming fractions',
            'Model writing 1/4 and 3/4.\n\n| Picture | Fraction |\n|---|---|\n| 1 of 4 parts | 1/4 |\n| 3 of 4 parts | 3/4 |',
          ],
          ['Fractions on a number line', 'Stations: number line, fraction circles, drawing.'],
          ['Comparing fractions', 'Use strips to compare: 1/2 ___ 1/4'],
          ['Show what you know', 'Exit ticket and self-reflection: I can ___'],
        ],
      },
      es: {
        name: 'Introducción a las fracciones',
        description: 'Una semana que va de partes iguales a comparar fracciones.',
        objective:
          'Los estudiantes entienden una fracción como partes iguales de un entero y comparan fracciones sencillas.',
        skills: ['Partes iguales', 'Numerador y denominador', 'Comparar fracciones'],
        days: [
          [
            'Partes iguales',
            'Doblar tiras de papel en medios, cuartos y octavos.\n\nVocabulario: entero, parte, igual',
          ],
          [
            'Nombrar fracciones',
            'Modelar cómo escribir 1/4 y 3/4.\n\n| Dibujo | Fracción |\n|---|---|\n| 1 de 4 partes | 1/4 |\n| 3 de 4 partes | 3/4 |',
          ],
          [
            'Fracciones en la recta numérica',
            'Estaciones: recta numérica, círculos de fracciones, dibujo.',
          ],
          ['Comparar fracciones', 'Usar tiras para comparar: 1/2 ___ 1/4'],
          ['Demuestra lo que sabes', 'Boleto de salida y autoevaluación: Yo puedo ___'],
        ],
      },
    },
  },
  {
    id: 'reading-comprehension',
    subject: 'ela',
    grades: '4',
    standards: ['CCSS.ELA-Literacy.RL.4.1', 'CCSS.ELA-Literacy.RL.4.2'],
    activities: progression,
    text: {
      en: {
        name: 'Reading Comprehension Strategies',
        description: 'Predict, question, infer and summarize with one shared story.',
        objective:
          'Students use evidence from the text to explain what it says and infer its theme.',
        skills: ['Predicting', 'Asking questions', 'Making inferences', 'Summarizing'],
        days: [
          ['Predict', 'Picture walk and predictions chart.'],
          ['Question', 'Think-aloud while reading; students write two questions.'],
          [
            'Infer',
            'Clue + what I know = inference.\n\n| Clue | What I know | Inference |\n|---|---|---|',
          ],
          ['Summarize', 'Somebody–Wanted–But–So–Then summary in pairs.'],
          ['Theme', 'Short passage quiz: the theme is ___ because ___'],
        ],
      },
      es: {
        name: 'Estrategias de comprensión lectora',
        description: 'Predecir, preguntar, inferir y resumir con un mismo cuento.',
        objective:
          'Los estudiantes usan evidencia del texto para explicar lo que dice e inferir su tema.',
        skills: ['Predecir', 'Hacer preguntas', 'Inferir', 'Resumir'],
        days: [
          ['Predecir', 'Recorrido por las imágenes y tabla de predicciones.'],
          ['Preguntar', 'Lectura en voz alta pensando; cada estudiante escribe dos preguntas.'],
          [
            'Inferir',
            'Pista + lo que sé = inferencia.\n\n| Pista | Lo que sé | Inferencia |\n|---|---|---|',
          ],
          ['Resumir', 'Resumen en parejas: Alguien–Quería–Pero–Entonces–Al final.'],
          ['Tema', 'Prueba corta: el tema es ___ porque ___'],
        ],
      },
    },
  },
  {
    id: 'scientific-method',
    subject: 'science',
    grades: '6-8',
    standards: ['CCSS.ELA-Literacy.RST.6-8.3', 'CCSS.ELA-Literacy.WHST.6-8.2'],
    activities: progression,
    text: {
      en: {
        name: 'Introduction to the Scientific Method',
        description: 'Students plan, run and report a simple experiment.',
        objective: 'Students follow a multistep procedure and write up an experiment.',
        skills: ['Asking testable questions', 'Variables', 'Recording data', 'Drawing conclusions'],
        days: [
          ['Questions and hypotheses', 'What makes a question testable? Sort examples.'],
          ['Variables', 'Identify independent and dependent variables in sample experiments.'],
          [
            'Run the experiment',
            'Paper towel absorbency lab.\n\n| Brand | Water absorbed (mL) |\n|---|---|',
          ],
          ['Analyze data', 'Graph results and compare with the hypothesis.'],
          ['Lab report', 'Write the conclusion: Our hypothesis was ___ because ___'],
        ],
      },
      es: {
        name: 'Introducción al método científico',
        description: 'Los estudiantes planifican, realizan y reportan un experimento sencillo.',
        objective:
          'Los estudiantes siguen un procedimiento de varios pasos y redactan un experimento.',
        skills: ['Preguntas comprobables', 'Variables', 'Registrar datos', 'Sacar conclusiones'],
        days: [
          [
            'Preguntas e hipótesis',
            '¿Qué hace que una pregunta sea comprobable? Clasificar ejemplos.',
          ],
          ['Variables', 'Identificar variables independientes y dependientes en ejemplos.'],
          [
            'Realizar el experimento',
            'Laboratorio de absorción de toallas de papel.\n\n| Marca | Agua absorbida (mL) |\n|---|---|',
          ],
          ['Analizar datos', 'Graficar los resultados y compararlos con la hipótesis.'],
          [
            'Informe de laboratorio',
            'Escribir la conclusión: Nuestra hipótesis fue ___ porque ___',
          ],
        ],
      },
    },
  },
  {
    id: 'writing-workshop',
    subject: 'ela',
    grades: '5',
    standards: ['CCSS.ELA-Literacy.W.5.3', 'CCSS.ELA-Literacy.W.5.5'],
    activities: progression,
    text: {
      en: {
        name: 'Writing Process Workshop',
        description: 'From brainstorm to published narrative in five days.',
        objective: 'Students plan, draft, revise and edit a short narrative.',
        skills: ['Planning', 'Drafting', 'Revising', 'Editing'],
        days: [
          ['Prewriting', 'Story map: characters, setting, problem, solution.'],
          ['Drafting', 'Write the beginning and middle without stopping to fix spelling.'],
          ['Revising', 'Peer conference: one star and one wish.'],
          ['Editing', 'Checklist: capitals, punctuation, spelling.'],
          ['Publishing', 'Author’s chair and reflection: Next time I will ___'],
        ],
      },
      es: {
        name: 'Taller del proceso de escritura',
        description: 'De la lluvia de ideas a la narración publicada en cinco días.',
        objective: 'Los estudiantes planifican, escriben, revisan y editan una narración corta.',
        skills: ['Planificar', 'Escribir el borrador', 'Revisar', 'Editar'],
        days: [
          ['Preescritura', 'Mapa del cuento: personajes, lugar, problema, solución.'],
          ['Borrador', 'Escribir el inicio y el desarrollo sin detenerse a corregir.'],
          ['Revisión', 'Conferencia entre pares: una estrella y un deseo.'],
          ['Edición', 'Lista de cotejo: mayúsculas, puntuación, ortografía.'],
          ['Publicación', 'Silla del autor y reflexión: La próxima vez voy a ___'],
        ],
      },
    },
  },
  {
    id: 'multiplication-facts',
    subject: 'math',
    grades: '3',
    standards: ['CCSS.Math.Content.3.OA.A.1', 'CCSS.Math.Content.3.OA.C.7'],
    activities: progression,
    text: {
      en: {
        name: 'Mastering Multiplication Facts',
        description: 'Arrays, patterns and games toward fluency within 100.',
        objective: 'Students multiply fluently within 100 using strategies and known facts.',
        skills: ['Equal groups', 'Arrays', 'Fact strategies', 'Fluency'],
        days: [
          ['Equal groups', 'Build equal groups with counters; write 3 × 4 = ___'],
          ['Arrays', 'Draw arrays and turn them around (commutative property).'],
          [
            'Patterns',
            'Find patterns in the 2s, 5s, 9s and 10s.\n\n| × | 2 | 5 | 10 |\n|---|---|---|---|\n| 3 | 6 | 15 | 30 |',
          ],
          ['Fact games', 'Partner games and flash cards.'],
          ['Fluency check', 'Timed check and personal goal: I will practise ___'],
        ],
      },
      es: {
        name: 'Dominio de las tablas de multiplicar',
        description: 'Arreglos, patrones y juegos para multiplicar con fluidez hasta 100.',
        objective:
          'Los estudiantes multiplican con fluidez hasta 100 usando estrategias y datos conocidos.',
        skills: ['Grupos iguales', 'Arreglos', 'Estrategias', 'Fluidez'],
        days: [
          ['Grupos iguales', 'Formar grupos iguales con fichas; escribir 3 × 4 = ___'],
          ['Arreglos', 'Dibujar arreglos y girarlos (propiedad conmutativa).'],
          [
            'Patrones',
            'Buscar patrones en el 2, 5, 9 y 10.\n\n| × | 2 | 5 | 10 |\n|---|---|---|---|\n| 3 | 6 | 15 | 30 |',
          ],
          ['Juegos de tablas', 'Juegos en parejas y tarjetas.'],
          ['Prueba de fluidez', 'Prueba cronometrada y meta personal: Voy a practicar ___'],
        ],
      },
    },
  },
];

/** English and Spanish are written; the other languages use English. */
export const starterText = (starter: StarterTemplate, language: Language): StarterText =>
  starter.text[language === 'es' ? 'es' : 'en'];

export const findStarter = (id: string): StarterTemplate | null =>
  starterTemplates.find((starter) => starter.id === id) ?? null;

/** The starter as a one-week plan beginning on `weekStart`. */
export function starterBody(
  starter: StarterTemplate,
  language: Language,
  weekStart: string,
): WeeklyBodyInput {
  const text = starterText(starter, language);
  const days: PlanDayInput[] = text.days.map(([theme, notes], index) => ({
    theme,
    notes,
    activities: (starter.activities[index] ?? []).map((type) => ({ type })),
  }));
  return {
    kind: 'weekly',
    unit: text.name,
    weeks: [
      {
        weekStart,
        objective: text.objective,
        skills: text.skills,
        standards: starter.standards,
        days,
      },
    ],
  };
}

/** ISO 8601 week number of a date. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** One starter is featured each week, in turn. */
export const templateOfTheWeek = (now: Date): StarterTemplate =>
  starterTemplates[isoWeek(now) % starterTemplates.length] ?? starterTemplates[0];
