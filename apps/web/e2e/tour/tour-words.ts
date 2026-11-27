import type { Locale } from '@thp/i18n';

/** What the tour's teacher types, in each language, so every screenshot reads naturally. */
export interface TourWords {
  readonly schoolName: string;
  readonly className: string;
  readonly quizTitle: string;
  readonly prepSentence: string;
  readonly guideTitle: string;
  readonly guideText: string;
  readonly routines: string;
  /** Three students' accommodations, for the imported roster. */
  readonly needs: readonly [string, string, string];
}

export const tourWords: Readonly<Record<Locale, TourWords>> = {
  en: {
    schoolName: 'Riverside Elementary',
    className: 'Science 4',
    quizTitle: 'Space quiz',
    prepSentence:
      'The water cycle: evaporation, condensation and precipitation, with a hands-on experiment.',
    guideTitle: 'Math 3 pacing guide',
    guideText:
      'Unit 1 (weeks 1–4): place value and rounding.\nUnit 2 (weeks 5–9): addition and subtraction within 1,000.\nUnit 3 (weeks 10–14): introduction to fractions.',
    routines: '8:00 morning meeting · 10:15 recess · 12:00 lunch',
    needs: [
      'Extra time on tests; questions read aloud',
      'Preferential seating',
      'Short breaks every 20 minutes',
    ],
  },
  es: {
    schoolName: 'Escuela Elemental Riverside',
    className: 'Ciencias 4',
    quizTitle: 'Prueba del espacio',
    prepSentence:
      'El ciclo del agua: evaporación, condensación y precipitación, con un experimento práctico.',
    guideTitle: 'Guía de secuencia de Matemáticas 3',
    guideText:
      'Unidad 1 (semanas 1–4): valor posicional y redondeo.\nUnidad 2 (semanas 5–9): suma y resta hasta 1,000.\nUnidad 3 (semanas 10–14): introducción a las fracciones.',
    routines: '8:00 reunión de la mañana · 10:15 recreo · 12:00 almuerzo',
    needs: [
      'Tiempo adicional en pruebas; lectura en voz alta de las preguntas',
      'Ubicación preferencial en el salón',
      'Pausas cortas cada 20 minutos',
    ],
  },
  fr: {
    schoolName: 'École Riverside',
    className: 'Sciences CM1',
    quizTitle: 'Quiz sur l’espace',
    prepSentence:
      'Le cycle de l’eau : évaporation, condensation et précipitations, avec une expérience pratique.',
    guideTitle: 'Progression de maths CE2',
    guideText:
      'Unité 1 (semaines 1–4) : valeur de position et arrondis.\nUnité 2 (semaines 5–9) : addition et soustraction jusqu’à 1 000.\nUnité 3 (semaines 10–14) : introduction aux fractions.',
    routines: '8 h 00 accueil · 10 h 15 récréation · 12 h 00 déjeuner',
    needs: [
      'Temps supplémentaire aux évaluations ; lecture des questions à voix haute',
      'Place près du tableau',
      'Courtes pauses toutes les 20 minutes',
    ],
  },
  pt: {
    schoolName: 'Escola Riverside',
    className: 'Ciências 4',
    quizTitle: 'Quiz do espaço',
    prepSentence:
      'O ciclo da água: evaporação, condensação e precipitação, com um experimento prático.',
    guideTitle: 'Guia de sequência de Matemática 3',
    guideText:
      'Unidade 1 (semanas 1–4): valor posicional e arredondamento.\nUnidade 2 (semanas 5–9): adição e subtração até 1.000.\nUnidade 3 (semanas 10–14): introdução às frações.',
    routines: '8h00 roda da manhã · 10h15 recreio · 12h00 almoço',
    needs: [
      'Tempo extra nas provas; leitura das perguntas em voz alta',
      'Lugar preferencial na sala',
      'Pausas curtas a cada 20 minutos',
    ],
  },
  de: {
    schoolName: 'Grundschule Riverside',
    className: 'Sachkunde 4',
    quizTitle: 'Weltraum-Quiz',
    prepSentence:
      'Der Wasserkreislauf: Verdunstung, Kondensation und Niederschlag, mit einem Experiment zum Mitmachen.',
    guideTitle: 'Stoffverteilungsplan Mathe 3',
    guideText:
      'Einheit 1 (Wochen 1–4): Stellenwerte und Runden.\nEinheit 2 (Wochen 5–9): Addition und Subtraktion bis 1000.\nEinheit 3 (Wochen 10–14): Einführung in Brüche.',
    routines: '8:00 Morgenkreis · 10:15 Pause · 12:00 Mittagessen',
    needs: [
      'Mehr Zeit bei Tests; Fragen werden vorgelesen',
      'Sitzplatz vorne',
      'Kurze Pausen alle 20 Minuten',
    ],
  },
  it: {
    schoolName: 'Scuola Primaria Riverside',
    className: 'Scienze 4',
    quizTitle: 'Quiz sullo spazio',
    prepSentence:
      'Il ciclo dell’acqua: evaporazione, condensazione e precipitazioni, con un esperimento pratico.',
    guideTitle: 'Programmazione di matematica 3',
    guideText:
      'Unità 1 (settimane 1–4): valore posizionale e arrotondamento.\nUnità 2 (settimane 5–9): addizione e sottrazione entro 1000.\nUnità 3 (settimane 10–14): introduzione alle frazioni.',
    routines: '8:00 accoglienza · 10:15 ricreazione · 12:00 pranzo',
    needs: [
      'Tempo aggiuntivo nelle verifiche; domande lette ad alta voce',
      'Posto in prima fila',
      'Brevi pause ogni 20 minuti',
    ],
  },
  zh: {
    schoolName: '河畔小学',
    className: '四年级科学',
    quizTitle: '太空小测验',
    prepSentence: '水循环：蒸发、凝结和降水，并配一个动手实验。',
    guideTitle: '三年级数学进度表',
    guideText:
      '第 1 单元（第 1–4 周）：位值与四舍五入。\n第 2 单元（第 5–9 周）：1000 以内的加减法。\n第 3 单元（第 10–14 周）：分数初步。',
    routines: '8:00 晨会 · 10:15 课间休息 · 12:00 午餐',
    needs: ['考试延长时间；题目朗读', '优先座位', '每 20 分钟短暂休息'],
  },
};
