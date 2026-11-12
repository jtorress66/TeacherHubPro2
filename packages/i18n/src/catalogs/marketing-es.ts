import type { MarketingMessages } from './marketing-types.ts';

// El texto del sitio público en español: páginas de marketing, el chat del sitio y las páginas
// legales. Todo lo que dice debe ser cierto de la app hoy.

export const marketingEs: MarketingMessages = {
  marketing: {
    nav: {
      label: 'Principal',
      features: 'Funciones',
      useCases: 'Para quién',
      pricing: 'Precios',
      contact: 'Contacto',
      logIn: 'Entrar',
      startTrial: 'Prueba gratis',
    },
    footer: {
      tagline:
        'El espacio de enseñanza con IA para maestros, escuelas y familias que educan en casa.',
      product: 'Producto',
      useCases: 'Para quién',
      company: 'Empresa',
      legal: 'Legal y confianza',
      ai: 'Funciones de IA',
      integrations: 'Integraciones',
      enterprise: 'Escuelas y distritos',
      help: 'Ayuda',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro: tu espacio de enseñanza con IA',
      metaDescription:
        'Planifique clases, tome asistencia, califique, cree presentaciones, juegos y pruebas, y comparta el progreso con las familias, con una IA que prepara borradores y usted decide. Prueba gratis de 7 días.',
      featuresTitle: 'Todo lo que necesita una semana de clases',
      featuresIntro:
        'Un solo espacio para planificar, enseñar, calificar y comunicarse con las familias.',
      howTitle: 'Cómo funciona',
      how1Title: 'Prepare sus clases',
      how1Text:
        'Cree una clase e importe su lista desde una hoja de cálculo o desde Google Classroom.',
      how2Title: 'Deje que la IA prepare borradores',
      how2Text:
        'Pida un plan semanal, diapositivas, una hoja de trabajo, una prueba o toda una semana de preparación. Todo es un borrador.',
      how3Title: 'Revise y úselo',
      how3Text:
        'Edite lo que quiera; luego enseñe, asigne, califique y comparta. Nada llega a los estudiantes ni a las familias hasta que usted lo apruebe.',
      whoTitle: 'Hecho para',
      whoIntro: 'Maestros de aula, familias que educan en casa, tutores y escuelas completas.',
      trustTitle: 'Datos de estudiantes, con cuidado',
      trustIntro: 'Los estudiantes son menores de edad, y la app está hecha pensando en eso.',
      trust1:
        'Estudiantes y familias usan enlaces privados, no cuentas. Los enlaces son aleatorios, se guardan solo como hash y se pueden revocar.',
      trust2:
        'Cada registro pertenece a una escuela, y solo los maestros de esa escuela pueden verlo.',
      trust3:
        'La IA recibe solo lo que una tarea necesita. Los análisis de estudiantes reciben números, nunca un nombre.',
      trust4: 'Las notas y sugerencias de la IA son borradores hasta que un maestro las confirma.',
      trustMore: 'Visite el centro de confianza',
      pricingTitle: 'Precios sencillos',
      pricingIntro: 'Empiece con una prueba gratis de {days} días. No necesita tarjeta.',
      pricingSee: 'Ver todos los planes',
      faqTitle: 'Preguntas',
      faq1Q: '¿Necesito una tarjeta para la prueba?',
      faq1A:
        'No. La prueba le da acceso completo por 7 días; elige un plan solo si quiere continuar.',
      faq2Q: '¿La IA califica por mí?',
      faq2A:
        'Sugiere notas y comentarios para las respuestas abiertas. Usted confirma cada nota antes de que cuente.',
      faq3Q: '¿Qué idiomas tiene?',
      faq3A:
        'La app está completa en inglés y español, y la IA escribe en el idioma que usted elija. Francés, portugués, alemán, italiano y chino están traducidos en parte.',
      faq4Q: '¿Funciona con Google Classroom?',
      faq4A:
        'Sí. Puede importar listas, publicar tareas y documentos de Word, enviar presentaciones como Google Slides y crear pruebas de Google Forms.',
      faq5Q: '¿Puede usarlo toda mi escuela?',
      faq5A:
        'Sí. Los planes Escuela y Distrito agregan maestros a una escuela, con páginas de administración e importación masiva.',
      ctaTitle: 'Pruébelo con sus propias clases',
      ctaText: 'Prepare una clase en minutos y deje que la IA prepare su próxima semana.',
    },
    feature: {
      lesson_planner: {
        title: 'Planificador de clases',
        text: 'Planes semanales con estándares Common Core, preparados por la IA y editados por usted.',
      },
      ai_assistant: {
        title: 'Asistente de IA',
        text: 'Hojas de trabajo, pruebas, resúmenes y actividades en su idioma.',
      },
      presentations: {
        title: 'Presentaciones',
        text: 'Diapositivas preparadas por la IA, para presentar, imprimir o enviar a Google Classroom.',
      },
      gradebook: {
        title: 'Registro de notas y boletas',
        text: 'Categorías con peso, tareas y boletas en PDF con el logo de su escuela.',
      },
      attendance: {
        title: 'Asistencia',
        text: 'Asistencia diaria con tardanzas, ausencias justificadas e informes.',
      },
      assignments: {
        title: 'Pruebas en línea y calificación con IA',
        text: 'Cree preguntas o importe una prueba en PDF; los estudiantes responden desde un enlace; usted confirma las notas sugeridas.',
      },
      games: {
        title: 'Juegos y juegos en vivo',
        text: 'Juegos educativos de muchos tipos y juegos en vivo en clase a los que se entra con un PIN.',
      },
      learning: {
        title: 'Rutas de aprendizaje',
        text: 'Lecciones con preguntas de comprobación preparadas por la IA, asignadas con enlaces privados.',
      },
      families: {
        title: 'Portal familiar',
        text: 'Cada familia recibe un enlace privado, solo de lectura, con notas confirmadas y asistencia.',
      },
      command_center: {
        title: 'Centro de mando',
        text: 'Las clases de hoy, lo que falta por calificar, estudiantes que pueden necesitar ayuda y sugerencias.',
      },
      prep_agent: {
        title: 'Agente de preparación',
        text: 'Una oración se convierte en una semana: plan, diapositivas, hojas de trabajo, una prueba del viernes y un correo a las familias para revisar.',
      },
      schools: {
        title: 'Para escuelas',
        text: 'Los administradores gestionan usuarios y roles; importan maestros y estudiantes en bloque.',
      },
    },
    featuresPage: {
      metaTitle: 'Funciones | TeacherHubPro',
      metaDescription:
        'Planificación de clases, herramientas de IA, registro de notas, asistencia, presentaciones y un flujo de trabajo pensado para maestros.',
      title: 'Funciones',
      intro: 'Lo que puede hacer con TeacherHubPro hoy.',
      learnMore: 'Más sobre {feature}',
      allFeatures: 'Todas las funciones',
    },
    included: {
      title: 'Todo incluido',
      intro: 'Todas las funciones que TeacherHubPro tiene hoy, en una sola lista.',
      prepAgent:
        'Agente de preparación: una frase se convierte en una semana de planes, presentaciones, hojas de trabajo, un examen del viernes y un correo para las familias, listos para que los revise',
      planner:
        'Planificador de clases con IA y estándares Common Core y de Puerto Rico, en formato sencillo o clásico',
      assistant:
        'Asistente de IA para hojas de trabajo, exámenes, resúmenes y actividades, con apoyo para estudiantes de inglés (ESL)',
      presentations:
        'Presentaciones con IA que puede presentar a pantalla completa, imprimir, descargar en PowerPoint o enviar a Google Classroom',
      tests:
        'Exámenes en línea que los estudiantes contestan desde un enlace privado; escriba las preguntas o importe un examen en PDF',
      aiGrading:
        'Corrección con IA de respuestas abiertas, como sugerencias que el maestro confirma',
      gradebook:
        'Registro de notas ponderado y boletas de calificaciones en PDF con el logo de su escuela',
      attendance: 'Asistencia diaria con tardanzas, ausencias justificadas e informes',
      games:
        'Juegos educativos en muchos modos y juegos en vivo a los que los estudiantes entran con un PIN',
      learning:
        'Rutas de aprendizaje: lecciones redactadas por IA con comprobaciones, asignadas con enlaces privados',
      families:
        'Portal familiar: un enlace privado de solo lectura con notas confirmadas y asistencia, además de resúmenes semanales por correo',
      commandCenter:
        'Centro de mando: las clases de hoy, lo que falta corregir y los estudiantes que pueden necesitar ayuda',
      subPacket: 'Paquetes para maestros sustitutos',
      listen: 'Escuchar: planes y materiales leídos en voz alta',
      google:
        'Integración con Google: inicio de sesión con Google, Google Classroom (importar listas, publicar tareas, documentos Word y presentaciones), exámenes en Google Forms y archivos en su propio Google Drive',
      canva:
        'Canva: abra presentaciones y hojas de trabajo en su propia cuenta de Canva como diseños editables',
      microsoft:
        'Microsoft OneDrive: guarde presentaciones en PowerPoint y hojas de trabajo en Word en su propio OneDrive',
      teams:
        'Microsoft Teams, para escuelas que usan Teams en sus clases: a pedido, importe listas de clase desde una clase de Teams y comparta tareas con ella. El administrador de TI de su escuela aprueba la conexión una sola vez.',
      languages:
        'Siete idiomas: inglés, español, francés, portugués, alemán, italiano y chino; la IA escribe en el idioma que usted elija',
      privacy:
        'Sin cuentas para estudiantes ni familias: enlaces privados guardados solo como hashes, que puede revocar y que caducan; pensado para FERPA y COPPA',
      aiDrafts:
        'La IA sugiere, el maestro decide: notas, análisis y correos a las familias son borradores hasta que usted los aprueba',
      schools:
        'Para escuelas y distritos: páginas de administración, roles e importación masiva de maestros y estudiantes',
      audiences: 'Para maestros, escuelas, tutores y familias que educan en casa',
    },
    features: {
      'lesson-planning': {
        title: 'Planificación de clases',
        description:
          'Planes semanales con estándares Common Core, preparados por la IA y editados por usted.',
        intro: 'Planifique una semana en minutos y tenga todos sus planes en un solo lugar.',
        p1Title: 'Planes semanales y de inglés conversacional',
        p1Text:
          'Objetivos, destrezas, estándares y actividades día a día, en el formato que los maestros ya usan.',
        p2Title: 'La IA prepara, usted decide',
        p2Text:
          'Pida un borrador para su materia, grado y tema; no se guarda nada hasta que usted lo edite y lo guarde.',
        p3Title: 'Códigos Common Core reales',
        p3Text:
          'Los estándares salen de la lista oficial de Common Core para la materia y el grado; los códigos se comprueban, nunca se inventan.',
        p4Title: 'Plantillas, carpetas e impresión',
        p4Text:
          'Guarde plantillas, organice planes en carpetas, duplique una semana, vea un calendario e imprima o guarde en PDF.',
      },
      gradebook: {
        title: 'Registro de notas y boletas',
        description: 'Categorías con peso, tareas, notas y boletas en PDF.',
        intro: 'Notas que se calculan como su escuela las cuenta.',
        p1Title: 'Categorías con peso',
        p1Text: 'Defina categorías y pesos por clase, o empiece con las categorías estándar.',
        p2Title: 'Puntos y promedios reales',
        p2Text:
          'Cada tarea tiene su propio máximo, y los promedios usan el peso de cada categoría.',
        p3Title: 'Boletas',
        p3Text: 'Boletas en PDF por semestre, con el logo de su escuela y comentarios del maestro.',
        p4Title: 'Solo notas confirmadas',
        p4Text:
          'Las notas sugeridas por la IA son borradores; las boletas y las familias ven solo las notas que usted confirmó.',
      },
      attendance: {
        title: 'Asistencia',
        description:
          'Asistencia diaria con presente, ausente, tardanza y ausencia justificada, e informes.',
        intro: 'Tome asistencia en segundos y vea los patrones con el tiempo.',
        p1Title: 'Hoja diaria rápida',
        p1Text:
          'Todos empiezan como presentes; marque a los demás, con minutos de tardanza y notas.',
        p2Title: 'Enviar y reabrir',
        p2Text: 'Un día enviado queda bloqueado hasta que usted lo reabra.',
        p3Title: 'Informes',
        p3Text:
          'Los totales y el porcentaje de asistencia de cada estudiante en los días que elija.',
        p4Title: 'Alimenta el centro de mando',
        p4Text:
          'Las ausencias y tardanzas cuentan para la lista de estudiantes en riesgo de su panel.',
      },
      'ai-tools': {
        title: 'Herramientas de IA',
        description:
          'Hojas de trabajo, pruebas, resúmenes, actividades, diapositivas, juegos y sugerencias de calificación.',
        intro:
          'Una IA que le ahorra tiempo preparando borradores y le deja todas las decisiones a usted.',
        p1Title: 'Asistente de IA',
        p1Text:
          'Hojas de trabajo, pruebas, resúmenes, actividades y planes de clase en el idioma que elija.',
        p2Title: 'De PDF a prueba en línea',
        p2Text:
          'Suba una prueba en PDF; la IA la divide en preguntas que usted revisa antes de que las vean los estudiantes.',
        p3Title: 'Sugerencias de calificación',
        p3Text:
          'La IA sugiere notas y comentarios para las respuestas abiertas; usted confirma o cambia cada una.',
        p4Title: 'Escuchar',
        p4Text:
          'Haga que el texto se lea en voz alta para los estudiantes que aprenden mejor escuchando.',
      },
      presentations: {
        title: 'Presentaciones',
        description:
          'Diapositivas preparadas por la IA, editadas, presentadas, impresas o enviadas a Google Classroom.',
        intro: 'Prepare las diapositivas de la clase de mañana en pocos minutos.',
        p1Title: 'Preparadas por la IA o desde cero',
        p1Text: 'Indique un tema, materia y grado, o empiece con una presentación en blanco.',
        p2Title: 'Diseños y temas',
        p2Text: 'Diseños de título, contenido, dos columnas y cita, emojis, temas y transiciones.',
        p3Title: 'Presentar e imprimir',
        p3Text: 'Presente a pantalla completa o imprima una diapositiva por página.',
        p4Title: 'Google Slides en Classroom',
        p4Text:
          'Envíe una presentación a un curso de Google Classroom como Google Slides que los estudiantes pueden ver.',
      },
      workflow: {
        title: 'Un flujo pensado para maestros',
        description: 'Clases, listas, un panel diario, Estudiante 360 y el agente de preparación.',
        intro: 'Menos clics, más enseñanza.',
        p1Title: 'Clases y listas',
        p1Text: 'Clases con horario, y listas desde un archivo CSV o desde Google Classroom.',
        p2Title: 'Centro de mando',
        p2Text:
          'Las clases de hoy, lo que falta por calificar, estudiantes que pueden necesitar ayuda y las próximas lecciones.',
        p3Title: 'Estudiante 360',
        p3Text:
          'El promedio, la asistencia, el trabajo pendiente, una línea de tiempo y sus notas privadas de un estudiante.',
        p4Title: 'Agente de preparación',
        p4Text:
          'Escriba una oración sobre la próxima semana y revise una semana completa de borradores antes de publicar.',
      },
    },
    ai: {
      metaTitle: 'Funciones de IA | TeacherHubPro',
      metaDescription:
        'Qué prepara la IA de TeacherHubPro, qué recibe y por qué el maestro siempre decide.',
      title: 'Una IA que prepara, maestros que deciden',
      intro:
        'Cada función de IA de TeacherHubPro prepara un borrador. Usted lo revisa, lo edita y lo aprueba antes de que llegue a estudiantes o familias.',
      listTitle: 'Lo que la IA puede preparar',
      planner: 'Planes semanales con códigos Common Core',
      assistant: 'Hojas de trabajo, pruebas, resúmenes y actividades',
      slides: 'Diapositivas de presentaciones',
      extractor: 'Preguntas de una prueba en línea a partir de un PDF',
      grader: 'Notas y comentarios sugeridos para respuestas abiertas',
      games: 'El contenido de cada tipo de juego',
      paths: 'Lecciones de rutas de aprendizaje con preguntas de comprobación',
      insight: 'Un breve análisis de las tendencias de un estudiante, solo a partir de números',
      prep: 'Una semana de planes, diapositivas, hojas de trabajo, una prueba y un correo a las familias',
      principlesTitle: 'Cómo usamos la IA',
      principle1: 'Lo que hace la IA es siempre un borrador hasta que un maestro lo aprueba.',
      principle2:
        'La IA recibe solo los datos que necesita una tarea; los nombres de los estudiantes no se envían cuando no hacen falta.',
      principle3:
        'Las instrucciones, el trabajo de los estudiantes y los datos personales no se guardan en los registros.',
      principle4: 'La IA escribe en el idioma que el maestro elige.',
      governance: 'Lea nuestra página de gobernanza de la IA',
    },
    useCasesPage: {
      title: 'Para quién',
      intro: 'TeacherHubPro para su forma de enseñar.',
    },
    useCases: {
      'classroom-teachers': {
        title: 'Maestros de aula',
        description: 'Planes, asistencia, notas y familias para maestros de aula.',
        intro: 'Termine la planificación y el papeleo, y dedique su energía a enseñar.',
        n1Title: 'Planifique más rápido',
        n1Text:
          'Planes semanales, diapositivas y hojas de trabajo preparados por la IA, listos para ajustar.',
        n2Title: 'Califique con menos esfuerzo',
        n2Text:
          'Pruebas en línea desde un enlace, puntuación automática de preguntas cerradas y sugerencias de la IA para las abiertas.',
        n3Title: 'Mantenga informadas a las familias',
        n3Text: 'Los enlaces familiares privados muestran notas confirmadas y asistencia.',
      },
      homeschool: {
        title: 'Educación en casa',
        description:
          'Planes, registros, rutas de aprendizaje y progreso para familias que educan en casa.',
        intro: 'Estructura para su educación en casa, sin el trabajo pesado.',
        n1Title: 'Un plan para cada semana',
        n1Text: 'Planes semanales con estándares Common Core para cada materia y grado.',
        n2Title: 'Registros que puede mostrar',
        n2Text: 'Asistencia, notas y boletas en un solo lugar.',
        n3Title: 'Aprender a su ritmo',
        n3Text:
          'Rutas de aprendizaje y juegos preparados por la IA que sus hijos abren desde un enlace privado.',
      },
      tutors: {
        title: 'Tutores',
        description: 'Materiales, práctica y progreso para tutores.',
        intro: 'Prepare sus sesiones rápido y muestre el progreso con claridad.',
        n1Title: 'Materiales al momento',
        n1Text: 'Hojas de trabajo, pruebas y diapositivas para cualquier tema y nivel.',
        n2Title: 'Práctica entre sesiones',
        n2Text:
          'Asigne pruebas, juegos y rutas de aprendizaje con enlaces; los estudiantes no necesitan cuenta.',
        n3Title: 'Progreso para los padres',
        n3Text: 'Comparta un enlace familiar de solo lectura con resultados confirmados.',
      },
      schools: {
        title: 'Escuelas',
        description:
          'Un solo espacio para todos los maestros, con páginas de administración e importación masiva.',
        intro:
          'Dé a cada maestro las mismas herramientas y mantenga los datos de estudiantes dentro de la escuela.',
        n1Title: 'Páginas de administración',
        n1Text:
          'Los administradores ven a sus usuarios, cambian roles y pasan clases de un maestro a otro.',
        n2Title: 'Importación masiva',
        n2Text: 'Importe maestros y listas de estudiantes desde hojas de cálculo.',
        n3Title: 'Plan Escuela',
        n3Text: 'Precio por maestro, facturado anualmente, desde 10 maestros.',
      },
    },
    pricingPage: {
      metaTitle: 'Precios | TeacherHubPro',
      metaDescription:
        'Planes Individual, Escuela y Distrito, con una prueba gratis de 7 días y sin tarjeta.',
      title: 'Precios',
      intro:
        'Cada plan incluye todas las funciones. Empiece con una prueba gratis de {days} días; no necesita tarjeta.',
      minimum: 'Desde {count} maestros',
      start: 'Prueba gratis',
      contactSales: 'Contáctenos',
      faqTitle: 'Preguntas sobre precios',
      faq1Q: '¿Qué pasa cuando termina la prueba?',
      faq1A:
        'Conserva sus datos. Para seguir usando la app, elija un plan en la página de planes y facturación.',
      faq2Q: '¿Cómo funcionan los planes Escuela y Distrito?',
      faq2A:
        'Paga por maestro, facturado anualmente: Escuela desde 10 maestros, Distrito desde 100.',
      faq3Q: '¿Cómo pago?',
      faq3A: 'Los pagos los procesa Stripe. TeacherHubPro nunca ve ni guarda números de tarjeta.',
    },
    integrationsPage: {
      metaTitle: 'Integraciones | TeacherHubPro',
      metaDescription:
        'Inicio de sesión con Google, Google Classroom, Forms, Drive y Slides, Canva, Microsoft OneDrive, Stripe y correo.',
      title: 'Integraciones',
      intro:
        'Los servicios con los que TeacherHubPro trabaja hoy, mediante sus interfaces oficiales.',
      googleSignIn: 'Inicio de sesión con Google',
      googleSignInText: 'Regístrese y entre con su cuenta de Google.',
      classroom: 'Google Classroom',
      classroomText:
        'Importe listas, publique tareas y documentos de Word, y envíe presentaciones.',
      forms: 'Google Forms',
      formsText: 'Convierta las preguntas de una tarea en una prueba de Google Forms.',
      slides: 'Google Drive y Slides',
      slidesText: 'Los documentos de Word y las presentaciones se crean en su propio Google Drive.',
      canva: 'Canva',
      canvaText:
        'Abra presentaciones y hojas de trabajo en su propia cuenta de Canva como diseños editables. Solo se envía lo que usted elige, nunca datos de estudiantes.',
      microsoft: 'Microsoft OneDrive',
      microsoftText:
        'Guarde presentaciones (PowerPoint) y hojas de trabajo (Word) en una carpeta TeacherHubPro de su propio OneDrive. Solo se envían los archivos que usted guarda, nunca datos de estudiantes.',
      teams: 'Microsoft Teams (para escuelas)',
      teamsText:
        '¿Su escuela usa Microsoft Teams? Contáctenos y configuraremos la conexión con Teams para sus clases: importe listas de clase desde una clase de Teams y comparta tareas con ella. El administrador de TI de su escuela la aprueba una sola vez.',
      teamsContact: 'Contáctenos',
      stripe: 'Stripe',
      stripeText:
        'Pagos seguros de los planes; los datos de la tarjeta nunca pasan por nuestros servidores.',
      email: 'Correo',
      emailText:
        'Enlaces del portal familiar, enlaces de contraseña y actualizaciones semanales a las familias por correo.',
    },
    enterprisePage: {
      metaTitle: 'Escuelas y distritos | TeacherHubPro',
      metaDescription:
        'TeacherHubPro para escuelas y distritos: páginas de administración, importación masiva y planes por maestro.',
      title: 'Para escuelas y distritos',
      intro:
        'Dé a cada maestro el mismo espacio de trabajo, con los datos de los estudiantes dentro de su escuela.',
      p1Title: 'Páginas de administración',
      p1Text:
        'Vea a todos los usuarios de su escuela, cambie roles, envíe enlaces de contraseña y pase clases de un maestro a otro.',
      p2Title: 'Importación masiva',
      p2Text:
        'Maestros y listas de estudiantes desde archivos CSV, revisados fila por fila antes de crear nada.',
      p3Title: 'Privacidad desde el diseño',
      p3Text:
        'Datos separados por escuela, enlaces de estudiantes y familias guardados como hash, tokens de Google cifrados y una IA que solo prepara borradores.',
      p4Title: 'Planes por maestro',
      p4Text: 'Escuela desde 10 maestros y Distrito desde 100, facturados anualmente.',
      cta: 'Hable con nosotros sobre su escuela',
    },
    contactPage: {
      metaTitle: 'Contacto | TeacherHubPro',
      metaDescription:
        'Preguntas, una demostración para su escuela o ayuda: escriba al equipo de TeacherHubPro.',
      title: 'Contáctenos',
      intro:
        'Preguntas, una demostración para su escuela o ayuda con su cuenta: leemos cada mensaje.',
      name: 'Su nombre',
      email: 'Correo',
      organization: 'Escuela u organización (opcional)',
      role: 'Soy',
      phone: 'Teléfono (opcional)',
      interest: 'Me interesa',
      message: 'Mensaje',
      consent: 'Usamos estos datos solo para responderle. Nunca los vendemos.',
      send: 'Enviar',
      sent: 'Gracias. Le responderemos pronto.',
    },
    roles: {
      teacher: 'Maestro o maestra',
      homeschool: 'Familia que educa en casa',
      tutor: 'Tutor',
      school_admin: 'Administrador escolar',
      principal: 'Director o directora',
      district: 'Líder de distrito',
      parent: 'Padre o madre',
      other: 'Otro',
    },
    interests: {
      features: 'Las funciones',
      pricing: 'Los precios',
      demo: 'Una demostración',
      school: 'Un plan para mi escuela',
      enterprise: 'Un plan para el distrito',
      support: 'Ayuda con mi cuenta',
      other: 'Otra cosa',
    },
    helpPage: {
      metaTitle: 'Ayuda | TeacherHubPro',
      metaDescription: 'Empiece con TeacherHubPro y encuentre respuestas a preguntas frecuentes.',
      title: 'Ayuda',
      intro: 'Empiece aquí o escríbanos desde la página de contacto.',
      startTitle: 'Primeros pasos',
      step1: 'Regístrese con su correo o su cuenta de Google.',
      step2: 'Cree una clase e importe su lista desde un archivo CSV o desde Google Classroom.',
      step3: 'Defina las categorías de notas y tome su primera asistencia.',
      step4: 'Pida a la IA un plan semanal, o al agente de preparación toda una semana.',
      faqTitle: 'Preguntas frecuentes',
      faq1Q: '¿Cómo reciben los estudiantes su trabajo?',
      faq1A:
        'Desde una tarea, usted crea enlaces privados por estudiante; los estudiantes los abren sin cuenta.',
      faq2Q: '¿Cómo ven las familias el progreso?',
      faq2A:
        'Envíe a cada familia un enlace privado de solo lectura; muestra solo las notas que usted confirmó.',
      faq3Q: 'Olvidé mi contraseña.',
      faq3A:
        'Use “¿Olvidó su contraseña?” en la página de entrada; le enviamos un enlace de un solo uso.',
      faq4Q: '¿Cómo conecto Google Classroom?',
      faq4A:
        'Abra Configuración y elija Conectar Google Classroom; luego elija su cuenta de maestro.',
    },
    chat: {
      open: 'Chatear con Ed',
      close: 'Cerrar el chat',
      title: 'Ed, el asistente de IA de TeacherHubPro',
      intro:
        '¡Hola! Soy Ed, un asistente de IA. Puedo responder preguntas sobre las funciones y los precios de TeacherHubPro.',
      rolePrompt: '¿Qué le describe mejor?',
      interestPrompt: '¿Sobre qué le gustaría saber?',
      placeholder: 'Escriba su pregunta',
      send: 'Enviar',
      you: 'Usted',
      ed: 'Ed',
      thinking: 'Ed está escribiendo…',
      failed: 'Lo siento, no pude responder. Inténtelo de nuevo o use la página de contacto.',
      limit: 'Este chat llegó a su límite. Use la página de contacto para hablar con el equipo.',
      leadPrompt: '¿Quiere que el equipo le contacte? Deje sus datos.',
      leadOpen: 'Dejar mis datos',
      leadSent: '¡Gracias! El equipo le contactará.',
      aiNote:
        'Las respuestas vienen de una IA y pueden tener errores; los precios de la página de precios son la referencia.',
    },
    leads: {
      title: 'Contactos',
      intro: 'Personas que dejaron sus datos en el chat del sitio o en el formulario de contacto.',
      score_high: 'Alta',
      score_medium: 'Media',
      score_low: 'Baja',
      source_chat: 'Chat',
      source_contact: 'Formulario de contacto',
      status_new: 'Nuevo',
      status_contacted: 'Contactado',
      status_closed: 'Cerrado',
      search: 'Buscar por nombre, correo u organización',
      score: 'Prioridad',
      source: 'Origen',
      status: 'Estado',
      all: 'Todos',
      filter: 'Filtrar',
      empty: 'Todavía no hay contactos.',
      received: 'Recibido',
      saveStatus: 'Guardar estado',
      statusFor: 'Estado de {name}',
    },
  },
  legal: {
    updated: 'Última actualización: {date}',
    contact: '¿Preguntas sobre esta página? Escríbanos desde la página de contacto.',
    privacy: {
      title: 'Política de privacidad',
      description: 'Qué datos guarda TeacherHubPro, para qué y cómo se protegen.',
      s1Title: 'A quién aplica',
      s1Text:
        'Esta política aplica a los maestros, el personal escolar y las familias que educan en casa que usan TeacherHubPro, y a la información de estudiantes y familias que ellos ingresan. Los estudiantes y las familias no crean cuentas; usan enlaces privados que les da un maestro.',
      s2Title: 'Qué guardamos',
      s2Text:
        'Los datos de la cuenta (nombre, correo, escuela, idioma), lo que crean los maestros (clases, planes, tareas, notas, asistencia, comentarios) y lo que los estudiantes entregan con sus enlaces. Los registros de estudiantes tienen solo lo que una función necesita: nombres, un número de estudiante opcional, un correo de la familia opcional y adaptaciones opcionales.',
      s3Title: 'Para qué lo usamos',
      s3Text:
        'Solo para dar el servicio a la escuela o al maestro que lo ingresó. No vendemos datos personales ni usamos datos de estudiantes para publicidad.',
      s4Title: 'Con quién lo compartimos',
      s4Text:
        'Con los proveedores que hacen funcionar la app: nuestro proveedor de alojamiento y base de datos, Stripe para los pagos, un proveedor de correo, Anthropic (Claude) para los borradores de IA, OpenAI para el audio de lectura en voz alta, Google cuando un maestro conecta Google Classroom, Canva cuando un maestro conecta Canva (solo la presentación u hoja de trabajo que abre allí, nunca datos de estudiantes), y Microsoft cuando un maestro conecta Microsoft (solo los archivos que guarda en OneDrive, nunca datos de estudiantes). Cada uno recibe solo lo que su tarea necesita.',
      s5Title: 'Cómo se protege',
      s5Text:
        'Las contraseñas se guardan como hash de un solo sentido. Los enlaces de sesión, de estudiantes, de familias y de contraseña son aleatorios y se guardan solo como hash. Los tokens de Google Classroom, de Canva y de Microsoft se cifran. Cada registro pertenece a una escuela y solo lo pueden ver los usuarios de esa escuela. El enlace de calendario de un maestro también es aleatorio y se guarda solo como hash: muestra únicamente los títulos de los planes y de las tareas con sus fechas, nunca información de los estudiantes, y el maestro puede reemplazarlo o desactivarlo en Configuración.',
      s6Title: 'Conservación y eliminación',
      s6Text:
        'Los datos se conservan mientras la cuenta esté activa. Los PDF subidos se eliminan una vez leídos. Los chats del sitio se eliminan a los 30 días. Para pedir una copia o la eliminación de sus datos, escríbanos desde la página de contacto.',
    },
    terms: {
      title: 'Términos de uso',
      description: 'Los términos para usar TeacherHubPro.',
      s1Title: 'El servicio',
      s1Text:
        'TeacherHubPro es una aplicación web para la enseñanza: planificación, clases, asistencia, notas, tareas, herramientas de IA y portales familiares.',
      s2Title: 'Su cuenta',
      s2Text:
        'Las cuentas son para adultos: maestros, personal escolar, tutores y padres. Los estudiantes no tienen cuentas; usan los enlaces privados que les comparte su maestro. Proteja su contraseña, use la app para enseñar y aprender, y siga las reglas de uso aceptable. Usted es responsable del contenido que crea y de la información de estudiantes que ingresa, y de tener derecho a ingresarla.',
      s3Title: 'Borradores de IA',
      s3Text:
        'Las funciones de IA preparan borradores que pueden tener errores. Usted los revisa y aprueba antes de usarlos; las notas y los informes cuentan solo cuando usted los confirma.',
      s4Title: 'Planes y pagos',
      s4Text:
        'Las cuentas nuevas tienen una prueba gratis de 7 días. Los planes pagos se renuevan hasta que se cancelan; los precios están en la página de precios. Los pagos los procesa Stripe.',
      s5Title: 'Su contenido',
      s5Text:
        'Usted conserva los derechos de lo que crea. Nos permite guardarlo y procesarlo solo para darle el servicio.',
      s6Title: 'Cambios',
      s6Text:
        'Podemos actualizar estos términos; en esta página mostraremos la fecha de la versión más reciente.',
    },
    cookies: {
      title: 'Cookies',
      description: 'Las cookies que usa TeacherHubPro.',
      s1Title: 'Solo lo necesario',
      s1Text:
        'TeacherHubPro usa unas pocas cookies para funcionar. No usamos cookies de publicidad ni de seguimiento.',
      s2Title: 'Las cookies',
      s2Text:
        'thp_session mantiene su sesión abierta (30 días). thp_oauth_state protege el inicio de sesión con Google y la conexión con Classroom mientras ocurren. thp_tz recuerda su zona horaria para que “hoy” sea su hoy. thp_tour_seen recuerda que cerró el recorrido de bienvenida.',
      s3Title: 'El chat del sitio',
      s3Text:
        'El chat del sitio guarda su clave de conversación solo en la pestaña de su navegador, y termina al cerrar la pestaña.',
    },
    accessibility: {
      title: 'Accesibilidad',
      description: 'Cómo trabaja TeacherHubPro por la accesibilidad.',
      s1Title: 'Nuestra meta',
      s1Text:
        'Buscamos que TeacherHubPro cumpla WCAG 2 nivel AA, para que todos los maestros, estudiantes y familias puedan usarlo.',
      s2Title: 'Lo que hacemos',
      s2Text:
        'Las páginas se prueban automáticamente contra problemas de WCAG 2 A y AA en cada cambio. La app funciona con teclado, usa formularios y títulos etiquetados, sigue su modo claro u oscuro y puede leer texto en voz alta.',
      s3Title: 'Avísenos',
      s3Text:
        'Si algo es difícil de usar, escríbanos desde la página de contacto y díganos la página y lo que pasó.',
    },
    acceptableUse: {
      title: 'Uso aceptable',
      description: 'Para qué se puede usar TeacherHubPro y para qué no.',
      s1Title: 'Úselo para enseñar',
      s1Text: 'Use TeacherHubPro para planificar, enseñar, evaluar y comunicarse con las familias.',
      s2Title: 'No haga esto',
      s2Text:
        'No ingrese información de estudiantes que no esté autorizado a compartir, no intente ver datos de otra escuela, no publique enlaces privados de estudiantes o familias, no sobrecargue ni ataque el servicio, no use las herramientas de IA para crear contenido dañino, ilegal o ajeno a la enseñanza, y no la use como estudiante para hacer sus propias tareas escolares.',
      s3Title: 'Si se rompen las reglas',
      s3Text:
        'Podemos suspender un acceso que ponga en riesgo a estudiantes, escuelas o el servicio.',
    },
    ferpa: {
      title: 'FERPA',
      description: 'Cómo maneja TeacherHubPro los registros educativos.',
      s1Title: 'Registros educativos',
      s1Text:
        'Las notas, la asistencia, las tareas y los comentarios que ingresan los maestros son registros educativos. Los procesamos solo para dar el servicio a la escuela o al maestro, bajo su dirección.',
      s2Title: 'Acceso',
      s2Text:
        'Solo los usuarios de la escuela a la que pertenecen pueden ver los registros. Las familias ven las notas confirmadas y la asistencia de su propio hijo con un enlace privado.',
      s3Title: 'Ningún otro uso',
      s3Text: 'No vendemos registros educativos ni los usamos para publicidad.',
    },
    coppa: {
      title: 'Privacidad infantil (COPPA)',
      description: 'Cómo protege TeacherHubPro la información de los niños.',
      s1Title: 'Sin cuentas de estudiantes',
      s1Text:
        'Los estudiantes no se registran ni nos dan información personal directamente. Maestros, escuelas y familias ingresan la información que una función necesita, y los estudiantes usan enlaces privados.',
      s2Title: 'Solo lo necesario',
      s2Text:
        'Recopilamos solo lo que una función necesita, enviamos a la IA solo lo que una tarea necesita y nunca usamos información de niños para publicidad.',
      s3Title: 'Familias',
      s3Text:
        'Las familias pueden pedir al maestro o a la escuela de su hijo que revise o elimine su información, o escribirnos desde la página de contacto.',
    },
    aiGovernance: {
      title: 'Gobernanza de la IA',
      description: 'Las reglas que siguen las funciones de IA de TeacherHubPro.',
      s1Title: 'Solo borradores',
      s1Text:
        'Las notas de la IA, los análisis de estudiantes, los planes, las preparaciones semanales y los correos a las familias son borradores hasta que un maestro los aprueba. Las boletas, el total del registro de notas y los portales familiares muestran solo notas confirmadas por el maestro.',
      s2Title: 'Los mínimos datos',
      s2Text:
        'Cada tarea de IA recibe solo los datos que necesita. Los análisis de estudiantes reciben números y títulos de tareas, no nombres. Las instrucciones, el trabajo de los estudiantes y los datos personales no se guardan en los registros.',
      s3Title: 'Sin datos inventados',
      s3Text:
        'Se le indica a la IA que no invente notas, asistencia, códigos de estándares, precios ni funciones, y sus respuestas se comprueban: por ejemplo, los códigos de estándares deben existir y el chat del sitio solo puede dar precios reales.',
      s4Title: 'Honesta sobre ser IA',
      s4Text: 'El chat del sitio es un asistente de IA y lo dice cuando se le pregunta.',
      s5Title: 'Proveedores',
      s5Text:
        'Los borradores de IA se hacen con Claude, de Anthropic; el audio de lectura en voz alta, con OpenAI.',
    },
    trust: {
      title: 'Centro de confianza',
      description: 'Cómo protege TeacherHubPro a escuelas, maestros, estudiantes y familias.',
      s1Title: 'Hecho para datos de menores',
      s1Text:
        'Estudiantes y familias usan enlaces privados en lugar de cuentas. Los enlaces son aleatorios, se guardan solo como hash, se pueden revocar y vencen.',
      s2Title: 'Separación por escuela',
      s2Text:
        'Cada registro pertenece a una escuela, y cada acción comprueba la escuela y el rol del usuario.',
      s3Title: 'Secretos y contraseñas',
      s3Text:
        'Las contraseñas se guardan como hash; los tokens de Google se cifran; los secretos nunca se escriben en los registros; el código se revisa en cada cambio para detectar secretos filtrados.',
      s4Title: 'IA con límites',
      s4Text:
        'La IA solo prepara borradores, recibe solo lo que una tarea necesita y se comprueba contra datos inventados. Vea la página de gobernanza de la IA.',
      s5Title: 'Acuerdos',
      s5Text:
        '¿Necesita un acuerdo de tratamiento de datos o tiene una pregunta de seguridad para su escuela? Escríbanos desde la página de contacto.',
    },
  },
};
