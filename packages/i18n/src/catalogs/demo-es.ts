import type { DemoMessages } from './marketing-types.ts';

// The product tour on /demo, in Spanish.
export const demoEs: DemoMessages = {
  demo: {
    metaTitle: 'Demostración de TeacherHubPro: vea cada función, paso a paso',
    metaDescription:
      'Un recorrido guiado por TeacherHubPro con pantallas reales: planes de clase, asistencia, calificación con IA, juegos, juegos en vivo, portales familiares y más.',
    title: 'Conozca TeacherHubPro, paso a paso',
    intro:
      'Un recorrido guiado por toda la aplicación en {steps} pasos, con pantallas reales. Todos los estudiantes que verá son inventados.',
    contents: 'Capítulos',
    chapterNumber: 'Capítulo {n}',
    enlarge: 'Abrir la captura de pantalla en tamaño completo: {title}',
    madeUp:
      'Todos los nombres, clases y notas de estas capturas son inventados. Los borradores de IA los escribió la IA de la aplicación y se muestran tal como los escribió.',
    video: {
      introTitle: 'TeacherHubPro en dos minutos',
      introLine:
        'Bienvenido a TeacherHubPro, el espacio de enseñanza con IA para maestros, escuelas y familias que educan en casa. Vea en pocos minutos todo lo que hace.',
      outroTitle: 'Pruébelo gratis por {days} días',
      outroLine: 'Pruebe TeacherHubPro gratis por {days} días, sin tarjeta, en teacherhubpro.com.',
      madeUp: 'Todos los estudiantes que aparecen son ficticios.',
    },
    chapters: {
      start: {
        title: 'Primeros pasos',
        intro: 'Regístrese en un minuto y empiece con una clase de muestra ya lista.',
      },
      classes: {
        title: 'Clases, listas de estudiantes y asistencia',
        intro:
          'Traiga a sus estudiantes desde una hoja de cálculo y tome la asistencia en segundos.',
      },
      planning: {
        title: 'Planificación de clases',
        intro:
          'Planes semanales alineados con Common Core y los estándares de Puerto Rico, listos para imprimir.',
      },
      assistant: {
        title: 'Asistente de IA',
        intro:
          'Hojas de trabajo, pruebas y rúbricas redactadas para su grado y tema. Usted edita y decide.',
      },
      presentations: {
        title: 'Presentaciones',
        intro:
          'Diapositivas redactadas por la IA, listas para presentar o abrir en Google Slides, Canva u OneDrive.',
      },
      prep: {
        title: 'Agente de preparación',
        intro:
          'Una sola oración se convierte en una semana completa, y usted lo revisa todo antes de que salga.',
      },
      assignments: {
        title: 'Asignaciones y calificación con IA',
        intro:
          'Convierta un PDF en una asignación en línea, compártala con un enlace y confirme las notas que sugiere la IA.',
      },
      gradebook: {
        title: 'Registro de notas y boletas',
        intro:
          'Categorías ponderadas, semestres y boletas, a partir de las notas que usted confirmó.',
      },
      games: {
        title: 'Juegos educativos',
        intro:
          'Once modos de juego, con una explicación para cada respuesta y seguimiento de estándares.',
      },
      live: {
        title: 'Juegos en vivo en el salón',
        intro:
          'Jueguen juntos en la pantalla grande mientras los estudiantes responden desde sus teléfonos.',
      },
      learning: {
        title: 'Aprendizaje adaptativo y análisis de estudiantes',
        intro:
          'Rutas de aprendizaje personales y señales tempranas de quién podría necesitar ayuda.',
      },
      families: {
        title: 'Portal familiar',
        intro:
          'Las familias ven las notas y la asistencia con un enlace privado, sin necesidad de cuenta.',
      },
      substitutes: {
        title: 'Paquetes para sustituto',
        intro: 'Todo lo que un sustituto necesita, impreso con un clic.',
      },
      connections: {
        title: 'Herramientas conectadas',
        intro: 'Funciona con Google, Microsoft, Canva y el sistema de cursos de su escuela.',
      },
      schools: {
        title: 'Para escuelas y distritos',
        intro:
          'Uso, controles, un registro de las decisiones de la IA y sus datos, todo en un solo lugar.',
      },
    },
    steps: {
      signup: {
        title: 'Cree su cuenta',
        text: 'Regístrese con su correo electrónico o su cuenta de Google. Su prueba gratuita empieza de inmediato, sin tarjeta.',
        alt: 'La página de registro de TeacherHubPro con los campos de nombre, correo electrónico y contraseña.',
      },
      commandCenter: {
        title: 'Su Centro de mando',
        text: 'Cada mañana ve las clases de hoy, el trabajo que espera calificación y los estudiantes que pueden necesitar ayuda, todo en una sola pantalla.',
        alt: 'El Centro de mando con las clases de hoy, el trabajo por calificar y un estudiante que puede necesitar ayuda.',
      },
      sampleClass: {
        title: 'Pruébelo con una clase de muestra',
        text: 'Con un clic se añade una clase de muestra con estudiantes, notas y asistencia inventados, para que lo pruebe todo antes de añadir los suyos. Quítela cuando quiera.',
        alt: 'La página de la clase de muestra con seis estudiantes inventados.',
      },
      rosterImport: {
        title: 'Importe su lista de estudiantes',
        text: 'Suba una hoja de cálculo con nombres y apellidos. El número de estudiante, el correo de los padres, los acomodos y el idioma de la familia son columnas opcionales.',
        alt: 'La lista de una clase después de importar los estudiantes desde una hoja de cálculo.',
      },
      accommodations: {
        title: 'Los acomodos, en un solo lugar',
        text: 'Anote una sola vez los acomodos de cada estudiante. Aparecen donde importan, como en el paquete para sustituto, y solo los ven usted y su escuela.',
        alt: 'El formulario de un estudiante con el campo de acomodos completado.',
      },
      attendance: {
        title: 'Tome la asistencia en segundos',
        text: 'Marque presente, ausente, tarde o excusado para cada estudiante, añada los minutos de tardanza y guarde el día.',
        alt: 'La hoja de asistencia con un estado para cada estudiante.',
      },
      attendanceReport: {
        title: 'La asistencia de un vistazo',
        text: 'El informe de asistencia muestra el porcentaje de cada estudiante y cada ausencia y tardanza en las fechas que elija.',
        alt: 'El informe de asistencia con el porcentaje de asistencia de cada estudiante.',
      },
      planner: {
        title: 'Planifique su semana con estándares',
        text: 'Escriba su plan semanal día por día y elija estándares de las listas oficiales de Common Core y de Puerto Rico. La aplicación nunca inventa un código de estándar.',
        alt: 'El planificador semanal con el selector de estándares de Puerto Rico abierto.',
      },
      planPrint: {
        title: 'Imprima en el formato de su escuela',
        text: 'Imprima los planes en el formato clásico con el encabezado de su escuela, o en un formato sencillo de una página.',
        alt: 'Un plan semanal listo para imprimir en el formato clásico.',
      },
      curriculum: {
        title: 'Añada sus guías curriculares',
        text: 'Suba o pegue las guías de secuencia de su escuela. La IA las sigue al redactar planes, para que los borradores coincidan con lo que enseña su escuela.',
        alt: 'La página de guías curriculares con una guía de secuencia lista para usar.',
      },
      templates: {
        title: 'Empiece con una plantilla',
        text: 'Comience un plan a partir de una unidad ya lista o de una propia, y luego cambie lo que quiera.',
        alt: 'La página de plantillas con unidades ya listas.',
      },
      assistantForm: {
        title: 'Pídaselo al asistente de IA',
        text: 'Elija una hoja de trabajo, una prueba o un plan de clase, y luego la materia, el grado, el tema y el idioma. Marque Apoyo ESL para obtener material al nivel de los estudiantes que aprenden inglés, según WIDA y los estándares de Puerto Rico.',
        alt: 'El formulario del asistente de IA con tipo, tema, grado y Apoyo ESL.',
      },
      assistantResult: {
        title: 'Revise el borrador',
        text: 'El borrador está listo en segundos. Cópielo, imprímalo, escúchelo en voz alta, ábralo en Canva o guárdelo en OneDrive.',
        alt: 'Una hoja de trabajo redactada por el asistente de IA.',
      },
      rubric: {
        title: 'Cree rúbricas',
        text: 'Empiece una rúbrica desde cero o pida a la IA un borrador, y luego edite cada criterio y nivel. Úsela para calificar respuestas escritas.',
        alt: 'Una rúbrica con criterios y niveles, lista para editar.',
      },
      presentation: {
        title: 'Redacte una presentación',
        text: 'Indique un tema y el número de diapositivas, elija un tema visual y edite cada diapositiva antes de presentar.',
        alt: 'Una presentación redactada por la IA, abierta en el editor de diapositivas.',
      },
      presentationExport: {
        title: 'Preséntela donde quiera',
        text: 'Presente desde el navegador, descargue en PowerPoint, envíela a Google Classroom y Slides, ábrala en Canva o guárdela en OneDrive.',
        alt: 'Las opciones de una presentación para enviarla a Google Classroom, Canva y OneDrive.',
      },
      prepStart: {
        title: 'Una oración, una semana completa',
        text: 'Escriba lo que enseña esta semana. El Agente de preparación redacta el plan, las diapositivas y las hojas de trabajo de cada día, una prueba del viernes y una nota para las familias.',
        alt: 'El formulario del Agente de preparación con una oración que describe la semana.',
      },
      prepReview: {
        title: 'Usted lo revisa antes de que salga',
        text: 'Lea cada pieza, consérvela o descártela y edite el correo para las familias. Nada se publica ni se envía hasta que usted lo indique.',
        alt: 'La revisión del Agente de preparación con el plan de la semana, las hojas de trabajo, la prueba y el correo para las familias.',
      },
      pdfImport: {
        title: 'Convierta un PDF en una asignación en línea',
        text: 'Suba una hoja de trabajo o un examen en PDF. La IA pasa sus preguntas a un editor donde usted revisa cada una antes de guardar.',
        alt: 'Preguntas importadas de un PDF, listas para revisar y guardar.',
      },
      studentLinks: {
        title: 'Comparta con enlaces de los estudiantes',
        text: 'Cada estudiante recibe un enlace privado: sin cuentas ni contraseñas que administrar. Puede reemplazar o desactivar un enlace en cualquier momento.',
        alt: 'La página de enlaces de los estudiantes con un enlace para cada uno.',
      },
      studentAnswer: {
        title: 'Los estudiantes responden en cualquier dispositivo',
        text: 'Los estudiantes abren su enlace en un teléfono, una tableta o una computadora, responden y entregan. Las preguntas se pueden leer en voz alta.',
        alt: 'Un estudiante respondiendo una asignación en un teléfono.',
      },
      aiGrading: {
        title: 'La IA sugiere, usted decide',
        text: 'Las preguntas de selección se califican solas. En las respuestas escritas, la IA sugiere una nota y comentarios, y nada cuenta hasta que usted lo confirme o lo cambie.',
        alt: 'La respuesta de un estudiante con una nota sugerida por la IA en espera de la confirmación del maestro.',
      },
      gradebook: {
        title: 'Un registro de notas que cuadra',
        text: 'Categorías ponderadas, la nota final de cada estudiante y solo las notas que usted confirmó.',
        alt: 'El registro de notas con categorías y la nota final de cada estudiante.',
      },
      reportCards: {
        title: 'Boletas en minutos',
        text: 'Añada un comentario para cada estudiante y descargue las boletas en PDF, una por una o de toda la clase.',
        alt: 'Boletas con notas por categoría y un comentario del maestro.',
      },
      gameBuilder: {
        title: 'Cree un juego en minutos',
        text: 'Escriba sus propias preguntas o pida a la IA un borrador, y luego elija entre once modos, como Cuestionario, Contrarreloj, Emparejar, Memoria y Crucigrama.',
        alt: 'El creador de juegos con tarjetas de preguntas.',
      },
      gameReview: {
        title: 'Los estudiantes aprenden el porqué',
        text: 'Después de una ronda, los estudiantes ven las preguntas que fallaron con la respuesta correcta y una breve explicación del porqué.',
        alt: 'El repaso de un estudiante después de un juego, con las respuestas correctas y las explicaciones.',
      },
      aiExplanations: {
        title: 'Explicaciones escritas para usted',
        text: 'Con un clic, la IA escribe un breve “porqué” para cada tarjeta que no lo tiene. Usted las lee y edita antes de guardar.',
        alt: 'Explicaciones escritas por la IA, listas para que el maestro las revise.',
      },
      coverage: {
        title: 'Vea qué estándares ha cubierto',
        text: 'El informe de cobertura muestra cómo le fue a la clase en cada estándar que etiquetó, con un clic para volver a enseñar lo que necesita más trabajo.',
        alt: 'El informe de cobertura de estándares de una clase.',
      },
      liveLobby: {
        title: 'Inicie un juego en vivo',
        text: 'Ponga el juego en la pantalla grande. Los estudiantes entran con un PIN de 6 dígitos y tocan su nombre en su lista.',
        alt: 'La sala de espera del juego en vivo con el PIN y los estudiantes que entraron.',
      },
      livePlayer: {
        title: 'Los estudiantes juegan en sus teléfonos',
        text: 'Cada estudiante responde en su propio dispositivo, contra el reloj, con puntos por rapidez y por rachas.',
        alt: 'Un estudiante respondiendo una pregunta de un juego en vivo en un teléfono.',
      },
      liveReveal: {
        title: 'Revelar, explicar y seguir',
        text: 'Después de cada pregunta, la pantalla grande muestra la respuesta correcta, cómo respondió la clase y por qué, y luego la tabla de posiciones.',
        alt: 'La pantalla grande con la respuesta correcta, las respuestas de la clase y la explicación.',
      },
      learningPath: {
        title: 'Rutas de aprendizaje personales',
        text: 'Redacte una breve serie de lecciones para un estudiante sobre el tema que necesita. Usted la edita y luego la asigna a su enlace.',
        alt: 'Una ruta de aprendizaje redactada para un estudiante, abierta en el editor.',
      },
      studentLesson: {
        title: 'Lecciones al ritmo de cada estudiante',
        text: 'El estudiante lee cada lección, responde una comprobación rápida y ve su puntuación. Usted ve su progreso.',
        alt: 'Un estudiante trabajando en una lección en un teléfono.',
      },
      insights: {
        title: 'Sepa quién puede necesitar ayuda',
        text: 'La página de cada estudiante reúne notas, asistencia y observaciones. Un resumen de la IA sugiere próximos pasos para que usted los considere.',
        alt: 'La página de un estudiante con notas, asistencia y un resumen de la IA.',
      },
      parentPortal: {
        title: 'Mantenga informadas a las familias',
        text: 'Las familias abren un enlace privado para ver las notas confirmadas y la asistencia. Las notas semanales del Agente de preparación pueden llegar a cada familia en su propio idioma.',
        alt: 'El portal familiar en un teléfono con notas y asistencia.',
      },
      subPacket: {
        title: 'Esté listo para un sustituto',
        text: 'El paquete para sustituto reúne su horario, su lista de estudiantes, sus planes, sus rutinas y sus contactos, listo para imprimir.',
        alt: 'Un paquete para sustituto con horario, lista de estudiantes y rutinas.',
      },
      integrations: {
        title: 'Conecte sus herramientas',
        text: 'Conecte Google Classroom, Google Drive, Microsoft OneDrive y Teams, Canva y su calendario. Usted elige qué se comparte, una herramienta a la vez.',
        alt: 'La página de Herramientas conectadas con Google, Microsoft y Canva.',
      },
      schoolSystems: {
        title: 'El sistema de cursos de su escuela',
        text: 'Las escuelas pueden abrir TeacherHubPro dentro de Canvas, Schoology, Moodle y D2L Brightspace y devolver las notas confirmadas mediante el estándar LTI 1.3. Disponible a solicitud.',
        alt: 'La sección de sistemas escolares en Herramientas conectadas.',
      },
      schoolOverview: {
        title: 'El resumen de la escuela',
        text: 'Los directivos ven cómo usa la aplicación cada maestro y pueden activar o desactivar las funciones de IA y los avisos sobre estudiantes para toda la escuela.',
        alt: 'El resumen de la escuela con el uso por maestro y los interruptores para toda la escuela.',
      },
      schoolUsers: {
        title: 'Administre los usuarios de su escuela',
        text: 'Asigne a maestros y administradores el rol adecuado, y pase una clase a otro maestro cuando alguien se va.',
        alt: 'La página de usuarios de la escuela con sus roles.',
      },
      approvals: {
        title: 'Un registro de cada decisión de la IA',
        text: 'El trabajo de la IA llega a estudiantes y familias solo después de que un maestro lo aprueba. El registro de Aprobaciones muestra quién aprobó qué y cuándo, sin nombres ni notas de estudiantes.',
        alt: 'El registro de Aprobaciones con lo que aprobaron los maestros.',
      },
      dataExport: {
        title: 'Sus datos siguen siendo suyos',
        text: 'Descargue todos los datos de su escuela en cualquier momento, o elimine usted mismo la escuela y sus datos.',
        alt: 'La página de configuración con la descarga y la eliminación de los datos de la escuela.',
      },
      languages: {
        title: 'Siete idiomas',
        text: 'Use la aplicación en inglés, español, francés, portugués, alemán, italiano o chino. La IA escribe en el idioma que usted elija.',
        alt: 'La página de configuración con el selector de idioma.',
      },
    },
  },
};
