import type { MarketingMessages } from './marketing-types.ts';

// O texto do site público em português: páginas de marketing, o chat do site e as páginas
// legais. Tudo o que ele diz deve ser verdade sobre o aplicativo hoje.

export const marketingPt: MarketingMessages = {
  marketing: {
    nav: {
      label: 'Principal',
      features: 'Recursos',
      useCases: 'Casos de uso',
      pricing: 'Preços',
      contact: 'Contato',
      logIn: 'Entrar',
      startTrial: 'Começar teste grátis',
    },
    footer: {
      tagline:
        'O espaço de trabalho com IA para professores, escolas e famílias que educam em casa.',
      product: 'Produto',
      useCases: 'Casos de uso',
      company: 'Empresa',
      legal: 'Informações legais e confiança',
      ai: 'Recursos de IA',
      integrations: 'Integrações',
      enterprise: 'Escolas e redes de ensino',
      help: 'Ajuda',
      rights: '© {year} TeacherHubPro',
    },
    landing: {
      metaTitle: 'TeacherHubPro: seu espaço de trabalho com IA para ensinar',
      metaDescription:
        'Planeje aulas, faça a chamada, dê notas, crie slides, jogos e quizzes e compartilhe o progresso com as famílias, com uma IA que faz o rascunho enquanto você decide. Teste grátis de 7 dias.',
      featuresTitle: 'Tudo o que uma semana de aulas precisa',
      featuresIntro: 'Um só espaço para planejar, ensinar, avaliar e falar com as famílias.',
      howTitle: 'Como funciona',
      how1Title: 'Configure suas turmas',
      how1Text:
        'Adicione uma turma e importe a lista de alunos de uma planilha ou do Google Classroom.',
      how2Title: 'Deixe a IA fazer o rascunho',
      how2Text:
        'Peça um plano semanal, slides, uma folha de atividades, um quiz ou a preparação de uma semana inteira. Cada resultado é um rascunho.',
      how3Title: 'Revise e use',
      how3Text:
        'Edite o que quiser e depois ensine, atribua, avalie e compartilhe. Nada chega aos alunos ou às famílias até você aprovar.',
      whoTitle: 'Feito para',
      whoIntro:
        'Professores em sala de aula, famílias que educam em casa, tutores e escolas inteiras.',
      trustTitle: 'Dados dos alunos, tratados com cuidado',
      trustIntro: 'Os alunos são menores de idade, e o aplicativo foi construído pensando nisso.',
      trust1:
        'Alunos e pais usam links privados, não contas. Os links são aleatórios, guardados apenas como hashes e podem ser revogados.',
      trust2:
        'Cada registro pertence a uma única escola, e só os professores dessa escola podem acessá-lo.',
      trust3:
        'A IA recebe apenas o que uma tarefa precisa. As análises sobre alunos recebem números, nunca um nome.',
      trust4: 'Notas e sugestões da IA continuam como rascunhos até que um professor as confirme.',
      trustMore: 'Visite a central de confiança',
      pricingTitle: 'Preços simples',
      pricingIntro: 'Comece com um teste grátis de {days} dias. Não é preciso cartão de pagamento.',
      pricingSee: 'Ver todos os planos',
      faqTitle: 'Perguntas',
      faq1Q: 'Preciso de um cartão de pagamento para o teste?',
      faq1A:
        'Não. O teste dá acesso completo por 7 dias; você só escolhe um plano se quiser continuar.',
      faq2Q: 'A IA dá as notas por mim?',
      faq2A:
        'Ela sugere notas e comentários para respostas abertas. Você confirma cada nota antes que ela conte.',
      faq3Q: 'Quais idiomas são aceitos?',
      faq3A:
        'O TeacherHubPro está totalmente disponível em sete idiomas: inglês, espanhol, francês, português, alemão, italiano e chinês, e a IA escreve no idioma que você escolher.',
      faq4Q: 'Funciona com o Google Classroom?',
      faq4A:
        'Sim. Você pode importar listas de alunos, publicar tarefas e documentos do Word, enviar apresentações como Google Slides e criar quizzes no Google Forms.',
      faq5Q: 'A escola inteira pode usar?',
      faq5A:
        'Sim. Os planos Escola e Rede adicionam professores a uma mesma escola, com páginas de administração e importação em massa.',
      ctaTitle: 'Experimente com suas próprias turmas',
      ctaText:
        'Configure uma turma em minutos e deixe a IA fazer o rascunho da sua próxima semana.',
    },
    feature: {
      lesson_planner: {
        title: 'Planejador de aulas',
        text: 'Planos semanais com padrões Common Core, rascunhados pela IA e editados por você.',
      },
      ai_assistant: {
        title: 'Assistente de IA',
        text: 'Folhas de atividades, quizzes, resumos e atividades no seu idioma.',
      },
      presentations: {
        title: 'Apresentações',
        text: 'Slides rascunhados pela IA, apresentados em tela cheia, impressos ou enviados ao Google Classroom.',
      },
      gradebook: {
        title: 'Diário de notas e boletins',
        text: 'Categorias com pesos, tarefas e boletins em PDF com o logotipo da sua escola.',
      },
      attendance: {
        title: 'Frequência',
        text: 'Chamada diária com atrasos, faltas justificadas e relatórios.',
      },
      assignments: {
        title: 'Provas on-line e correção com IA',
        text: 'Crie questões ou importe uma prova em PDF; os alunos respondem por um link; você confirma as notas sugeridas pela IA.',
      },
      games: {
        title: 'Jogos e jogos ao vivo',
        text: 'Jogos educativos em vários modos e jogos ao vivo em sala, em que os alunos entram com um PIN.',
      },
      learning: {
        title: 'Trilhas de aprendizagem',
        text: 'Lições rascunhadas pela IA, com verificações, atribuídas aos alunos por links privados.',
      },
      families: {
        title: 'Portal da família',
        text: 'Cada família recebe um link privado, somente leitura, com as notas confirmadas e a frequência.',
      },
      command_center: {
        title: 'Central de Comando',
        text: 'As turmas de hoje, o que falta corrigir, alunos que podem precisar de ajuda e sugestões.',
      },
      prep_agent: {
        title: 'Agente de Preparação',
        text: 'Uma frase vira uma semana: plano, slides, folhas de atividades, um quiz de sexta-feira e um e-mail aos pais para revisar.',
      },
      schools: {
        title: 'Para escolas',
        text: 'Administradores da escola gerenciam usuários e funções; importam professores e alunos em massa.',
      },
    },
    featuresPage: {
      metaTitle: 'Recursos | TeacherHubPro',
      metaDescription:
        'Planejamento de aulas, ferramentas de IA, diário de notas, frequência, apresentações e um fluxo de trabalho pensado para professores, em um só espaço.',
      title: 'Recursos',
      intro: 'O que você pode fazer com o TeacherHubPro hoje.',
      learnMore: 'Saiba mais sobre {feature}',
      allFeatures: 'Todos os recursos',
    },
    included: {
      title: 'Tudo incluído',
      intro: 'Todos os recursos que o TeacherHubPro tem hoje, numa só lista.',
      prepAgent:
        'Agente de preparação: uma frase vira uma semana de planos de aula, slides, fichas, um quiz de sexta-feira e um e-mail para as famílias, prontos para você revisar',
      planner:
        'Planejador de aulas com IA e padrões Common Core e de Porto Rico, em layout simples ou clássico',
      assistant:
        'Assistente de IA para fichas, quizzes, resumos e atividades, com apoio a alunos de inglês (ESL)',
      presentations:
        'Apresentações com IA para mostrar em tela cheia, imprimir, baixar em PowerPoint ou enviar ao Google Classroom',
      tests:
        'Provas online que os alunos respondem por um link privado; escreva as perguntas ou importe uma prova em PDF',
      aiGrading: 'Correção com IA de respostas abertas, como sugestões que o professor confirma',
      gradebook: 'Diário de notas ponderado e boletins em PDF com o logotipo da sua escola',
      attendance: 'Chamada diária com atrasos, faltas justificadas e relatórios',
      games: 'Jogos educativos em vários modos e jogos ao vivo em que os alunos entram com um PIN',
      learning:
        'Trilhas de aprendizagem: lições redigidas pela IA com verificações, atribuídas por links privados',
      families:
        'Portal da família: um link privado, somente leitura, com notas confirmadas e frequência, além de resumos semanais por e-mail',
      commandCenter:
        'Central de comando: as aulas de hoje, o que corrigir e os alunos que podem precisar de ajuda',
      subPacket: 'Pacotes para professores substitutos',
      listen: 'Ouvir: planos e materiais lidos em voz alta',
      google:
        'Integração com o Google: login com Google, Google Classroom (importar turmas, publicar tarefas, documentos Word e apresentações), quizzes no Google Forms e arquivos no seu próprio Google Drive',
      canva:
        'Canva: abra apresentações e fichas de atividades na sua própria conta do Canva como designs editáveis',
      microsoft:
        'Microsoft OneDrive: salve apresentações em PowerPoint e fichas de atividades em Word no seu próprio OneDrive',
      teams:
        'Microsoft Teams, para escolas que usam o Teams nas aulas: sob pedido, importe listas de turma de uma turma do Teams e compartilhe tarefas com ela. O administrador de TI da sua escola aprova a conexão uma única vez.',
      languages:
        'Sete idiomas: inglês, espanhol, francês, português, alemão, italiano e chinês; a IA escreve no idioma que você escolher',
      privacy:
        'Sem contas para alunos ou famílias: links privados guardados só como hash, que você pode revogar e que expiram; feito para FERPA e COPPA',
      aiDrafts:
        'A IA sugere, o professor decide: notas, análises e e-mails às famílias ficam como rascunho até você aprovar',
      schools:
        'Para escolas e redes de ensino: páginas de administração, funções e importação em massa de professores e alunos',
      audiences: 'Para professores, escolas, tutores e famílias que educam em casa',
    },
    features: {
      'lesson-planning': {
        title: 'Planejamento de aulas',
        description:
          'Planos de aula semanais com padrões Common Core, rascunhados pela IA e editados por você.',
        intro: 'Planeje uma semana em minutos e mantenha todos os planos em um só lugar.',
        p1Title: 'Planos semanais e de Inglês Conversacional',
        p1Text:
          'Objetivos, habilidades, padrões e atividades dia a dia, no formato que os professores já usam.',
        p2Title: 'A IA faz o rascunho, você decide',
        p2Text:
          'Peça um rascunho para sua disciplina, série e tema; nada é salvo até você editar e salvar.',
        p3Title: 'Códigos Common Core reais',
        p3Text:
          'Os padrões vêm da lista oficial do Common Core para a disciplina e a série; os códigos são verificados, nunca inventados.',
        p4Title: 'Modelos, pastas e impressão',
        p4Text:
          'Salve modelos, organize planos em pastas, duplique uma semana, veja um calendário e imprima ou salve em PDF.',
      },
      gradebook: {
        title: 'Diário de notas e boletins',
        description: 'Categorias com pesos, tarefas, notas e boletins em PDF.',
        intro: 'Notas que somam do jeito que sua escola conta.',
        p1Title: 'Categorias com pesos',
        p1Text: 'Defina categorias e pesos por turma, ou comece pelas categorias padrão.',
        p2Title: 'Pontos reais, médias reais',
        p2Text:
          'Cada tarefa mantém sua própria pontuação máxima, e as médias usam os pesos das categorias.',
        p3Title: 'Boletins',
        p3Text:
          'Boletins em PDF por semestre, com o logotipo da sua escola e comentários do professor.',
        p4Title: 'Só notas confirmadas',
        p4Text:
          'As notas sugeridas pela IA continuam como rascunhos; boletins e famílias veem apenas as notas que você confirmou.',
      },
      attendance: {
        title: 'Frequência',
        description:
          'Chamada diária com presente, ausente, atrasado e falta justificada, e relatórios.',
        intro: 'Faça a chamada em segundos e veja padrões ao longo do tempo.',
        p1Title: 'Folha diária rápida',
        p1Text:
          'Todos começam como presentes; marque os demais, com minutos de atraso e observações.',
        p2Title: 'Enviar e reabrir',
        p2Text: 'Um dia enviado fica bloqueado até você reabri-lo.',
        p3Title: 'Relatórios',
        p3Text: 'Os totais e a taxa de frequência de cada aluno nos dias que você escolher.',
        p4Title: 'Alimenta a Central de Comando',
        p4Text: 'Faltas e atrasos contam para a lista de alunos em risco no seu painel.',
      },
      'ai-tools': {
        title: 'Ferramentas de IA',
        description:
          'Folhas de atividades, quizzes, resumos, atividades, slides, jogos e sugestões de correção.',
        intro: 'Uma IA que economiza seu tempo de rascunho e deixa todas as decisões com você.',
        p1Title: 'Assistente de IA',
        p1Text:
          'Folhas de atividades, quizzes, resumos de temas, atividades e planos de aula no idioma que você escolher.',
        p2Title: 'De PDF para prova on-line',
        p2Text:
          'Envie uma prova em PDF; a IA a divide em questões que você revisa antes que os alunos as vejam.',
        p3Title: 'Sugestões de correção',
        p3Text:
          'A IA sugere notas e comentários para respostas abertas; você confirma ou altera cada uma.',
        p4Title: 'Ouvir',
        p4Text: 'Peça que o texto seja lido em voz alta para alunos que aprendem melhor ouvindo.',
      },
      presentations: {
        title: 'Apresentações',
        description:
          'Slides rascunhados pela IA, editados, apresentados, impressos ou enviados ao Google Classroom.',
        intro: 'Monte os slides da aula de amanhã em poucos minutos.',
        p1Title: 'Rascunhados pela IA ou em branco',
        p1Text:
          'Informe um tema, uma disciplina e uma série, ou comece com uma apresentação vazia.',
        p2Title: 'Layouts e temas',
        p2Text: 'Layouts de título, conteúdo, duas colunas e citação, emojis, temas e transições.',
        p3Title: 'Apresentar e imprimir',
        p3Text: 'Apresente em tela cheia ou imprima um slide por página.',
        p4Title: 'Google Slides no Classroom',
        p4Text:
          'Envie uma apresentação para uma turma do Google Classroom como uma apresentação do Google Slides que os alunos podem ver.',
      },
      workflow: {
        title: 'Fluxo de trabalho pensado para professores',
        description:
          'Turmas, listas de alunos, um painel diário, o Aluno 360 e o Agente de Preparação.',
        intro: 'Menos cliques, mais aula.',
        p1Title: 'Turmas e listas de alunos',
        p1Text:
          'Turmas com horários e listas de alunos a partir de um arquivo CSV ou do Google Classroom.',
        p2Title: 'Central de Comando',
        p2Text:
          'As turmas de hoje, o que ainda falta corrigir, alunos que podem precisar de ajuda e as próximas aulas.',
        p3Title: 'Aluno 360',
        p3Text:
          'A média de um aluno, a frequência, as tarefas pendentes, uma linha do tempo e suas anotações privadas.',
        p4Title: 'Agente de Preparação',
        p4Text:
          'Escreva uma frase sobre a próxima semana e revise uma semana inteira de rascunhos antes de publicar.',
      },
    },
    ai: {
      metaTitle: 'Recursos de IA | TeacherHubPro',
      metaDescription:
        'O que a IA do TeacherHubPro rascunha, o que ela recebe e por que o professor sempre decide.',
      title: 'A IA faz o rascunho, o professor decide',
      intro:
        'Todo recurso de IA do TeacherHubPro cria um rascunho. Você revisa, edita e aprova antes que algo chegue aos alunos ou às famílias.',
      listTitle: 'O que a IA pode rascunhar',
      planner: 'Planos de aula semanais com códigos Common Core',
      assistant: 'Folhas de atividades, quizzes, resumos e atividades',
      slides: 'Slides de apresentação',
      extractor: 'Questões de provas on-line a partir de um PDF',
      grader: 'Notas e comentários sugeridos para respostas abertas',
      games: 'Conteúdo de jogos para todos os modos de jogo',
      paths: 'Lições de trilhas de aprendizagem com verificações',
      insight: 'Uma breve análise das tendências de um aluno, feita só a partir de números',
      prep: 'Uma semana de planos, slides, folhas de atividades, um quiz e um e-mail aos pais',
      principlesTitle: 'Como usamos a IA',
      principle1: 'O resultado da IA é sempre um rascunho até que um professor o aprove.',
      principle2:
        'A IA recebe apenas os campos de que uma tarefa precisa; os nomes dos alunos não são enviados quando não são necessários.',
      principle3: 'Prompts, trabalhos dos alunos e dados pessoais não são gravados em logs.',
      principle4: 'A IA escreve no idioma que o professor escolher.',
      governance: 'Leia nossa página de governança da IA',
    },
    useCasesPage: {
      title: 'Casos de uso',
      intro: 'O TeacherHubPro para o seu jeito de ensinar.',
    },
    useCases: {
      'classroom-teachers': {
        title: 'Professores em sala de aula',
        description: 'Planos, frequência, notas e famílias para professores em sala de aula.',
        intro: 'Resolva o planejamento e a papelada e dedique sua energia a ensinar.',
        n1Title: 'Planeje mais rápido',
        n1Text:
          'Planos semanais, slides e folhas de atividades rascunhados pela IA, prontos para você ajustar.',
        n2Title: 'Corrija com menos esforço',
        n2Text:
          'Provas on-line por link, correção automática das questões fechadas e sugestões da IA para as abertas.',
        n3Title: 'Mantenha as famílias informadas',
        n3Text: 'Links privados para as famílias mostram as notas confirmadas e a frequência.',
      },
      homeschool: {
        title: 'Famílias que educam em casa',
        description:
          'Planos, registros, trilhas de aprendizagem e progresso para famílias que educam em casa.',
        intro: 'Estrutura para a educação em casa, sem trabalho burocrático.',
        n1Title: 'Um plano para cada semana',
        n1Text: 'Planos semanais com padrões Common Core para cada disciplina e série.',
        n2Title: 'Registros que você pode mostrar',
        n2Text: 'Frequência, notas e boletins guardados em um só lugar.',
        n3Title: 'Aprendendo no ritmo deles',
        n3Text:
          'Trilhas de aprendizagem rascunhadas pela IA e jogos que seus filhos abrem por um link privado.',
      },
      tutors: {
        title: 'Tutores',
        description: 'Materiais, prática e progresso para tutores.',
        intro: 'Prepare as sessões rapidamente e mostre o progresso com clareza.',
        n1Title: 'Materiais sob demanda',
        n1Text: 'Folhas de atividades, quizzes e slides para qualquer tema e nível.',
        n2Title: 'Prática entre as sessões',
        n2Text:
          'Atribua provas, jogos e trilhas de aprendizagem por links; os alunos não precisam de conta.',
        n3Title: 'Progresso para os pais',
        n3Text: 'Compartilhe um link da família, somente leitura, com os resultados confirmados.',
      },
      schools: {
        title: 'Escolas',
        description:
          'Um só espaço de trabalho para todos os professores, com páginas de administração e importação em massa.',
        intro:
          'Dê a todos os professores as mesmas ferramentas e mantenha os dados dos alunos dentro de uma escola.',
        n1Title: 'Páginas de administração',
        n1Text:
          'Os administradores da escola veem seus usuários, alteram funções e passam turmas de um professor para outro.',
        n2Title: 'Importação em massa',
        n2Text: 'Importe professores e listas de alunos a partir de planilhas.',
        n3Title: 'Plano Escola',
        n3Text: 'Preço por professor com cobrança anual, a partir de 10 professores.',
      },
    },
    pricingPage: {
      metaTitle: 'Preços | TeacherHubPro',
      metaDescription:
        'Planos Individual, Escola e Rede, com teste grátis de 7 dias e sem precisar de cartão de pagamento.',
      title: 'Preços',
      intro:
        'Todos os planos incluem todos os recursos. Comece com um teste grátis de {days} dias; não é preciso cartão de pagamento.',
      minimum: 'A partir de {count} professores',
      start: 'Começar teste grátis',
      contactSales: 'Fale conosco',
      faqTitle: 'Perguntas sobre preços',
      faq1Q: 'O que acontece quando o teste termina?',
      faq1A:
        'Você mantém seus dados. Para continuar usando o aplicativo, escolha um plano na página Planos e cobrança.',
      faq2Q: 'Como funcionam os planos Escola e Rede?',
      faq2A:
        'Você paga por professor, com cobrança anual: Escola a partir de 10 professores, Rede a partir de 100.',
      faq3Q: 'Como faço o pagamento?',
      faq3A:
        'Os pagamentos são processados pela Stripe. O TeacherHubPro nunca vê nem guarda números de cartão.',
    },
    integrationsPage: {
      metaTitle: 'Integrações | TeacherHubPro',
      metaDescription:
        'Login com Google, Google Classroom, Forms, Drive e Slides, Canva, Microsoft OneDrive, Stripe e e-mail.',
      title: 'Integrações',
      intro: 'Os serviços com que o TeacherHubPro funciona hoje, por meio de suas APIs oficiais.',
    },
    enterprisePage: {
      metaTitle: 'Escolas e redes de ensino | TeacherHubPro',
      metaDescription:
        'O TeacherHubPro para escolas e redes de ensino: páginas de administração, importação em massa e planos por professor.',
      title: 'Para escolas e redes de ensino',
      intro:
        'Dê a todos os professores o mesmo espaço de trabalho, com os dados dos alunos mantidos dentro da sua escola.',
      p1Title: 'Páginas de administração',
      p1Text:
        'Veja todos os usuários da sua escola, altere funções, envie links de senha e transfira turmas.',
      p2Title: 'Importação em massa',
      p2Text:
        'Professores e listas de alunos a partir de arquivos CSV, verificados linha por linha antes de qualquer coisa ser criada.',
      p3Title: 'Privacidade desde a concepção',
      p3Text:
        'Dados restritos a cada escola, links de alunos e famílias guardados como hashes, tokens do Google criptografados e uma IA que apenas faz rascunhos.',
      p4Title: 'Planos por professor',
      p4Text: 'Escola a partir de 10 professores e Rede a partir de 100, com cobrança anual.',
      cta: 'Fale conosco sobre a sua escola',
    },
    contactPage: {
      metaTitle: 'Contato | TeacherHubPro',
      metaDescription:
        'Dúvidas, uma demonstração para sua escola ou ajuda: escreva para a equipe do TeacherHubPro.',
      title: 'Fale conosco',
      intro:
        'Dúvidas, uma demonstração para sua escola ou ajuda com sua conta: lemos todas as mensagens.',
      name: 'Seu nome',
      email: 'E-mail',
      organization: 'Escola ou organização (opcional)',
      role: 'Eu sou',
      phone: 'Telefone (opcional)',
      interest: 'Tenho interesse em',
      message: 'Mensagem',
      consent: 'Usamos estes dados apenas para responder a você. Nunca os vendemos.',
      send: 'Enviar',
      sent: 'Obrigado. Responderemos em breve.',
    },
    roles: {
      teacher: 'Professor(a)',
      homeschool: 'Pai ou mãe que educa em casa',
      tutor: 'Tutor(a)',
      school_admin: 'Administrador(a) escolar',
      principal: 'Diretor(a)',
      district: 'Gestor(a) de rede de ensino',
      parent: 'Pai ou mãe',
      other: 'Outro',
    },
    interests: {
      features: 'Recursos',
      pricing: 'Preços',
      demo: 'Uma demonstração',
      school: 'Um plano para minha escola',
      enterprise: 'Um plano para uma rede de ensino',
      support: 'Ajuda com minha conta',
      other: 'Outra coisa',
    },
    helpPage: {
      metaTitle: 'Ajuda | TeacherHubPro',
      metaDescription: 'Comece a usar o TeacherHubPro e encontre respostas para dúvidas comuns.',
      title: 'Ajuda',
      intro: 'Comece por aqui ou escreva para nós pela página de contato.',
      startTitle: 'Primeiros passos',
      step1: 'Cadastre-se com seu e-mail ou sua conta Google.',
      step2: 'Crie uma turma e importe a lista de alunos de um arquivo CSV ou do Google Classroom.',
      step3: 'Configure as categorias de notas e faça sua primeira chamada.',
      step4: 'Peça à IA um plano semanal, ou ao Agente de Preparação uma semana inteira.',
      faqTitle: 'Dúvidas comuns',
      faq1Q: 'Como os alunos recebem as tarefas?',
      faq1A:
        'Você cria links privados por aluno a partir de uma tarefa; os alunos os abrem sem precisar de conta.',
      faq2Q: 'Como as famílias acompanham o progresso?',
      faq2A:
        'Envie a cada família um link privado do portal, somente leitura; ele mostra apenas as notas que você confirmou.',
      faq3Q: 'Esqueci minha senha.',
      faq3A:
        'Use “Esqueceu a senha?” na página de login; enviaremos por e-mail um link de uso único.',
      faq4Q: 'Como conecto o Google Classroom?',
      faq4A:
        'Abra Ferramentas conectadas, escolha Conectar o Google Classroom e depois selecione sua conta de professor.',
    },
    chat: {
      open: 'Converse com o Ed',
      close: 'Fechar chat',
      title: 'Ed, o assistente de IA do TeacherHubPro',
      intro:
        'Olá! Eu sou o Ed, um assistente de IA. Posso responder a perguntas sobre os recursos e os preços do TeacherHubPro.',
      rolePrompt: 'O que melhor descreve você?',
      interestPrompt: 'Sobre o que você gostaria de saber?',
      placeholder: 'Digite sua pergunta',
      send: 'Enviar',
      you: 'Você',
      ed: 'Ed',
      thinking: 'O Ed está escrevendo…',
      failed: 'Desculpe, não consegui responder a isso. Tente de novo ou use a página de contato.',
      limit: 'Este chat atingiu o limite. Use a página de contato para falar com a equipe.',
      leadPrompt: 'Quer que a equipe entre em contato? Deixe seus dados.',
      leadOpen: 'Deixar meus dados',
      leadSent: 'Obrigado! A equipe entrará em contato.',
      aiNote:
        'As respostas vêm de uma IA e podem estar erradas; os preços da página Preços são a referência.',
    },
    leads: {
      title: 'Contatos',
      intro: 'Pessoas que deixaram seus dados no chat do site ou no formulário de contato.',
      score_high: 'Alta',
      score_medium: 'Média',
      score_low: 'Baixa',
      source_chat: 'Chat',
      source_contact: 'Formulário de contato',
      status_new: 'Novo',
      status_contacted: 'Contatado',
      status_closed: 'Encerrado',
      search: 'Pesquisar por nome, e-mail ou organização',
      score: 'Prioridade',
      source: 'Origem',
      status: 'Status',
      all: 'Todos',
      filter: 'Filtrar',
      empty: 'Nenhum contato ainda.',
      received: 'Recebido',
      saveStatus: 'Salvar status',
      statusFor: 'Status de {name}',
    },
  },
  legal: {
    updated: 'Última atualização: {date}',
    contact: 'Dúvidas sobre esta página? Escreva para nós pela página de contato.',
    privacy: {
      title: 'Política de privacidade',
      description: 'Quais dados o TeacherHubPro guarda, por quê e como eles são protegidos.',
      s1Title: 'A quem se aplica',
      s1Text:
        'Esta política se aplica a professores, funcionários de escolas e pais que educam em casa e usam o TeacherHubPro, e às informações de alunos e famílias que eles inserem. Alunos e famílias não criam contas; eles usam links privados que um professor lhes fornece.',
      s2Title: 'O que guardamos',
      s2Text:
        'Dados da conta (nome, e-mail, escola, idioma), o que os professores criam (turmas, planos, tarefas, notas, frequência, anotações) e o que os alunos enviam pelos seus links. Os registros dos alunos contêm apenas o que um recurso precisa: nomes, um número de matrícula opcional, um e-mail opcional do responsável e adaptações opcionais.',
      s3Title: 'Como usamos',
      s3Text:
        'Apenas para operar o serviço para a escola ou o professor que inseriu os dados. Não vendemos dados pessoais nem usamos dados de alunos para publicidade.',
      s4Title: 'Com quem compartilhamos',
      s4Text:
        'Prestadores de serviços que fazem o aplicativo funcionar: nosso provedor de hospedagem e banco de dados, a Stripe para pagamentos, um provedor de e-mail para mensagens, a Anthropic (Claude) para rascunhos de IA, a OpenAI para o áudio de leitura em voz alta, o Google quando um professor conecta o Google Classroom, o Canva quando um professor conecta o Canva (apenas a apresentação ou ficha que ele abre lá, nunca dados de alunos) e a Microsoft quando um professor conecta a Microsoft (apenas os arquivos que ele salva no OneDrive, nunca dados de alunos). Cada um recebe apenas o que sua tarefa precisa.',
      s5Title: 'Como são protegidos',
      s5Text:
        'As senhas são guardadas como hashes unidirecionais. Os links de sessão, de alunos, de famílias e de senha são aleatórios e guardados apenas como hashes. Os tokens do Google Classroom, do Canva e da Microsoft são criptografados. Cada registro pertence a uma única escola e só pode ser acessado pelos usuários dessa escola. O link do calendário de um professor também é aleatório e guardado apenas como hash: ele mostra só os títulos dos planos e das atividades com as datas, nunca informações dos alunos, e o professor pode substituí-lo ou desativá-lo nas Configurações.',
      s6Title: 'Retenção e exclusão de dados',
      s6Text:
        'Os dados são mantidos enquanto a conta estiver ativa. Os PDFs enviados são excluídos assim que são lidos. As conversas do chat do site são excluídas após 30 dias. Para pedir uma cópia ou a exclusão dos seus dados, escreva para nós pela página de contato.',
    },
    terms: {
      title: 'Termos de uso',
      description: 'Os termos para usar o TeacherHubPro.',
      s1Title: 'O serviço',
      s1Text:
        'O TeacherHubPro é um aplicativo web para o ensino: planejamento, turmas, frequência, notas, tarefas, ferramentas de rascunho com IA e portais da família.',
      s2Title: 'Sua conta',
      s2Text:
        'As contas são para adultos: professores, funcionários da escola, tutores e pais. Os alunos não têm contas; eles usam os links privados que o professor compartilha. Mantenha sua senha em segurança, use o aplicativo para ensinar e aprender e siga as regras de uso aceitável. Você é responsável pelo conteúdo que cria e pelas informações de alunos que insere, e por ter o direito de inseri-las.',
      s3Title: 'Rascunhos de IA',
      s3Text:
        'Os recursos de IA criam rascunhos que podem conter erros. Você os revisa e aprova antes de usá-los; notas e relatórios só contam depois que você os confirma.',
      s4Title: 'Planos e pagamento',
      s4Text:
        'Novas contas recebem um teste grátis de 7 dias. Os planos pagos são renovados até serem cancelados; os preços estão na página Preços. Os pagamentos são processados pela Stripe.',
      s5Title: 'Seu conteúdo',
      s5Text:
        'Você mantém os direitos sobre o que cria. Você nos permite armazená-lo e processá-lo apenas para operar o serviço para você.',
      s6Title: 'Alterações',
      s6Text:
        'Podemos atualizar estes termos; mostraremos a data da versão mais recente nesta página.',
    },
    cookies: {
      title: 'Cookies',
      description: 'Os cookies que o TeacherHubPro usa.',
      s1Title: 'Só o que o aplicativo precisa',
      s1Text:
        'O TeacherHubPro usa alguns cookies para funcionar. Não usamos cookies de publicidade nem de rastreamento.',
      s2Title: 'Os cookies',
      s2Text:
        'thp_session mantém você conectado (30 dias). thp_oauth_state protege o login com Google e a conexão com o Classroom enquanto acontecem. thp_tz lembra seu fuso horário para que “hoje” seja o seu hoje. thp_tour_seen lembra que você fechou o tour de boas-vindas.',
      s3Title: 'O chat do site',
      s3Text:
        'O chat do site guarda a chave da conversa apenas na aba do seu navegador, e ela termina quando você fecha a aba.',
    },
    accessibility: {
      title: 'Acessibilidade',
      description: 'Como o TeacherHubPro trabalha pela acessibilidade.',
      s1Title: 'Nosso objetivo',
      s1Text:
        'Nosso objetivo é que o TeacherHubPro atenda ao nível AA das WCAG 2, para que todo professor, aluno e família possa usá-lo.',
      s2Title: 'O que fazemos',
      s2Text:
        'As páginas são testadas automaticamente quanto a problemas dos níveis A e AA das WCAG 2 a cada alteração. O aplicativo funciona com teclado, usa formulários e títulos identificados, segue sua configuração de modo claro ou escuro e pode ler textos em voz alta.',
      s3Title: 'Fale conosco',
      s3Text:
        'Se algo for difícil de usar, escreva para nós pela página de contato e diga qual página e o que aconteceu.',
    },
    acceptableUse: {
      title: 'Uso aceitável',
      description: 'Para que o TeacherHubPro pode e não pode ser usado.',
      s1Title: 'Use para ensinar',
      s1Text: 'Use o TeacherHubPro para planejar, ensinar, avaliar e se comunicar com as famílias.',
      s2Title: 'Não faça',
      s2Text:
        'Não insira informações de alunos que você não tem permissão para compartilhar, não tente acessar dados de outra escola, não compartilhe publicamente links privados de alunos ou famílias, não sobrecarregue nem ataque o serviço, não use as ferramentas de IA para criar conteúdo prejudicial, ilegal ou não relacionado e não o use como aluno para fazer suas próprias tarefas escolares.',
      s3Title: 'Se as regras forem descumpridas',
      s3Text: 'Podemos suspender o acesso que coloque em risco alunos, escolas ou o serviço.',
    },
    ferpa: {
      title: 'FERPA',
      description: 'Como o TeacherHubPro trata os registros educacionais.',
      s1Title: 'Registros educacionais',
      s1Text:
        'Notas, frequência, tarefas e anotações que os professores inserem são registros educacionais. Nós os processamos apenas para prestar o serviço à escola ou ao professor, sob a orientação deles.',
      s2Title: 'Acesso',
      s2Text:
        'Os registros só podem ser acessados pelos usuários da escola a que pertencem. As famílias veem as notas confirmadas e a frequência do próprio filho por meio de um link privado.',
      s3Title: 'Nenhum outro uso',
      s3Text: 'Não vendemos registros educacionais nem os usamos para publicidade.',
    },
    coppa: {
      title: 'Privacidade das crianças (COPPA)',
      description: 'Como o TeacherHubPro protege as informações das crianças.',
      s1Title: 'Sem contas de alunos',
      s1Text:
        'Os alunos não se cadastram nem nos fornecem informações pessoais diretamente. Professores, escolas e pais inserem as informações de que um recurso precisa, e os alunos usam links privados.',
      s2Title: 'Só o necessário',
      s2Text:
        'Coletamos apenas o que um recurso precisa, enviamos à IA apenas o que uma tarefa precisa e nunca usamos informações de crianças para publicidade.',
      s3Title: 'Pais',
      s3Text:
        'Os pais podem pedir ao professor ou à escola do filho que revise ou exclua as informações da criança, ou escrever para nós pela página de contato.',
    },
    aiGovernance: {
      title: 'Governança da IA',
      description: 'As regras que os recursos de IA do TeacherHubPro seguem.',
      s1Title: 'Apenas rascunhos',
      s1Text:
        'Notas da IA, análises sobre alunos, planos, lotes de preparação e e-mails aos pais são rascunhos até que um professor os aprove. Boletins, o total do diário de notas e os portais da família mostram apenas notas confirmadas pelo professor.',
      s2Title: 'Mínimo de dados',
      s2Text:
        'Cada tarefa de IA recebe apenas os campos de que precisa. As análises sobre alunos recebem números e títulos de tarefas, não nomes. Prompts, trabalhos dos alunos e dados pessoais não são gravados em logs.',
      s3Title: 'Nenhum fato inventado',
      s3Text:
        'A IA é instruída a não inventar notas, frequência, códigos de padrões, preços ou recursos, e suas respostas são verificadas: por exemplo, os códigos de padrões precisam existir e o chat do site só pode informar preços reais.',
      s4Title: 'Transparente sobre a IA',
      s4Text: 'O chat do site é um assistente de IA e diz isso quando perguntado.',
      s5Title: 'Provedores',
      s5Text:
        'Os rascunhos de IA são feitos com o Claude, da Anthropic; o áudio de leitura em voz alta, com a OpenAI.',
    },
    trust: {
      title: 'Central de confiança',
      description: 'Como o TeacherHubPro protege escolas, professores, alunos e famílias.',
      s1Title: 'Feito para dados de menores',
      s1Text:
        'Alunos e famílias usam links privados em vez de contas. Os links são aleatórios, guardados apenas como hashes, podem ser revogados e expiram.',
      s2Title: 'Restrição por escola',
      s2Text:
        'Cada registro pertence a uma única escola, e cada ação verifica a escola e a função do usuário.',
      s3Title: 'Segredos e senhas',
      s3Text:
        'As senhas são guardadas como hashes; os tokens do Google são criptografados; segredos nunca são gravados em logs; o código é verificado em busca de segredos vazados a cada alteração.',
      s4Title: 'IA com limites',
      s4Text:
        'A IA apenas faz rascunhos, recebe só o que uma tarefa precisa e é verificada contra fatos inventados. Veja a página de governança da IA.',
      s5Title: 'Acordos',
      s5Text:
        'Precisa de um acordo de tratamento de dados ou tem uma dúvida de segurança para sua escola? Escreva para nós pela página de contato.',
    },
  },
};
